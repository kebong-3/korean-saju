"""사주냥이 웹앱 백엔드 (Vercel FastAPI 엔트리포인트).

- 사주 계산: ksaju 엔진 (천문 계산 만세력, 결정적·무료)
- 운세 점수·맞춤·개운법: sajunyang.fortune (엔진 결과에 규칙 적용, 결정적·무료)
- AI 풀이·상담(선택): Gemini(기본) 또는 Claude가 위 두 결과만 근거로 '사주냥이 도사'로서 이야기한다.
  키가 없으면 규칙 기반 서술형 풀이로 대신한다. (sajunyang/llm.py 참고)
- 화면: public/ (Vercel CDN이 서빙, 로컬에선 아래 mount로 서빙)
"""
from __future__ import annotations

import json
import os
import re
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
from sajunyang import counsel, llm, ogo, persona, readings  # noqa: E402
from sajunyang.fortune import bundle, day_fortune, hourly  # noqa: E402

# 냥이 도사 이야기(규칙 기반 서술형). 모듈 하나가 실패해도 나머지와 계산 결과는 그대로 나간다.
def _opt(mod: str):
    try:
        return __import__(f"sajunyang.{mod}", fromlist=[mod])
    except Exception as e:  # noqa: BLE001
        print(f"[story] {mod} 불러오기 실패: {e!r}")
        return None


story_me, story_luck, story_compat = _opt("story_me"), _opt("story_luck"), _opt("story_compat")


def _safe(fn, *args, **kw):
    try:
        return fn(*args, **kw)
    except Exception as e:  # noqa: BLE001
        print(f"[story] {getattr(fn, '__module__', '')}.{getattr(fn, '__name__', fn)} 실패: {e!r}")
        return None

app = FastAPI(title="사주냥이", docs_url=None, redoc_url=None)

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
def status(check: int = 0):
    """키 값은 절대 내보내지 않는다 — 어느 이름으로 읽혔는지만. ?check=1 이면 실제로 짧게 호출해 본다."""
    p = llm.provider()
    out = {"ai": p["name"] is not None, "provider": p["name"], "key_from": p["key_from"], "key_format_ok": p["looks_ok"]}
    if check and p["name"]:
        try:
            txt = "".join(llm.stream("한 단어로만 답해.", [{"role": "user", "content": "고양이 울음소리?"}], max_tokens=200))
            out.update({"live": "ok", "sample": txt[:40], "model": llm.LAST_MODEL.get("name")})
        except llm.LLMError as e:
            out.update({"live": "error", "error": str(e)})
    return out


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
    d["이야기"] = _stories(r, d["운세"], b.name.strip())
    return d


def _stories(r, fx: dict, name: str) -> dict:
    out = {}
    if story_me:
        out["사주"] = _safe(story_me.build, r, name)
    if story_luck:
        out["오늘"] = _safe(story_luck.today, r, fx["오늘운세"], fx["시간대"], name)
        out["신년"] = _safe(story_luck.year, r, fx["신년운세"], name)
        out["평생"] = _safe(story_luck.life, r, fx["평생운"], fx["앞으로10년"], name)
    return out


class DayReq(BaseModel):
    birth: Birth
    day: date


@app.post("/api/day")
def day(req: DayReq):
    if abs((req.day - today_kst()).days) > 400:
        raise HTTPException(400, "냥이 달력은 앞뒤 1년까지만 본다냥")
    r = _reading(req.birth)
    df, hr = day_fortune(r, req.day), hourly(r, req.day)
    st = _safe(story_luck.today, r, df, hr, req.birth.name.strip()) if story_luck else None
    return {"운세": df, "시간대": hr, "이야기": st}


@app.post("/api/compat")
def compat(req: CompatReq):
    r1, r2 = _reading(req.a), _reading(req.b)
    res = read_compatibility(r1, r2)
    res["names"] = [req.a.name.strip() or "나", req.b.name.strip() or "상대"]
    res["띠"] = [r1.to_dict()["입력"]["띠"], r2.to_dict()["입력"]["띠"]]
    if story_compat:
        res["이야기"] = _safe(story_compat.build, r1, r2, res, [req.a.name.strip(), req.b.name.strip()])
    return res


# ---------------------------------------------------------------- AI (Gemini 기본 / Claude 선택)
SYSTEM = persona.SYSTEM + "\n\n해석 기준표\n" + GUIDE
CRISIS = re.compile(r"(죽고\s*싶|자살|사라지고\s*싶|살기\s*싫|자해|목숨|끝내고\s*싶)")
CRISIS_MSG = ("말해 줘서 정말 고마워. 지금 많이 힘들구나… 냥이는 네가 꼭 괜찮았으면 좋겠다냥.\n\n"
              "이건 사주보다 사람의 도움이 먼저 필요한 순간이다냥. 지금 바로 **자살예방상담전화 109**(24시간)나 "
              "**정신건강위기상담 1577-0199**에 전화해 줄래? 위급하면 **119**.\n\n혼자 버티지 않아도 된다냥. 🐾")


