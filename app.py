"""사주냥이 웹앱 백엔드 (Vercel FastAPI 엔트리포인트).

- 사주 계산: ksaju 엔진 (천문 계산 만세력, 결정적·무료)
- 운세 점수·맞춤·개운법: sajunyang.fortune (엔진 결과에 규칙 적용, 결정적·무료)
- AI 상담(선택): Claude가 위 두 결과만 근거로 '사주냥이'로서 상담. ANTHROPIC_API_KEY가 없으면 AI만 꺼진다.
- 화면: public/ (Vercel CDN이 서빙, 로컬에선 아래 mount로 서빙)
"""
from __future__ import annotations

import json
import os
import sys
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Literal, Optional

from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))
sys.path.insert(0, str(ROOT))

from ksaju import read_compatibility, read_saju  # noqa: E402
from ksaju.core import BRANCH_ELEMENT, ELEMENTS  # noqa: E402
from sajunyang import counsel, ogo, persona  # noqa: E402
from sajunyang.fortune import bundle  # noqa: E402

app = FastAPI(title="사주냥이", docs_url=None, redoc_url=None)

MODEL = os.environ.get("SAJU_MODEL", "claude-opus-5-5")
GUIDE = (ROOT / "skills/saju-reading/references/interpretation-guide.md").read_text(encoding="utf-8")
KST = timezone(timedelta(hours=9))


def today_kst() -> date:
    return datetime.now(KST).date()


# ---------------------------------------------------------------- 입력 모델
class Birth(BaseModel):
    year: int = Field(ge=1900, le=2100)
    month: int = Field(ge=1, le=12)
    day: int = Field(ge=1, le=31)
    hour: Optional[int] = Field(default=None, ge=0, le=23)
    minute: int = Field(default=0, ge=0, le=59)
    gender: Literal["남", "여"] = "여"
    calendar: Literal["solar", "lunar"] = "solar"
    leap: bool = False
    longitude: float = Field(default=127.0, ge=124.0, le=132.0)
    zi_mode: Literal["unified", "split"] = "unified"
    name: str = Field(default="", max_length=20)


class CompatReq(BaseModel):
    a: Birth
    b: Birth


class ChatMsg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=4000)


class AIReq(BaseModel):
    birth: Birth
    partner: Optional[Birth] = None
    messages: list[ChatMsg] = Field(default_factory=list, max_length=30)


def _reading(b: Birth):
    try:
        return read_saju(b.year, b.month, b.day, b.hour, b.minute, gender=b.gender,
                         calendar=b.calendar, leap=b.leap, longitude=b.longitude,
                         zi_mode=b.zi_mode, name=b.name.strip(), today=today_kst())
    except (ValueError, KeyError) as e:
        raise HTTPException(400, f"날짜를 확인해 달라냥: {e}") from e


# ---------------------------------------------------------------- 계산 API
@app.get("/api/status")
def status():
    return {"ai": _ai_ready()}


@app.get("/api/meta")
def meta():
    return {"profile": persona.PROFILE,
            "glossary": {k: {"뜻": v[0], "냥이": v[1]} for k, v in persona.GLOSSARY.items()},
            "stories": persona.STORIES}


