"""관계 지도(귀인 지도) — 두 사람의 사주가 서로에게 주는 좋은 기운·나쁜 기운을 계산한다(AI 없음).

관계 유형(일간 오행의 생극, 내 입장에서)
  🌟 귀인       상대 일간이 나를 생(生)      → 인성 관계: 나를 살리고 받쳐 주는 사람
  🤝 단짝       같은 오행                   → 비겁 관계: 같은 결의 동료·라이벌
  🌱 내 사람    내가 상대를 생              → 식상 관계: 내가 챙기고 길러 주는 사람
  🧭 오른팔     내가 상대를 극(剋)           → 재성 관계: 내가 믿고 맡기는 사람
  ⚡ 호랑이 선생 상대가 나를 극              → 관성 관계: 나를 단련시키는 사람

여기에 더해 '진짜 귀인'을 가리는 요소
- 용신 보완: 상대 원국에 내 용신·희신이 얼마나 많은가(많을수록 곁에 있으면 편안), 내 기신이 많으면 감점
- 부족 오행 채움: 내게 거의 없는 오행을 상대가 넉넉히 가짐
- 천을귀인: 상대의 연지·일지가 내 일간의 천을귀인 자리 — 고전에서 말하는 바로 그 '귀인'
- 일간 합·충, 일지(가까운 사이의 자리)·연지(띠) 합충형파해·원진
- 영향력: 위 요소를 양쪽 방향으로 계산해 '상대→나', '나→상대'를 따로 낸다
"""
from __future__ import annotations

from ksaju.analysis import CHEONEUL
from ksaju.core import BRANCHES, ELEMENTS, STEM_ELEMENT, STEMS, ten_god, year_index, Pillar
from ksaju.compat import _branch_relation, _stem_relation

KIND = {  # (생극 관계 코드: (상대-나) % 5) → (키, 이모지, 이름, 설명)
    4: ("guiin", "🌟", "귀인", "나를 살리고 받쳐 주는 사람"),
    0: ("jjak", "🤝", "단짝", "같은 결의 동료이자 좋은 라이벌"),
    1: ("mine", "🌱", "내 사람", "내가 챙기고 길러 주는 사람"),
    2: ("arm", "🧭", "오른팔", "내가 믿고 일을 맡기는 사람"),
    3: ("tiger", "⚡", "호랑이 선생", "나를 단련시키고 키워 주는 사람"),
}
KIND_ORDER = ["guiin", "jjak", "mine", "arm", "tiger"]
SUBTYPE = {  # 음양까지 본 세부(십성)
    "정인": "따뜻하게 품어 주는 귀인", "편인": "생각을 깨워 주는 귀인", "비견": "어깨를 나란히 하는 단짝", "겁재": "서로 불붙이는 라이벌 단짝",
    "식신": "편하게 챙겨 주게 되는 사람", "상관": "자꾸 표현하게 만드는 사람", "정재": "믿고 맡기는 성실한 오른팔", "편재": "판을 함께 키우는 오른팔",
    "정관": "바른길로 이끄는 선생", "편관": "세게 단련시키는 호랑이 선생",
}
SEASON = {2: ("🌸", "봄"), 3: ("🌸", "봄"), 4: ("🌸", "봄"), 5: ("☀️", "여름"), 6: ("☀️", "여름"), 7: ("☀️", "여름"),
          8: ("🍂", "가을"), 9: ("🍂", "가을"), 10: ("🍂", "가을"), 11: ("❄️", "겨울"), 0: ("❄️", "겨울"), 1: ("❄️", "겨울")}
SHORT = {"甲": "큰 나무", "乙": "꽃", "丙": "태양", "丁": "촛불", "戊": "큰 산", "己": "텃밭", "庚": "원석", "辛": "보석", "壬": "바다", "癸": "단비"}
YEAR_TYPE = {  # 그해 세운 천간 십성 → 한 해 별명
    "비견": ("🧭", "마이웨이 개척자", "내 기준으로 길을 내는 해"), "겁재": ("🔥", "도전 러너", "경쟁 속에서 더 달아오르는 해"),
    "식신": ("🍀", "재주 꽃피우기", "좋아하는 일이 결과가 되는 해"), "상관": ("💡", "아이디어 뱅크", "말과 표현으로 판을 바꾸는 해"),
    "편재": ("🚀", "판 키우는 사업가", "기회와 돈이 크게 오가는 해"), "정재": ("🏦", "차곡차곡 저축왕", "성실함이 통장으로 오는 해"),
    "편관": ("🛡️", "시험대의 전사", "버틴 만큼 실력이 남는 해"), "정관": ("🎖️", "인정받는 해", "자리와 책임이 생기는 해"),
    "편인": ("🔭", "깊이 파는 연구가", "혼자 파고들수록 레벨업하는 해"), "정인": ("📚", "배움 충전러", "배우고 도움받는 해"),
}


