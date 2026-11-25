"""AI 공급자 연결 — Gemini(기본) 또는 Claude. 외부 SDK 없이 표준 라이브러리(urllib)로 Gemini REST를 스트리밍한다.

환경변수 (Vercel → Settings → Environment Variables)
- Gemini 키: GEMINI_API_KEY / GOOGLE_API_KEY / Api_key / API_KEY 중 아무 이름이나 인식한다.
- GEMINI_MODEL (선택): 기본 모델을 바꾸고 싶을 때. 없으면 아래 MODELS 순서로 시도한다.
- ANTHROPIC_API_KEY (선택): Gemini 키가 없을 때만 Claude로 동작.
"""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Iterator

GEMINI_KEY_NAMES = ("GEMINI_API_KEY", "GOOGLE_API_KEY", "GOOGLE_GENERATIVE_AI_API_KEY", "Api_key", "API_KEY", "api_key")
# 앞 모델이 없거나(404) 이 키로 못 쓰면(403·429) 다음 모델로 넘어간다.
MODELS = ("gemini-flash-latest", "gemini-3.6-flash", "gemini-3.5-flash", "gemini-2.5-flash")
API = "https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse"


LAST_MODEL: dict = {}


class LLMError(Exception):
    """사용자에게 그대로 보여줄 수 있는 냥이체 오류."""


def _gemini_key() -> tuple[str, str] | None:
    for name in GEMINI_KEY_NAMES:
        v = (os.environ.get(name) or "").strip().strip('"').strip("'")
        if v:
            return name, v
    return None


def provider() -> dict:
    g = _gemini_key()
    if g:
        return {"name": "gemini", "key_from": g[0], "looks_ok": g[1].startswith("AIza")}
    if os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN"):
        try:
            import anthropic  # noqa: F401
            return {"name": "claude", "key_from": "ANTHROPIC_API_KEY", "looks_ok": True}
        except ImportError:
            pass
    return {"name": None, "key_from": None, "looks_ok": False}


def ready() -> bool:
    return provider()["name"] is not None


def stream(system: str, messages: list[dict], max_tokens: int = 6000, temperature: float = 0.9) -> Iterator[str]:
    """messages: [{"role": "user"|"assistant", "content": str}] → 텍스트 조각을 차례로 내보낸다."""
    p = provider()["name"]
    if p == "gemini":
        yield from _gemini(system, messages, max_tokens, temperature)
    elif p == "claude":
        yield from _claude(system, messages, max_tokens)
    else:
        raise LLMError("AI 냥이가 아직 연결되지 않았다냥 (Gemini API 키 필요)")


# ---------------------------------------------------------------- Gemini
def _thinking(model: str) -> dict:
    # 풀이 글은 깊은 추론보다 빠른 응답이 중요하다(Vercel 함수 60초 제한).
    if model.startswith("gemini-2.5"):
        return {"thinkingBudget": 0}
    return {"thinkingLevel": "low"}


def _gemini_body(system, messages, max_tokens, temperature, model, thinking=True) -> bytes:
    cfg = {"maxOutputTokens": max_tokens, "temperature": temperature, "topP": 0.95}
    if thinking:
        cfg["thinkingConfig"] = _thinking(model)
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "model" if m["role"] == "assistant" else "user", "parts": [{"text": m["content"]}]}
                     for m in messages],
        "generationConfig": cfg,
        "safetySettings": [{"category": c, "threshold": "BLOCK_ONLY_HIGH"} for c in (
            "HARM_CATEGORY_HARASSMENT", "HARM_CATEGORY_HATE_SPEECH",
            "HARM_CATEGORY_SEXUALLY_EXPLICIT", "HARM_CATEGORY_DANGEROUS_CONTENT")],
    }
    return json.dumps(body, ensure_ascii=False).encode("utf-8")


def _open(model: str, key: str, data: bytes):
    req = urllib.request.Request(API.format(model=model), data=data, method="POST",
                                 headers={"Content-Type": "application/json", "x-goog-api-key": key})
    return urllib.request.urlopen(req, timeout=55)


