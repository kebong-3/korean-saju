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

from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.responses import HTMLResponse, StreamingResponse
from pydantic import BaseModel, Field, field_validator

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
journey = _opt("journey")
ipmyeong = _opt("ipmyeong")
relation = _opt("relation")
share_store = _opt("share_store")
family = _opt("family")
taegil = _opt("taegil")
push = _opt("push")
season = _opt("season")
ilju = _opt("ilju")
pae = _opt("pae")
sinsal_story = _opt("sinsal_story")


def _safe(fn, *args, **kw):
    try:
        return fn(*args, **kw)
    except Exception as e:  # noqa: BLE001
        print(f"[story] {getattr(fn, '__module__', '')}.{getattr(fn, '__name__', fn)} 실패: {e!r}")
        return None

app = FastAPI(title="사주냥이", docs_url=None, redoc_url=None, openapi_url=None)

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
    # 기초정보(계산에는 안 쓰고 풀이·상담의 말투와 주제를 바꾸는 데만 쓴다)
    marital: Literal["", "미혼", "연애중", "기혼", "기타"] = ""
    kids: int = Field(default=0, ge=0, le=10)

    @field_validator("name")
    @classmethod
    def _clean_name(cls, v: str) -> str:
        # 프롬프트 태그(<saju who="…">)를 깨지 않도록 꺾쇠·따옴표·줄바꿈 제거
        return re.sub(r"[<>\"\r\n]", "", v).strip()


def _prof(b: Birth) -> dict:
    return {"결혼": b.marital, "자녀": b.kids}


def _call(fn, *args, prof=None):
    """이야기 함수에 기초정보(prof)를 넘기되, 아직 prof를 모르는 함수면 빼고 부른다."""
    try:
        return fn(*args, prof=prof)
    except TypeError as e:
        if "prof" not in str(e):
            raise
        return fn(*args)


class CompatReq(BaseModel):
    a: Birth
    b: Birth