def person_type(r) -> dict:
    c = r.chart
    em, sn = SEASON[c.month.branch]
    dm = STEMS[c.day_stem]
    return {"이모지": em, "이름": f"{sn}의 {SHORT[dm]}", "일간": dm, "오행": ELEMENTS[STEM_ELEMENT[c.day_stem]]}


def year_type(r, year: int) -> dict:
    sg = ten_god(r.chart.day_stem, Pillar(year_index(year), "").stem)
    e, n, d = YEAR_TYPE[sg]
    return {"이모지": e, "이름": n, "설명": d, "십성": sg}


def _supply(me, other) -> tuple[float, list[str], list[str]]:
    """other가 me에게 채워 주는 정도(용신 보완) — (점수, 좋은 이유, 아쉬운 이유)."""
    a, w = me.analysis, other.analysis.element_weight
    good, bad = [], []
    s = w[a.yongshin] * 0.6 + w[a.huishin] * 0.3 - w[a.gishin] * 0.35 - w[a.gushin] * 0.15
    if w[a.yongshin] >= 22:
        good.append(f"내 보약(용신) {a.yongshin} 기운을 넉넉히({w[a.yongshin]:.0f}%) 가진 사람")
    elif w[a.yongshin] >= 12:
        good.append(f"내 보약(용신) {a.yongshin} 기운을 적당히 가진 사람")
    lack = [e for e, v in a.element_weight.items() if v < 8 and w[e] >= 18]
    if lack:
        s += 6 * len(lack)
        good.append(f"내게 거의 없는 {'·'.join(lack)} 기운을 채워 주는 사람")
    if w[a.gishin] >= 30:
        bad.append(f"내게 부담인 {a.gishin} 기운이 많은 편이라, 오래 붙어 있으면 피곤할 수 있음")
    return s, good, bad


def _guiin_star(me, other) -> list[str]:
    hits = []
    targets = CHEONEUL[me.chart.day_stem]
    for p in other.chart.pillars:
        if p.label in ("연주", "일주") and p.branch in targets:
            hits.append(f"상대의 {p.label[0]}지 {BRANCHES[p.branch]}가 내 천을귀인 자리 — 고전이 말하는 '귀인'의 별")
    return hits


def _side(me, other) -> dict:
    """me 입장에서 본 other."""
    code = (STEM_ELEMENT[other.chart.day_stem] - STEM_ELEMENT[me.chart.day_stem]) % 5
    key, emo, name, desc = KIND[code]
    sg = ten_god(me.chart.day_stem, other.chart.day_stem)
    sup, good, bad = _supply(me, other)
    stars = _guiin_star(me, other)
    good += stars
    influence = sup + (8 if key == "guiin" else 3 if key in ("jjak", "mine") else 0) + 14 * len(stars)
    return {"키": key, "이모지": emo, "유형": name, "설명": desc, "세부": SUBTYPE.get(sg, desc), "십성": sg,
            "보완": round(max(0, min(100, 50 + sup * 1.4))), "천을귀인": bool(stars),
            "영향력": round(max(0, min(100, 50 + influence * 1.2))), "좋은점": good, "아쉬운점": bad}