def _err_detail(e: urllib.error.HTTPError) -> str:
    try:
        j = json.loads(e.read().decode("utf-8", "replace"))
        return (j.get("error") or {}).get("message", "")[:300]
    except Exception:  # noqa: BLE001
        return ""


def _gemini(system, messages, max_tokens, temperature) -> Iterator[str]:
    _, key = _gemini_key()
    env_model = (os.environ.get("GEMINI_MODEL") or "").strip()
    models = ((env_model,) if env_model else ()) + tuple(m for m in MODELS if m != env_model)
    last = ""
    for model in models:
        resp = None
        for thinking in (True, False):
            try:
                resp = _open(model, key, _gemini_body(system, messages, max_tokens, temperature, model, thinking))
                break
            except urllib.error.HTTPError as e:
                detail = _err_detail(e)
                last = f"{e.code} {detail}"
                if e.code == 400 and thinking and "thinking" in detail.lower():
                    continue  # 이 모델은 thinkingConfig를 모른다 → 빼고 다시
                if e.code == 400 and ("API key" in detail or "API_KEY" in detail):
                    raise LLMError("Gemini API 키가 올바르지 않다냥. Vercel 환경변수 값을 다시 확인해 줘! (AIza로 시작하는 키)") from e
                if e.code in (400, 403, 404, 429):
                    break  # 다음 모델로
                raise LLMError(f"냥이가 잠깐 졸았다냥 (Gemini 오류 {e.code})") from e
            except urllib.error.URLError as e:
                raise LLMError("냥이와 연결이 끊겼다냥. 잠시 후 다시 시도해 줘!") from e
        if resp is None:
            continue
        LAST_MODEL["name"] = model
        yield from _read_sse(resp)
        return
    if last.startswith("429"):
        raise LLMError("오늘 냥이를 찾는 사람이 너무 많다냥(Gemini 사용량 한도). 잠시 후 다시 불러줘!")
    if last.startswith("403"):
        raise LLMError("이 Gemini 키로는 모델을 쓸 수 없다냥. Google AI Studio에서 키 권한을 확인해 줘!")
    raise LLMError(f"Gemini 모델에 연결하지 못했다냥 ({last[:120]})")


def _read_sse(resp) -> Iterator[str]:
    got = False
    blocked = ""
    with resp:
        for raw in resp:
            line = raw.decode("utf-8", "replace").strip()
            if not line.startswith("data:"):
                continue
            try:
                ev = json.loads(line[5:].strip())
            except json.JSONDecodeError:
                continue
            fb = ev.get("promptFeedback") or {}
            if fb.get("blockReason"):
                blocked = fb["blockReason"]
            for c in ev.get("candidates") or []:
                for part in (c.get("content") or {}).get("parts") or []:
                    if part.get("thought"):
                        continue
                    t = part.get("text")
                    if t:
                        got = True
                        yield t
                if c.get("finishReason") in ("SAFETY", "PROHIBITED_CONTENT", "BLOCKLIST"):
                    blocked = c["finishReason"]
    if blocked and not got:
        raise LLMError("이 이야기는 냥이가 답하기 어렵다냥. 다르게 물어봐 줄래?")
    if not got:
        raise LLMError("냥이가 말을 고르다 멈췄다냥. 한 번만 다시 눌러 줘!")


# ---------------------------------------------------------------- Claude (선택)
def _claude(system, messages, max_tokens) -> Iterator[str]:
    import anthropic

    client = anthropic.Anthropic()
    try:
        with client.messages.stream(
            model=os.environ.get("SAJU_MODEL", "claude-haiku-5-5"),
            max_tokens=max_tokens,
            system=[{"type": "text", "text": system, "cache_control": {"type": "ephemeral"}}],
            messages=messages,
        ) as s:
            yield from s.text_stream
    except anthropic.RateLimitError as e:
        raise LLMError("지금 상담하러 온 사람이 많다냥. 잠시 후 다시 불러줘!") from e
    except anthropic.APIStatusError as e:
        raise LLMError(f"냥이가 잠깐 졸았다냥 (오류 {e.status_code})") from e
    except anthropic.APIConnectionError as e:
        raise LLMError("냥이와 연결이 끊겼다냥. 다시 시도해 줘!") from e