class ChatMsg(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(max_length=8000)


class AIReq(BaseModel):
    birth: Birth
    partner: Optional[Birth] = None
    partner_role: Literal["love", "child"] = "love"
    messages: list[ChatMsg] = Field(default_factory=list, max_length=20)
    memo: list[str] = Field(default_factory=list, max_length=6)  # 폰에만 저장된 지난 고민·약속 요약(서버 저장 안 함)


def _nim(name: str) -> str:
    """사용자를 부를 땐 이름 뒤에 '님'(이미 붙어 있으면 그대로). 이름이 없으면 빈 문자열."""
    s = (name or "").strip()
    return s if not s or s.endswith("님") else f"{s}님"


def _reading(b: Birth, who: str = ""):
    import calendar as _cal
    if b.calendar == "solar":
        last = _cal.monthrange(b.year, b.month)[1]
        if b.day > last:
            raise HTTPException(400, f"{who}{b.year}년 {b.month}월은 {last}일까지다냥")
    try:
        return read_saju(b.year, b.month, b.day, b.hour, b.minute, gender=b.gender,
                         calendar=b.calendar, leap=b.leap, longitude=b.longitude,
                         zi_mode=b.zi_mode, name=b.name.strip(), today=today_kst())
    except (ValueError, KeyError) as e:
        raise HTTPException(400, f"{who}날짜를 확인해 달라냥: {e}") from e


# ---------------------------------------------------------------- 계산 API
@app.get("/api/status")
def status(check: int = 0):
    """키 값은 절대 내보내지 않는다 — 어느 이름으로 읽혔는지만. ?check=1 이면 실제로 짧게 호출해 본다."""
    p = llm.provider()
    out = {"ai": p["name"] is not None, "provider": p["name"], "key_from": p["key_from"], "key_format_ok": p["looks_ok"],
           "share": bool(share_store and share_store.configured()),
           "push_key": push.public_key() if push and share_store and share_store.configured() else None}
    if check and p["name"]:
        try:
            txt = "".join(llm.stream("한 단어로만 답해.", [{"role": "user", "content": "고양이 울음소리?"}], max_tokens=200))
            out.update({"live": "ok", "sample": txt[:40], "model": llm.LAST_MODEL.get("name")})
        except llm.LLMError as e:
            out.update({"live": "error", "error": str(e)})
    return out


@app.get("/api/meta")
def meta(response: Response):
    response.headers["Cache-Control"] = "public, max-age=3600, s-maxage=86400"
    return {"profile": persona.PROFILE,
            "glossary": {k: {"뜻": v[0], "냥이": v[1]} for k, v in persona.GLOSSARY.items()},
            "stories": persona.STORIES,
            "sinsal": ({"설명": {k: sinsal_story.detail(k) for k in sinsal_story.INFO},
                        "자리": sinsal_story.POS_TXT, "줄": sinsal_story.ROW_TXT} if sinsal_story else {})}


@app.get("/api/terms")
def terms(response: Response):
    response.headers["Cache-Control"] = "public, max-age=86400"
    return {"절기": season.all_terms() if season else []}


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
    d["이야기"] = _stories(r, d["운세"], _nim(b.name), _prof(b))
    seed = f"{b.year}{b.month}{b.day}{b.hour}{b.gender}"
    if journey:
        d["나의길"] = _safe(journey.build, r, d["운세"], today_kst(), seed)
    if ipmyeong:
        d["입명"] = _safe(ipmyeong.build, r, d["운세"], today_kst(), seed)
    if ilju:
        d["냥이카드"] = _safe(ilju.of_reading, r)
    if season:
        d["절기"] = _safe(season.current, datetime.utcnow() + timedelta(hours=9))
    if pae:
        t0 = d["운세"]["오늘운세"]
        d["오늘의패"] = _safe(pae.draw, t0["십성"], t0["date"], seed)
    if sinsal_story:
        d["신살표"] = _safe(_manse_sinsal, r)
        if d["신살표"]:
            d["신살이야기"] = _safe(sinsal_story.build, r, d["신살표"], _nim(b.name), today_kst())
        d["운줄"] = _safe(sinsal_story.luck_rows, r, today_kst())
        d["관계"] = [{"종류": x.kind, "글자": x.members, "설명": x.detail} for x in r.analysis.relations]
    if relation:
        d["나의유형"] = relation.person_type(r)
        d["나의올해"] = relation.year_type(r, d["운세"]["신년운세"]["연도"])
    syn = (d.get("오고") or {}).get("synth") or {}
    rx = syn.get("계절처방")
    gw = d["운세"].get("개운법")
    if gw is not None:
        if rx and rx != r.analysis.yongshin:
            gw["조후"] = (f"계절 처방으로는 {rx} 기운도 필요하다냥 — "
                         + ("덥고 건조한 사주라 물·휴식으로 열을 식혀 주기" if rx == "수" else "차고 습한 사주라 햇볕·운동으로 몸을 데우기")
                         + " (보약은 그대로, 온도 조절용으로만!)")
        else:
            gw["조후"] = ""
    return d


def _manse_sinsal(r):
    from ksaju import sinsal as _ss
    return _ss.natal(r.chart)


def _stories(r, fx: dict, name: str, prof: dict | None = None) -> dict:
    out = {}
    if story_me:
        out["사주"] = _safe(_call, story_me.build, r, name, prof=prof)
    if story_luck:
        out["오늘"] = _safe(_call, story_luck.today, r, fx["오늘운세"], fx["시간대"], name, prof=prof)
        out["신년"] = _safe(_call, story_luck.year, r, fx["신년운세"], name, prof=prof)
        out["평생"] = _safe(_call, story_luck.life, r, fx["평생운"], fx["앞으로10년"], name, prof=prof)
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
    st = _safe(_call, story_luck.today, r, df, hr, _nim(req.birth.name), prof=_prof(req.birth)) if story_luck else None
    return {"운세": df, "시간대": hr, "이야기": st}


@app.post("/api/compat")
def compat(req: CompatReq):
    r1, r2 = _reading(req.a, "내 생일: "), _reading(req.b, "상대 생일: ")
    res = read_compatibility(r1, r2)
    res["names"] = [req.a.name.strip() or "나", req.b.name.strip() or "상대"]
    res["띠"] = [r1.to_dict()["입력"]["띠"], r2.to_dict()["입력"]["띠"]]
    if story_compat:
        res["이야기"] = _safe(story_compat.build, r1, r2, res, [_nim(req.a.name), req.b.name.strip()])
    return res


# ---------------------------------------------------------------- 자녀 궁합
class FamilyReq(BaseModel):
    parent: Birth
    child: Birth


def _family(req: FamilyReq):
    rp, rc = _reading(req.parent), _reading(req.child)
    names = [req.parent.name.strip(), req.child.name.strip()]
    res = _safe(family.build, rp, rc, names, today_kst()) if family else None
    dc = rc.to_dict()
    return rp, rc, res, {"names": [names[0] or "나", names[1] or "아이"], "자녀": {
        "일주": f"{rc.chart.day.hanja}({rc.chart.day.hangul})",
        "띠": dc["입력"]["띠"], "나이": today_kst().year - rc.chart.birth.year}}


@app.post("/api/family")
def family_compat(req: FamilyReq):
    _, _, res, meta = _family(req)
    if not res:
        raise HTTPException(503, "자녀 궁합 풀이를 준비하는 중이다냥. 잠시 후 다시 와 줘!")
    return {**meta, "이야기": res}


# ---------------------------------------------------------------- AI (Gemini 기본 / Claude 선택)
SYSTEM = persona.SYSTEM + "\n\n해석 기준표\n" + GUIDE
CRISIS = re.compile(r"(죽고\s*싶|죽어\s*버리고|죽고\s*말|죽는\s*게\s*나|죽을\s*래|자살(?!골)|자해|극단\s*적\s*(인\s*)?선택|스스로\s*목숨|목숨을\s*끊|"
                    r"사라지고\s*싶|사라져\s*버리|없어지고\s*싶|없어져\s*버리|살(기|고)\s*(가\s*)?싫|살고\s*싶지\s*않|그만\s*살|더\s*(는\s*)?못\s*살|"
                    r"살\s*이유가?\s*없|사는\s*게\s*(의미|무의미)|뛰어\s*내리|목을?\s*매|(다|삶을|인생을?)\s*끝내|세상을?\s*떠나고|suicid|kill\s*myself|want\s*to\s*die)", re.I)
CRISIS_MSG = ("말해 줘서 정말 고마워. 지금 많이 힘들구나… 냥이는 네가 꼭 괜찮았으면 좋겠다냥.\n\n"
              "이건 사주보다 사람의 도움이 먼저 필요한 순간이다냥. 지금 바로 **자살예방상담전화 109**(24시간)나 "
              "**정신건강위기상담 1577-0199**에 전화해 줄래? 위급하면 **119**.\n\n혼자 버티지 않아도 된다냥. 🐾")


def _ai_ready() -> bool:
    return llm.ready()


def _context(req: AIReq) -> str:
    r = _reading(req.birth)
    fx = bundle(r, today_kst())
    who = _nim(req.birth.name) or "사용자"
    ctx = (readings.profile_line(_prof(req.birth)) + f"<saju who=\"{who}\">\n{r.to_compact()}\n</saju>\n"
           f"<fortune who=\"{who}\">\n{readings.compact_fortune(fx)}\n</fortune>")
    if req.partner:
        r2 = _reading(req.partner)
        if req.partner_role == "child":
            who2 = req.partner.name.strip() or "아이"
            ctx += f"\n<saju who=\"{who2}(자녀, {today_kst().year - r2.chart.birth.year}세)\">\n{r2.to_compact()}\n</saju>"
            fam = _safe(family.build, r, r2, [_nim(req.birth.name), req.partner.name.strip()], today_kst()) if family else None
            ctx += "\n<child_compat>\n" + json.dumps(readings.family_digest(fam), ensure_ascii=False) + "\n</child_compat>"
        else:
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
    if sum(len(m["content"]) for m in history) > 24000:
        raise HTTPException(413, "대화가 너무 길어졌다냥. 새로 시작해 줘!")
    if not history or history[0]["role"] != "user":
        history.insert(0, {"role": "user", "content": GREETING})
    if history[-1]["role"] != "user":
        raise HTTPException(400, "마지막 메시지는 사용자 질문이어야 한다냥")
    if CRISIS.search(history[-1]["content"]):
        return _stream_text(CRISIS_MSG)
    # 계산 결과는 서버에서 다시 만들어 첫 메시지 앞에 붙인다(클라이언트가 조작할 수 없음).
    memo = [re.sub(r"[<>]", "", m)[:120] for m in req.memo if m.strip()][:6]
    mem = ("\n<memory note=\"사용자 폰에 저장된 지난 상담 요약. 자연스럽게 이어서 안부를 물어도 되지만 사실로 단정하지 말 것\">\n"
           + "\n".join(f"- {m}" for m in memo) + "\n</memory>") if memo else ""
    history[0] = {"role": "user", "content": _context(req) + mem + "\n\n" + history[0]["content"]}
    return _stream_llm(SYSTEM, history, 1500)


# ---------------------------------------------------------------- 냥이 도사 서술형 대풀이
class ReadingReq(BaseModel):
    birth: Birth
    kind: str
    partner: Optional[Birth] = None
    day: Optional[date] = None
    text: str = Field(default="", max_length=2000)
    long: bool = False


@app.get("/api/readings")
def reading_menu():
    return [{"id": k, "title": v[0], "icon": v[1], "desc": v[2]} for k, v in readings.KINDS.items()]


@app.post("/api/reading")
def reading(req: ReadingReq):
    if req.kind not in readings.KINDS:
        raise HTTPException(400, "그런 풀이는 냥이도 처음 듣는다냥")
    if req.kind in ("compat", "child") and not req.partner:
        raise HTTPException(400, "궁합은 상대방 생일이 필요하다냥")
    if req.kind == "journey" and not req.text.strip():
        raise HTTPException(400, "먼저 지난 해에 있었던 일을 한두 개라도 기록해 달라냥")
    if req.kind == "dream" and not req.text.strip():
        raise HTTPException(400, "어떤 꿈을 꿨는지 적어 달라냥")
    if CRISIS.search(req.text):
        return _stream_text(CRISIS_MSG)
    today = today_kst()
    if req.day and abs((req.day - today).days) > 400:
        raise HTTPException(400, "냥이 달력은 앞뒤 1년까지만 본다냥")
    r = _reading(req.birth)
    fx = bundle(r, today)
    who = _nim(req.birth.name) or "사용자"
    r2, who2 = (None, "")
    if req.partner:
        r2, who2 = _reading(req.partner), (req.partner.name.strip() or "상대")
    extra = readings.extra_for(req.kind, r, fx, today, req.day, req.text.strip())
    if req.kind == "child":
        res = _safe(family.build, r, r2, [_nim(req.birth.name), req.partner.name.strip()], today) if family else None
        extra = {"자녀궁합": readings.family_digest(res), "자녀나이": today.year - r2.chart.birth.year}
    if not _ai_ready():
        return _stream_text(readings.fallback(req.kind, who, r, fx, extra, r2, who2), fallback=True)
    prompt = readings.profile_line(_prof(req.birth)) + readings.user_prompt(req.kind, who, r, fx, extra, r2, who2)
    return _stream_llm(readings.system_for(req.kind, req.long) + "\n\n해석 기준표\n" + GUIDE,
                       [{"role": "user", "content": prompt}], 9000 if req.long else 2500)


def _sse(obj: dict) -> str:
    return "data: " + json.dumps(obj, ensure_ascii=False) + "\n\n"


# ---------------------------------------------------------------- Vercel OIDC(Blob 자격 증명)
# Blob 스토어를 프로젝트에 연결하면 BLOB_STORE_ID + 요청 헤더의 OIDC 토큰으로 인증한다.
# 런타임이 헤더를 SDK에 넘겨주지 않는 경우를 대비해 요청마다 직접 등록한다.
@app.middleware("http")
async def _vercel_oidc(request, call_next):
    tok = request.headers.get("x-vercel-oidc-token")
    if tok:
        os.environ["VERCEL_OIDC_TOKEN"] = tok
        try:
            from vercel.headers import set_headers
            set_headers({k: v for k, v in request.headers.items()})
        except Exception:  # noqa: BLE001
            pass
    return await call_next(request)


# ---------------------------------------------------------------- 관계 지도(귀인 지도)
def _target_year() -> int:
    t = today_kst()
    return t.year + 1 if t.month >= 10 else t.year


def _nick(v: str) -> str:
    v = re.sub(r"[<>\"\r\n]", "", v or "").strip()[:12]
    if not v:
        raise HTTPException(400, "별명을 적어 달라냥")
    return v


class TaegilReq(BaseModel):
    birth: Birth
    purpose: Literal["move", "contract", "interview", "date", "exam", "start"] = "move"


@app.post("/api/taegil")
def taegil_api(req: TaegilReq):
    """택일 도우미: 앞으로 60일 중 목적에 맞는 날(규칙 기반, 무료)."""
    if not taegil:
        raise HTTPException(503, "택일 도우미를 준비 중이다냥")
    return taegil.pick(_reading(req.birth), req.purpose, today_kst(), 60)


# ---------------------------------------------------------------- 기록 백업(복구 코드)
# 브라우저가 복구 코드로 AES-GCM 암호화한 덩어리만 받는다. 서버는 코드도, 내용도 모른다.
_BID = re.compile(r"[0-9a-f]{32}")
BACKUP_DAYS = 400


class BackupReq(BaseModel):
    id: str = Field(pattern=r"^[0-9a-f]{32}$")
    iv: str = Field(min_length=8, max_length=40, pattern=r"^[A-Za-z0-9+/=]+$")
    ct: str = Field(min_length=16, max_length=600_000, pattern=r"^[A-Za-z0-9+/=]+$")


def _need_store():
    if not (share_store and share_store.configured()):
        raise HTTPException(503, "백업 저장소를 준비 중이다냥")


@app.post("/api/backup")
def backup_put(req: BackupReq):
    _need_store()
    try:
        share_store.put_doc(f"backups/{req.id}", {"iv": req.iv, "ct": req.ct, "at": today_kst().isoformat()})
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    return {"ok": True}


@app.get("/api/backup/{bid}")
def backup_get(bid: str, response: Response):
    _need_store()
    response.headers["Cache-Control"] = "no-store"
    if not _BID.fullmatch(bid):
        raise HTTPException(404, "복구 코드를 찾을 수 없다냥")
    try:
        rec = share_store.get_doc(f"backups/{bid}")
        if rec and (today_kst() - date.fromisoformat(rec.get("at", "2000-01-01"))).days > BACKUP_DAYS:
            share_store.del_doc(f"backups/{bid}")
            rec = None
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    if not rec:
        raise HTTPException(404, "그 복구 코드로 저장된 기록이 없다냥 (코드를 다시 확인하거나, 400일이 지나 지워졌을 수 있어)")
    return {"iv": rec["iv"], "ct": rec["ct"], "at": rec.get("at")}


@app.delete("/api/backup/{bid}")
def backup_del(bid: str):
    _need_store()
    if not _BID.fullmatch(bid):
        raise HTTPException(404, "복구 코드를 찾을 수 없다냥")
    try:
        share_store.del_doc(f"backups/{bid}")
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    return {"ok": True}


# ---------------------------------------------------------------- 아침 운세 알림(웹 푸시)
class PushKeys(BaseModel):
    p256dh: str = Field(max_length=200)
    auth: str = Field(max_length=60)


class PushSub(BaseModel):
    endpoint: str = Field(max_length=800)
    keys: PushKeys


class PushReq(BaseModel):
    sub: PushSub
    ilgan: int = Field(ge=0, le=9)
    yong: list[Literal["목", "화", "토", "금", "수"]] = Field(default_factory=list, max_length=2)


class UnpushReq(BaseModel):
    endpoint: str = Field(max_length=800)


def _need_push():
    if not (push and push.public_key() and share_store and share_store.configured()):
        raise HTTPException(503, "아침 알림을 준비 중이다냥")


@app.post("/api/push")
def push_subscribe(req: PushReq):
    """생년월일 없이 일간·용신만 받아 둔다(알림 문구용)."""
    _need_push()
    if not push.endpoint_ok(req.sub.endpoint):
        raise HTTPException(400, "지원하지 않는 알림 주소다냥")
    rec = {"sub": req.sub.model_dump(), "ilgan": req.ilgan, "yong": req.yong, "at": today_kst().isoformat()}
    try:
        share_store.put_doc(push.key_of(req.sub.endpoint), rec, index=push.INDEX)
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    return {"ok": True}


@app.post("/api/push/off")
def push_unsubscribe(req: UnpushReq):
    _need_push()
    try:
        share_store.del_doc(push.key_of(req.endpoint), index=push.INDEX)
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    return {"ok": True}


@app.get("/api/cron/morning")
def push_cron(authorization: str = Header(default="")):
    """Vercel Cron(매일 07시 KST)이 부른다. CRON_SECRET이 맞아야만 보낸다."""
    import secrets as _s
    sec = os.environ.get("CRON_SECRET", "")
    if not sec or not _s.compare_digest(authorization, f"Bearer {sec}"):
        raise HTTPException(401, "권한이 없다냥")
    _need_push()
    return push.send_all(share_store, today_kst())


class MapOther(BaseModel):
    name: str = Field(max_length=20)
    birth: Birth


class MapCalcReq(BaseModel):
    me: Birth
    others: list[MapOther] = Field(default_factory=list, max_length=60)


def _member(me_r, name: str, other_r, year: int) -> dict:
    rel = relation.relate(me_r, other_r, year)
    v = relation.member_view(name, rel, other_r.analysis.element_weight[me_r.analysis.yongshin])
    if ilju:
        c = ilju.of_reading(other_r)
        v["냥이"] = {"일주": c["일주"], "이름": c["이름"], "색": c["색"], "옷": c["옷"]}
    v["용신"] = other_r.analysis.yongshin
    return v


def _map_out(me_r, me_name: str, members: list[dict], year: int) -> dict:
    return {"주인": {"이름": me_name or "나", "유형": relation.person_type(me_r), "올해": relation.year_type(me_r, year),
                   "용신": me_r.analysis.yongshin},
            "연도": year, "멤버": sorted(members, key=lambda m: -m["케미"]),
            "요약": relation.summary(me_r, members, year), "종류": relation.KIND, "순서": relation.KIND_ORDER}


@app.post("/api/mapcalc")
def mapcalc(req: MapCalcReq):
    """저장소 없이(내 폰에만 저장) 지도 계산 — 친구 생일은 이 요청에서만 쓰고 저장하지 않는다."""
    if not relation:
        raise HTTPException(503, "관계 지도를 준비 중이다냥")
    year = _target_year()
    me_r = _reading(req.me, "내 생일: ")
    members = []
    for i, o in enumerate(req.others):
        m = _member(me_r, _nick(o.name), _reading(o.birth, f"{o.name} 생일: "), year)
        m["id"] = f"local{i}"
        members.append(m)
    return _map_out(me_r, req.me.name, members, year)


class MapCreateReq(BaseModel):
    owner: Birth
    consent: bool
    invited_by: str = Field(default="", max_length=16)   # 초대 링크로 들어왔던 지도 id → 초대한 사람을 첫 별로


def _need_store():
    if not (relation and share_store and share_store.configured()):
        raise HTTPException(503, "공유 저장소가 아직 연결되지 않았다냥 — 지금은 '내 폰에만 저장' 모드로 쓸 수 있어")


@app.post("/api/map")
def map_create(req: MapCreateReq):
    _need_store()
    if not req.consent:
        raise HTTPException(400, "지도를 만들려면 동의가 필요하다냥")
    me_r = _reading(req.owner)  # 날짜 검증 겸 계산
    try:
        mid, token = share_store.create_map({"birth": req.owner.model_dump(), "name": _nick(req.owner.name or "나")})
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    first = None
    # 서로 보이게: 초대해 준 사람의 지도에 내가 올라가 있다면, 초대한 사람도 내 지도의 첫 별로 올린다
    if re.fullmatch(r"[A-Za-z0-9]{4,16}", req.invited_by or ""):
        try:
            rec, _ = share_store.load(req.invited_by)
            if rec:
                inv_r = _reading(Birth(**rec["owner"]["birth"]))
                view = _member(me_r, rec["owner"]["name"], inv_r, _target_year())
                share_store.add_member(mid, view, src=req.invited_by)
                first = rec["owner"]["name"]
        except Exception as e:  # noqa: BLE001
            print(f"[map] 초대자 자동 등록 실패: {e!r}")
    return {"id": mid, "token": token, "첫별": first}


def _load_map(mid: str):
    _need_store()
    if not re.fullmatch(r"[A-Za-z0-9]{4,16}", mid):
        raise HTTPException(404, "지도를 찾을 수 없다냥")
    try:
        rec, ms = share_store.load(mid)
    except share_store.StoreError as e:
        raise HTTPException(503, str(e)) from e
    if rec is None:
        raise HTTPException(404, "지도를 찾을 수 없다냥 (지워졌거나 기간이 지났어)")
    return rec, ms


@app.get("/api/map/{mid}")
def map_get(mid: str, token: str = ""):
    rec, ms = _load_map(mid)
    owner = Birth(**rec["owner"]["birth"])
    me_r = _reading(owner)
    year = _target_year()
    members, waits = [], []
    for pid, e in ms.items():
        v = dict(e["view"])
        v["id"] = pid
        (waits if e.get("wait") else members).append(v)
    out = _map_out(me_r, rec["owner"]["name"], members, year)
    own = share_store.owner_ok(rec, token)
    out.update({"주인권한": own, "정원": share_store.ACTIVE_MAX, "대기수": len(waits)})
    if own:  # 대기 명단의 이름은 주인에게만
        out["대기"] = sorted(waits, key=lambda m: -m["케미"])
    return out


class MapRef(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9]{4,16}$")
    token: str = Field(max_length=64)


class MapJoinReq(BaseModel):
    name: str = Field(max_length=20)
    birth: Birth
    consent: bool
    mutual: bool = False                 # 내 지도에도 주인을 자동으로 올리기(없으면 내 지도를 새로 만든다)
    my_map: Optional[MapRef] = None      # 이 기기에 이미 내 지도가 있으면 그 지도


@app.post("/api/map/{mid}/join")
def map_join(mid: str, req: MapJoinReq):
    rec, _ = _load_map(mid)
    if not req.consent:
        raise HTTPException(400, "지도에 이름을 올리려면 동의가 필요하다냥")
    name = _nick(req.name)
    owner_r = _reading(Birth(**rec["owner"]["birth"]))
    me_r = _reading(req.birth, "내 생일: ")
    year = _target_year()
    view = _member(owner_r, name, me_r, year)          # 주인 지도에 올라갈 정보(내 생일은 저장 안 함)
    mine = relation.relate(me_r, owner_r, year)        # 내 입장에서 본 주인
    my_ref = None
    if req.my_map and req.my_map.id == mid:
        raise HTTPException(400, "내 지도에는 내가 이미 달로 떠 있다냥 🌕")
    if req.mutual:  # 서로 보이게: 내 지도(없으면 새로 만들어)에 주인을 별로 올린다
        try:
            if req.my_map:
                r2, _ = share_store.load(req.my_map.id)
                if r2 and share_store.owner_ok(r2, req.my_map.token):
                    my_ref = {"id": req.my_map.id, "token": req.my_map.token, "new": False}
            if not my_ref:
                nid, ntok = share_store.create_map({"birth": req.birth.model_dump(), "name": name})
                my_ref = {"id": nid, "token": ntok, "new": True}
        except share_store.StoreError as e:
            print(f"[map] 내 지도 준비 실패: {e!r}")
            my_ref = None
    try:
        pid, mtoken, wait = share_store.add_member(mid, view, src=my_ref["id"] if my_ref else None)
    except share_store.StoreError as e:
        raise HTTPException(409, str(e)) from e
    if my_ref:
        try:
            back = _member(me_r, rec["owner"]["name"], owner_r, year)
            bpid, _, bwait = share_store.add_member(my_ref["id"], back, src=mid)
            my_ref.update({"주인올림": bpid is not None, "주인대기": bwait})
        except share_store.StoreError as e:
            print(f"[map] 내 지도에 주인 올리기 실패: {e!r}")
    return {"id": pid, "token": mtoken, "이미": pid is None, "대기": wait, "주인이름": rec["owner"]["name"],
            "나": relation.person_type(me_r), "나의올해": relation.year_type(me_r, year), "내시선": mine, "주인시선": view,
            "내지도": my_ref}


class WaitReq(BaseModel):
    token: str = Field(max_length=64)
    wait: bool


@app.post("/api/map/{mid}/member/{pid}/wait")
def map_member_wait(mid: str, pid: str, req: WaitReq):
    """주인만: 지도(최대 10명) ↔ 대기 명단."""
    _load_map(mid)
    try:
        ok = share_store.set_wait(mid, pid, req.token, req.wait)
    except share_store.StoreError as e:
        raise HTTPException(409 if "명까지" in str(e) else 403, str(e)) from e
    if not ok:
        raise HTTPException(404, "그 별을 찾을 수 없다냥")
    return {"ok": True}


LETTER_LINES = {
    "목": "초록 잎사귀 같은 응원을 보낸다냥 🌿 오늘은 산책 어때?",
    "화": "따끈한 햇살 같은 응원을 보낸다냥 ☀️ 웃을 일 하나 생기길!",
    "토": "든든한 밥 한 끼 같은 응원을 보낸다냥 🍚 오늘도 잘 버텼어!",
    "금": "반짝이는 별 같은 응원을 보낸다냥 ✨ 너의 결단을 믿어!",
    "수": "시원한 물 한 잔 같은 응원을 보낸다냥 💧 푹 쉬어 가!",
}


class LetterReq(BaseModel):
    token: str = Field(max_length=64)
    msg: str = Field(default="", max_length=60)

    @field_validator("msg")
    @classmethod
    def _clean_msg(cls, v: str) -> str:
        return re.sub(r"[<>\r\n]", " ", v).strip()


@app.post("/api/map/{mid}/member/{pid}/letter")
def map_letter(mid: str, pid: str, req: LetterReq):
    """주인이 지도 속 친구에게 '보약 편지'를 보낸다. 친구가 서로 연결된(자기 지도가 있는) 경우에만 그 지도로 배달."""
    rec, ms = _load_map(mid)
    if not share_store.owner_ok(rec, req.token):
        raise HTTPException(403, "보낼 권한이 없다냥")
    e = ms.get(pid)
    if not e:
        raise HTTPException(404, "그 별을 찾을 수 없다냥")
    dest = e.get("src")
    if not dest:
        raise HTTPException(409, "이 친구는 아직 자기 지도가 없어서 편지를 받을 수 없다냥. 링크를 보내 '서로 연결하기'를 해 봐!")
    today = today_kst().isoformat()
    key = f"letters/{dest}/{today}-{mid}"
    try:
        if share_store.get_doc(key):
            raise HTTPException(409, "오늘은 이미 이 친구에게 편지를 보냈다냥. 내일 또 보내 줘!")
        el = e["view"].get("용신", "")
        share_store.put_doc(key, {"from": rec["owner"]["name"], "el": el, "line": LETTER_LINES.get(el, "따뜻한 응원을 보낸다냥 🐾"),
                                  "msg": req.msg, "at": today}, ttl=60 * 24 * 3600, index=f"letters/{dest}")
    except share_store.StoreError as err:
        raise HTTPException(503, str(err)) from err
    return {"ok": True, "받는이": e["view"]["이름"]}


@app.get("/api/map/{mid}/letters")
def map_letters(mid: str, token: str = ""):
    """내 지도로 온 보약 편지(최근 30일, 최대 20통) — 지도 주인만."""
    rec, _ = _load_map(mid)
    if not share_store.owner_ok(rec, token):
        raise HTTPException(403, "볼 권한이 없다냥")
    try:
        docs = share_store.list_docs(f"letters/{mid}")
    except share_store.StoreError as err:
        raise HTTPException(503, str(err)) from err
    cut = (today_kst() - timedelta(days=30)).isoformat()
    out = sorted(({"id": k.rsplit("/", 1)[-1], **{x: d.get(x) for x in ("from", "el", "line", "msg", "at")}} for k, d in docs
                  if d.get("at", "") >= cut), key=lambda x: x["at"], reverse=True)[:20]
    return {"편지": out}


@app.delete("/api/map/{mid}/member/{pid}")
def map_member_delete(mid: str, pid: str, token: str = ""):
    _load_map(mid)
    try:
        return {"ok": share_store.remove_member(mid, pid, token)}
    except share_store.StoreError as e:
        raise HTTPException(403, str(e)) from e


@app.get("/m/{mid}", response_class=HTMLResponse)
def map_share_page(mid: str):
    """공유 링크 미리보기: 카카오톡·SNS가 읽는 제목/설명을 지도마다 다르게, 사람은 앱으로 바로 이동."""
    import html as _html
    title, desc = "사주냥이 귀인 지도 🐾", "나는 이 사람에게 어떤 인연일까? 생일만 넣으면 바로 나와요."
    safe = re.fullmatch(r"[A-Za-z0-9]{4,16}", mid) is not None
    if safe and relation and share_store and share_store.configured():
        try:
            rec, ms = share_store.load(mid)
            if rec:
                name = rec["owner"].get("name") or "친구"
                act = [e for e in ms.values() if not e.get("wait")]
                kinds = [e["view"]["나에게"]["키"] for e in act]
                g = kinds.count("guiin")
                title = f"{name}님의 귀인 지도 🌌 · {len(act)}명"
                desc = (f"귀인 {g}명이 받쳐 주는 지도예요. " if g else "") + f"나는 {name}님에게 어떤 사람일까? 생일만 넣으면 내 자리가 떠요."
        except Exception:  # noqa: BLE001
            pass
    target = f"/?map={mid}" if safe else "/"
    t, d_ = _html.escape(title), _html.escape(desc)
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><title>{t}</title>
<meta property="og:type" content="website"><meta property="og:site_name" content="사주냥이">
<meta property="og:title" content="{t}"><meta property="og:description" content="{d_}">
<meta property="og:image" content="https://korean-saju-six.vercel.app/og.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta http-equiv="refresh" content="0; url={target}"><link rel="canonical" href="https://korean-saju-six.vercel.app{target}">
</head><body><a href="{target}">사주냥이 귀인 지도로 이동</a><script>location.replace({json.dumps(target)});</script></body></html>"""


@app.delete("/api/map/{mid}")
def map_delete(mid: str, token: str = ""):
    _load_map(mid)
    try:
        ok = share_store.delete_map(mid, token)
    except share_store.StoreError as e:
        raise HTTPException(403, str(e)) from e
    if ok:  # 받은 보약 편지도 함께 지운다
        try:
            for k, _ in share_store.list_docs(f"letters/{mid}"):
                share_store.del_doc(k, index=f"letters/{mid}")
        except share_store.StoreError as e:
            print(f"[map] 편지 정리 실패: {e!r}")
    return {"ok": ok}


# ---------------------------------------------------------------- 로컬 개발용 정적 파일
if not os.environ.get("VERCEL") and (ROOT / "public").is_dir():
    from fastapi.staticfiles import StaticFiles

    app.mount("/", StaticFiles(directory=ROOT / "public", html=True), name="public")
