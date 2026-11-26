"""택일(擇日) 도우미 — 목적에 맞는 좋은 날을 앞으로 N일 안에서 고른다(규칙 기반, AI 없음).

판단 요소
- 그날 일진이 내 사주와 맞는 정도(운세 점수: 용신·희신·기신, 합·충, 12운성)
- 일진의 천간 십성이 목적과 맞는가(예: 계약=인성(문서), 면접=관성·식상, 데이트=연인 기운)
- 원국과 충(衝)이 드는 날은 큰일을 피하고, 합(合)이 드는 날은 더한다
- 이사·입주는 한국 풍습의 '손 없는 날'(음력 끝자리 9·0일)을 함께 표시한다
"""
from __future__ import annotations

from datetime import date, timedelta

from ksaju import solar_to_lunar
from ksaju.core import Pillar, branch_main_stem, day_index, ten_god

from .fortune import DAY_TIP, GOOD_REL, WEEKDAY, _clamp, _pillar_score

GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성", "정재": "재성",
         "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}
PURPOSES = {
    "move": ("🏠", "이사·입주", {"재성", "인성"}, "생활 터전을 옮기는 일이라 충이 없는 날, 손 없는 날을 우선했다냥"),
    "contract": ("✍️", "계약·서명", {"인성", "재성"}, "문서(인성)·재물(재성) 기운이 드는 날, 마찰(형·충)이 없는 날"),
    "interview": ("💼", "면접·발표", {"관성", "식상"}, "평가(관성)·표현(식상) 기운이 드는 날"),
    "date": ("💗", "데이트·고백", None, "연인 기운과 표현(식상) 기운이 드는 날, 합이 드는 날"),
    "exam": ("📚", "시험·자격증", {"인성", "관성"}, "공부·문서(인성) 기운이 드는 날"),
    "start": ("🚀", "새 일 시작·개업", {"식상", "재성"}, "생산(식상)·재물(재성) 기운이 드는 날"),
}


def _lunar_day(d: date) -> int | None:
    try:
        return solar_to_lunar(d.year, d.month, d.day).day
    except Exception:  # noqa: BLE001
        return None


def pick(r, purpose: str, start: date, days: int = 60) -> dict:
    if purpose not in PURPOSES:
        purpose = "move"
    emo, label, groups, why = PURPOSES[purpose]
    c, a = r.chart, r.analysis
    if groups is None:
        groups = {"관성" if c.birth.gender == "여" else "재성", "식상"}
    rows = []
    for k in range(1, days + 1):
        d = start + timedelta(days=k)
        p = Pillar(day_index(d), "일진")
        s, rels, stage = _pillar_score(c, a, p)
        sg = ten_god(c.day_stem, p.stem)
        bg = ten_god(c.day_stem, branch_main_stem(p.branch))
        kinds = {x.kind for x in rels}
        clash = bool(kinds & {"충", "천간충"})
        day_clash = any(x.kind == "충" and any(m.startswith("일지") for m in x.members) for x in rels)
        punish = "형" in kinds
        harmony = bool(kinds & GOOD_REL)
        fit = bool({GROUP[sg], GROUP[bg]} & groups)
        ld = _lunar_day(d) if purpose == "move" else None
        son = ld is not None and ld % 10 in (9, 0)
        score = s + (10 if fit else 0) + (6 if harmony else 0) - (25 if clash else 0) - (12 if punish and purpose in ("contract", "move") else 0) \
            + (12 if son else 0) + (5 if GROUP[sg] in groups else 0)
        reasons = []
        if GROUP[sg] in groups:
            reasons.append(f"{sg}({GROUP[sg]}) 기운이 겉으로 드는 날")
        elif GROUP[bg] in groups:
            reasons.append(f"속으로 {bg}({GROUP[bg]}) 기운이 받쳐 주는 날")
        if harmony:
            reasons.append("원국과 합이 드는 날")
        if son:
            reasons.append(f"손 없는 날(음력 {ld}일)")
        warn = []
        if day_clash:
            warn.append("배우자 자리(일지)와 충")
        elif clash:
            warn.append("원국과 충")
        if punish:
            warn.append("형(서류·마찰 주의)")
        rows.append({"date": d.isoformat(), "요일": WEEKDAY[d.weekday()], "일진": p.hanja, "십성": sg, "점수": _clamp(score),
                     "이유": reasons, "주의": warn, "한마디": DAY_TIP[sg], "손없는날": son, "_raw": score})
    ok = [x for x in rows if not x["주의"]] or rows
    if purpose == "move":  # 이사는 한국 풍습대로 '손 없는 날' 중에서 먼저 고른다
        son_ok = [x for x in ok if x["손없는날"]]
        ok = son_ok if len(son_ok) >= 3 else ok
    best = sorted(ok, key=lambda x: -x["_raw"])[:5]
    for x in rows:
        x.pop("_raw", None)
    avoid = [x for x in rows if x["주의"]][:6]
    return {"목적": purpose, "이모지": emo, "이름": label, "기준": why, "기간": f"{(start + timedelta(days=1)).isoformat()} ~ {(start + timedelta(days=days)).isoformat()}",
            "추천": sorted(best, key=lambda x: x["date"]), "피할날": avoid,
            "안내": "냥이의 택일은 '바람 방향' 참고용이다냥. 날짜보다 준비와 사람 사정이 먼저야!"}


def menu() -> list[dict]:
    return [{"id": k, "이모지": v[0], "이름": v[1]} for k, v in PURPOSES.items()]