def _ai_ready() -> bool:
    return llm.ready()


def _context(req: AIReq) -> str:
    r = _reading(req.birth)
    fx = bundle(r, today_kst())
    who = req.birth.name.strip() or "사용자"
    ctx = (f"<saju who=\"{who}\">\n{r.to_compact()}\n</saju>\n"
           f"<fortune who=\"{who}\">\n{readings.compact_fortune(fx)}\n</fortune>")
    if req.partner:
        r2 = _reading(req.partner)
        who2 = req.partner.name.strip() or "상대"
        ctx += f"\n<saju who=\"{who2}\">\n{r2.to_compact()}\n</saju>"
        ctx += "\n<compat>\n" + json.dumps(read_compatibility(r, r2), ensure_ascii=False) + "\n</compat>"
    return ctx + f"\n오늘 날짜(KST): {today_kst().isoformat()}"


GREETING = "냥이야, 나 왔어. 내 사주를 보고 먼저 짧게 인사해 줘. 내 타고난 성향 한 가지와 요즘 운 흐름 한 가지만 말해 주고, 무슨 고민이 있는지 물어봐 줘."


def _stream_llm(system: str, messages: list[dict], max_tokens: int):
    def gen():
        try:
            for text in llm.stream(system, messages, max_tokens=max_tokens):
                yield _sse({"t": text})
        except llm.LLMError as e:
            yield _sse({"error": str(e)})
        except Exception:  # noqa: BLE001
            yield _sse({"error": "냥이가 잠깐 졸았다냥. 다시 시도해 줘!"})
        yield _sse({"done": True})
    return StreamingResponse(gen(), media_type="text/event-stream",
                             headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"})


def _stream_text(text: str, **flags):
    def gen():
        for k in range(0, len(text), 60):
            yield _sse({"t": text[k:k + 60]})
        yield _sse({**flags, "done": True})
    return StreamingResponse(gen(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"})


@app.post("/api/ai")
def ai(req: AIReq):
    if not _ai_ready():
        raise HTTPException(503, "AI 상담이 아직 설정되지 않았다냥 (Gemini API 키 필요)")
    history = [m.model_dump() for m in req.messages]
    if not history or history[0]["role"] != "user":
        history.insert(0, {"role": "user", "content": GREETING})
    if history[-1]["role"] != "user":
        raise HTTPException(400, "마지막 메시지는 사용자 질문이어야 한다냥")
    if CRISIS.search(history[-1]["content"]):
        return _stream_text(CRISIS_MSG)
    # 계산 결과는 서버에서 다시 만들어 첫 메시지 앞에 붙인다(클라이언트가 조작할 수 없음).
    history[0] = {"role": "user", "content": _context(req) + "\n\n" + history[0]["content"]}
    return _stream_llm(SYSTEM, history, 3000)


# ---------------------------------------------------------------- 냥이 도사 서술형 대풀이
class ReadingReq(BaseModel):
    birth: Birth
    kind: str
    partner: Optional[Birth] = None
    day: Optional[date] = None
    text: str = Field(default="", max_length=600)


@app.get("/api/readings")
def reading_menu():
    return [{"id": k, "title": v[0], "icon": v[1], "desc": v[2]} for k, v in readings.KINDS.items()]


@app.post("/api/reading")
def reading(req: ReadingReq):
    if req.kind not in readings.KINDS:
        raise HTTPException(400, "그런 풀이는 냥이도 처음 듣는다냥")
    if req.kind == "compat" and not req.partner:
        raise HTTPException(400, "궁합은 상대방 생일이 필요하다냥")
    if req.kind == "dream" and not req.text.strip():
        raise HTTPException(400, "어떤 꿈을 꿨는지 적어 달라냥")
    if CRISIS.search(req.text):
        return _stream_text(CRISIS_MSG)
    today = today_kst()
    if req.day and abs((req.day - today).days) > 400:
        raise HTTPException(400, "냥이 달력은 앞뒤 1년까지만 본다냥")
    r = _reading(req.birth)
    fx = bundle(r, today)
    who = req.birth.name.strip() or "사용자"
    r2, who2 = (None, "")
    if req.partner:
        r2, who2 = _reading(req.partner), (req.partner.name.strip() or "상대")
    extra = readings.extra_for(req.kind, r, fx, today, req.day, req.text.strip())
    if not _ai_ready():
        return _stream_text(readings.fallback(req.kind, who, r, fx, extra, r2, who2), fallback=True)
    prompt = readings.user_prompt(req.kind, who, r, fx, extra, r2, who2)
    return _stream_llm(readings.system_for(req.kind) + "\n\n해석 기준표\n" + GUIDE,
                       [{"role": "user", "content": prompt}], 9000)


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


# ---------------------------------------------------------------- 로컬 개발용 정적 파일
if not os.environ.get("VERCEL") and (ROOT / "public").is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="public")
