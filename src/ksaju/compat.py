"""궁합(宮合): 일간 관계, 일지(배우자궁), 띠(연지), 오행·용신 보완."""
from __future__ import annotations

from .analysis import (BREAK, GWIMUN, HARM, PUNISH_PAIRS, SIX_COMBINE, STEM_CLASH, STEM_COMBINE,
                       THREE_COMBINE, WONJIN, Analysis)
from .core import ELEMENTS, STEM_ELEMENT, STEMS, Chart


def _branch_relation(a: int, b: int) -> tuple[int, str]:
    pair = frozenset((a, b))
    if pair in SIX_COMBINE:
        return 12, "육합 — 자연스럽게 끌리고 협력"
    for trio, el in THREE_COMBINE:
        if a in trio and b in trio and a != b:
            return 8, f"삼합({ELEMENTS[el]}국) — 같은 방향을 보는 동지"
    if len(pair) == 2 and (a - b) % 12 == 6:
        return -10, "충 — 끌림도 크지만 부딪힘도 큼(서로 다른 생활 리듬)"
    if pair in WONJIN:
        return -7, "원진 — 이유 없이 서운한 감정이 쌓이기 쉬움"
    if pair in PUNISH_PAIRS:
        return -5, "형 — 사소한 마찰이 반복될 수 있음"
    if pair in HARM:
        return -4, "해 — 은근한 오해 주의"
    if pair in BREAK:
        return -3, "파 — 계획이 어긋나기 쉬움"
    if pair in GWIMUN:
        return -2, "귀문 — 서로 예민해지는 지점"
    if a == b:
        return 3, "같은 지지 — 비슷한 생활 패턴"
    return 0, "특별한 합충 없음"


def _stem_relation(a: int, b: int) -> tuple[int, str]:
    pair = frozenset((a, b))
    if pair in STEM_COMBINE:
        return 15, f"천간합(→{ELEMENTS[STEM_COMBINE[pair]]}) — 서로에게 강하게 끌리는 관계"
    if pair in STEM_CLASH:
        return -8, "천간충 — 가치관 충돌, 대화로 조율 필요"
    ea, eb = STEM_ELEMENT[a], STEM_ELEMENT[b]
    rel = (eb - ea) % 5
    return {
        0: (5, "같은 오행 — 친구 같은 동반자, 경쟁심 주의"),
        1: (6, f"{STEMS[a]}이(가) {STEMS[b]}을(를) 생함 — 1번이 베풀고 2번이 받는 구조"),
        4: (6, f"{STEMS[b]}이(가) {STEMS[a]}을(를) 생함 — 2번이 베풀고 1번이 받는 구조"),
        2: (-2, f"{STEMS[a]}이(가) {STEMS[b]}을(를) 극함 — 1번이 주도·통제하는 구조"),
        3: (-2, f"{STEMS[b]}이(가) {STEMS[a]}을(를) 극함 — 2번이 주도·통제하는 구조"),
    }[rel]


def compatibility(c1: Chart, a1: Analysis, c2: Chart, a2: Analysis) -> dict:
    items = []
    s, t = _stem_relation(c1.day_stem, c2.day_stem)
    items.append(("일간 관계", s, t))
    s, t = _branch_relation(c1.day.branch, c2.day.branch)
    items.append(("일지(배우자궁)", s, t))
    s, t = _branch_relation(c1.year.branch, c2.year.branch)
    items.append(("띠(연지)", s // 2, t))
    s, t = _branch_relation(c1.month.branch, c2.month.branch)
    items.append(("월지(사회·가정환경)", s // 2, t))

    def fills(a_from: Analysis, other: Analysis) -> tuple[int, str]:
        rich = [e for e, w in other.element_weight.items() if w >= 22]
        score = 0
        msg = []
        if a_from.yongshin in rich:
            score += 10
            msg.append(f"상대가 내 용신 {a_from.yongshin}을(를) 풍부하게 가짐")
        if a_from.gishin in rich:
            score -= 5
            msg.append(f"상대에게 내 기신 {a_from.gishin}이(가) 많음")
        lacking = [e for e, w in a_from.element_weight.items() if w < 8]
        filled = [e for e in lacking if other.element_weight[e] >= 18]
        if filled:
            score += 4 * len(filled)
            msg.append(f"내게 부족한 {','.join(filled)}을(를) 채워줌")
        return score, "; ".join(msg) or "뚜렷한 보완/충돌 없음"

    s, t = fills(a1, a2)
    items.append(("1번 입장 오행·용신", s, t))
    s, t = fills(a2, a1)
    items.append(("2번 입장 오행·용신", s, t))

    total = max(0, min(100, 60 + sum(i[1] for i in items)))
    grade = ("천생연분형" if total >= 85 else "잘 맞는 편" if total >= 72 else
             "노력하면 좋은 관계" if total >= 58 else "조율이 많이 필요")
    return {"score": total, "grade": grade,
            "items": [{"항목": n, "점수": sc, "해석": tx} for n, sc, tx in items],
            "note": "점수는 참고용 지표입니다. 궁합은 서로의 차이를 이해하는 도구로 쓰세요."}