def relate(me, other, year: int) -> dict:
    """두 사람의 관계 — me 기준의 시선, other 기준의 시선, 공통 케미."""
    to_me = _side(me, other)      # 상대가 나에게
    to_other = _side(other, me)   # 내가 상대에게
    s_stem, t_stem = _stem_relation(me.chart.day_stem, other.chart.day_stem)
    s_day, t_day = _branch_relation(me.chart.day.branch, other.chart.day.branch)
    s_year, t_year = _branch_relation(me.chart.year.branch, other.chart.year.branch)
    good, bad = [], []
    for sc, tx, label in ((s_stem, t_stem, "일간"), (s_day, t_day, "일지(가까운 사이 자리)"), (s_year // 2, t_year, "띠")):
        clean = tx.replace("1번", "나").replace("2번", "상대")
        if sc > 2:
            good.append(f"{label}: {clean}")
        elif sc < 0:
            bad.append(f"{label}: {clean}")
    chem = 58 + s_stem * 0.8 + s_day * 0.9 + s_year * 0.3 + (to_me["보완"] - 50) * 0.25 + (to_other["보완"] - 50) * 0.15 \
        + (6 if to_me["천을귀인"] else 0) + (3 if to_other["천을귀인"] else 0)
    chem = int(round(max(30, min(98, chem))))
    give, take = to_other["영향력"], to_me["영향력"]
    flow = ("서로 비슷하게 주고받는 사이" if abs(give - take) < 8 else
            "상대가 나를 더 많이 채워 주는 사이 — 고마움을 표현하면 더 단단해짐" if take > give else
            "내가 상대를 더 많이 채워 주는 사이 — 나도 받는 법을 연습하면 좋음")
    return {"케미": chem, "나에게": to_me, "상대에게": to_other, "흐름": flow,
            "좋은점": good + to_me["좋은점"], "아쉬운점": bad + to_me["아쉬운점"],
            "상대유형": person_type(other), "상대올해": year_type(other, year)}


TITLES = [(1, "🌙 첫 별"), (3, "✨ 작은 별자리"), (5, "🌌 빛나는 성단"), (8, "💫 별무리"), (12, "🌠 은하수")]


def summary(me, members: list[dict], year: int) -> dict:
    """내 지도 전체: 귀인 점수, 유형별 수, 가장 큰 귀인, 내가 귀인인 사람, 필요한 오행 친구."""
    a = me.analysis
    cnt = {k: 0 for k in KIND_ORDER}
    for m in members:
        cnt[m["나에게"]["키"]] += 1
    n = len(members)
    title = next((t for k, t in reversed(TITLES) if n >= k), "🌑 아직 빈 하늘")
    if not n:
        score = 0
    else:
        top = sorted((m["나에게"]["영향력"] for m in members), reverse=True)[:5]
        score = 30 + sum(top) / len(top) * 0.35 + min(n, 8) * 2.5 + 8 * min(cnt["guiin"], 3) \
            + 6 * sum(1 for m in members if m["나에게"]["천을귀인"])
        score = int(round(min(100, score)))
    best = max(members, key=lambda m: m["나에게"]["영향력"], default=None)
    giver = max(members, key=lambda m: m["상대에게"]["영향력"], default=None)
    need = a.yongshin
    have_need = [m["이름"] for m in members if m.get("용신공급") and m["용신공급"] >= 22]
    w = a.element_weight
    lack = [e for e, v in w.items() if v < 8]
    line = (f"내 사주엔 {max(w, key=w.get)} 기운이 많고 {min(w, key=w.get)} 기운이 적어요 — "
            f"{need} 기운 친구가 특히 귀한 구성이에요." + (f" 지금 지도에선 {', '.join(have_need[:3])}님이 그 역할!" if have_need else ""))
    return {"귀인점수": score, "칭호": title, "인원": n, "유형수": cnt, "한줄": line,
            "가장큰귀인": best and {"이름": best["이름"], "영향력": best["나에게"]["영향력"]},
            "내가귀인": giver and {"이름": giver["이름"], "영향력": giver["상대에게"]["영향력"]},
            "필요한오행": need, "부족": lack}


def member_view(name: str, rel: dict, other_yong_supply: float) -> dict:
    """지도에 올릴 공개 정보(생년월일 없음)."""
    return {"이름": name, "케미": rel["케미"], "나에게": rel["나에게"], "상대에게": rel["상대에게"], "흐름": rel["흐름"],
            "좋은점": rel["좋은점"][:4], "아쉬운점": rel["아쉬운점"][:3], "유형": rel["상대유형"], "올해": rel["상대올해"],
            "용신공급": other_yong_supply}