@app.post("/api/saju")
def saju(b: Birth):
    r = _reading(b)
    d = r.to_dict()
    d["이름"] = b.name.strip()
    d["지지오행"] = {p.label: ELEMENTS[BRANCH_ELEMENT[p.branch]] for p in r.chart.pillars}
    d["운세"] = bundle(r, today_kst())
    d["옛이야기"] = persona.pick_story(r.analysis, {s.name for s in r.analysis.sinsal})
    d["상담"] = counsel.build(r, d["운세"], d["옛이야기"])
    d["오고"] = ogo.build(r, d["운세"])
    d["납음"] = {p.label: ogo.NAEUM[p.index // 2] for p in r.chart.pillars}
    return d


@app.post("/api/compat")
def compat(req: CompatReq):
    r1, r2 = _reading(req.a), _reading(req.b)
    res = read_compatibility(r1, r2)
    res["names"] = [req.a.name.strip() or "나", req.b.name.strip() or "상대"]
    res["띠"] = [r1.to_dict()["입력"]["띠"], r2.to_dict()["입력"]["띠"]]
    return res


# ---------------------------------------------------------------- AI 상담
SYSTEM = persona.SYSTEM + "\n\n해석 기준표\n" + GUIDE


def _ai_ready() -> bool:
    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        return False
    try:
        import anthropic  # noqa: F401
    except ImportError:
        return False
    return True


def _fortune_summary(fx: dict) -> str:
    y, life, mt, t = fx["신년운세"], fx["평생운"], fx["맞춤"], fx["오늘운세"]
    cur = life["현재"]
    return "\n".join([
        f"오늘({t['date']}) {t['일진']} 점수{t['점수']}({t['등급']}) {t['십성']}",
        f"{y['연도']}년 {y['간지']} '{y['테마']}' 총운{y['총운']} " + " ".join(f"{k}{v}" for k, v in y["분야"].items()),
        f"{y['연도']}년 월별점수 " + " ".join(f"{m['월']}월{m['점수']}" for m in y["월별"])
        + f" | 좋은달 {y['좋은달']} 조심할달 {y['조심할달']}",
        "대운점수 " + " ".join(f"{p['나이']}세{p['간지']}{p['점수']}" for p in life["대운"])
        + (f" | 현재 {cur['나이']}세 대운" if cur else ""),
        f"맞춤: 직업유형 {mt['직업']['유형']}({mt['직업']['추천']}) 잘맞는띠 {mt['잘맞는띠']} 조심할띠 {mt['조심할띠']} 행운색 {mt['행운의색']}",
    ])


def _context(req: AIReq) -> str:
    r = _reading(req.birth)
    fx = bundle(r, today_kst())
    who = req.birth.name.strip() or "사용자"
    ctx = (f"<saju who=\"{who}\">\n{r.to_compact()}\n</saju>\n"
           f"<fortune who=\"{who}\">\n{_fortune_summary(fx)}\n</fortune>")
    if req.partner:
        r2 = _reading(req.partner)
        who2 = req.partner.name.strip() or "상대"
        ctx += f"\n<saju who=\"{who2}\">\n{r2.to_compact()}\n</saju>"
        ctx += "\n<compat>\n" + json.dumps(read_compatibility(r, r2), ensure_ascii=False) + "\n</compat>"
    return ctx + f"\n오늘 날짜(KST): {today_kst().isoformat()}"


GREETING = "냥이야, 나 왔어. 내 사주를 보고 먼저 짧게 인사해 줘. 내 타고난 성향 한 가지와 요즘 운 흐름 한 가지만 말해 주고, 무슨 고민이 있는지 물어봐 줘."


@app.post("/api/ai")
def ai(req: AIReq):
    if not _ai_ready():
        raise HTTPException(503, "AI 상담이 아직 설정되지 않았다냥 (ANTHROPIC_API_KEY 필요)")
    import anthropic

    history = [m.model_dump() for m in req.messages]
    if not history or history[0]["role"] != "user":
        history.insert(0, {"role": "user", "content": GREETING})
    if history[-1]["role"] != "user":
        raise HTTPException(400, "마지막 메시지는 사용자 질문이어야 한다냥")
    # 계산 결과는 서버에서 다시 만들어 첫 메시지 앞에 붙인다(클라이언트가 조작할 수 없음).
    history[0] = {"role": "user", "content": _context(req) + "\n\n" + history[0]["content"]}

    client = anthropic.Anthropic()

    def gen():
        try:
            with client.beta.messages.stream(
                model=MODEL,
                max_tokens=2500,
                system=[{"type": "text", "text": SYSTEM, "cache_control": {"type": "ephemeral"}}],
                messages=history,
                output_config={"effort": "low"},
                betas=["server-side-fallback-2026-07-01"],
                fallbacks="default",
            ) as stream:
                for text in stream.text_stream:
                    yield _sse({"t": text})
                if stream.get_final_message().stop_reason == "refusal":
                    yield _sse({"error": "이 이야기는 냥이가 답하기 어렵다냥. 다르게 물어봐 줄래?"})
        except anthropic.RateLimitError:
            yield _sse({"error": "지금 상담하러 온 사람이 많다냥. 잠시 후 다시 불러줘!"})
        except anthropic.APIStatusError as e:
            yield _sse({"error": f"냥이가 잠깐 졸았다냥 (오류 {e.status_code})"})
        except anthropic.APIConnectionError:
            yield _sse({"error": "냥이와 연결이 끊겼다냥. 다시 시도해 줘!"})
        yield _sse({"done": True})

    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


# ---------------------------------------------------------------- 로컬 개발용 정적 파일
if not os.environ.get("VERCEL") and (ROOT / "public").is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="public")
