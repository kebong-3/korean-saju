"""운세 점수·맞춤 추천·개운법 — ksaju 계산 결과에 '규칙'을 적용해 만든다(AI 없음, 같은 입력이면 항상 같은 결과).

점수 규칙(모든 운 공통)
- 운의 천간·지지 오행이 내 용신(+2) 희신(+1) 한신(0) 구신(-1) 기신(-2) 중 무엇인지 → 기본 점수
- 원국과 합(협력) +, 충·형·파·해·원진(마찰) −
- 12운성 상승 구간(장생·관대·건록·제왕) +
점수는 '흐름의 순풍/역풍' 지표이지 길흉 확정이 아니다.
"""
from __future__ import annotations

from datetime import date

from ksaju.analysis import find_relations
from ksaju.core import (BRANCH_ELEMENT, BRANCHES, BRANCHES_KO, ELEMENTS, STEM_ELEMENT, STEMS,
                        ZODIAC_LIST, Pillar, branch_main_stem, ten_god, twelve_stage, year_index)
from ksaju.luck import wolun
from ksaju.texts import ELEMENT_ADVICE

GOOD_REL = {"천간합", "육합", "삼합", "반합", "방합"}
BAD_REL = {"충", "천간충", "형", "파", "해", "원진"}
RISE = {"장생", "관대", "건록", "제왕"}
FALL = {"병", "사", "묘", "절"}
GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성", "정재": "재성",
         "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}

# 해(年)의 천간 십성 → 그 해의 주제
YEAR_THEME = {
    "비견": ("독립과 자기확신의 해", "내 편, 내 사람, 내 기준이 또렷해지는 해다냥. 혼자 해내는 힘이 커지지만 고집으로 보이지 않게 조심!"),
    "겁재": ("도전과 경쟁의 해", "승부욕이 불타오르는 해다냥. 과감하게 움직이되 돈 거래·보증·충동구매는 한 번 더 생각하라냥."),
    "식신": ("재능이 꽃피는 해", "하고 싶은 걸 꾸준히 할수록 복이 붙는 해다냥. 취미가 부업이 되고, 맛있는 것도 많이 먹게 된다냥."),
    "상관": ("표현과 변화의 해", "말발·센스·아이디어가 반짝이는 해다냥. 틀을 깨고 싶어지는데, 윗사람과 부딪히지 않게 말은 둥글게!"),
    "편재": ("기회와 활동의 해", "판이 커지는 해다냥. 새로운 사람·돈·기회가 들어오지만 들어온 만큼 나가기도 쉬우니 관리가 핵심!"),
    "정재": ("차곡차곡 쌓는 해", "성실함이 통장 잔고로 돌아오는 해다냥. 저축·재테크 공부·생활 루틴 만들기에 딱 좋다냥."),
    "편관": ("시험대에 서는 해", "책임과 압박이 커지지만, 버텨낸 만큼 실력과 이름이 남는 해다냥. 무리하지 말고 체력부터 챙겨라냥."),
    "정관": ("인정받는 해", "자리·직함·약속이 생기는 해다냥. 규칙을 잘 지키면 승진·합격·좋은 인연이 따라온다냥."),
    "편인": ("깊이 파고드는 해", "남들과 다른 공부, 직감, 영감이 강해지는 해다냥. 혼자만의 시간이 오히려 보약이다냥."),
    "정인": ("배움과 도움의 해", "공부·자격증·계약서 운이 좋고, 도와주는 어른이 나타나는 해다냥. 받은 도움은 꼭 기억하라냥."),
}
DAY_TIP = {
    "비견": "오늘은 내 페이스대로! 비교는 금지다냥.", "겁재": "지갑 단속하는 날이다냥. 충동구매 STOP!",
    "식신": "맛있는 거 먹고 좋아하는 거 하는 날이다냥.", "상관": "아이디어가 샘솟는 날! 말은 부드럽게 하라냥.",
    "편재": "새로운 기회에 손 들어보는 날이다냥.", "정재": "가계부·정리정돈하면 운이 붙는 날이다냥.",
    "편관": "할 일이 몰려도 하나씩! 숨 고르기 잊지 마라냥.", "정관": "약속·마감 지키면 칭찬받는 날이다냥.",
    "편인": "혼자 생각할 시간이 필요한 날이다냥.", "정인": "배우고 물어보면 귀인이 나타나는 날이다냥.",
}
# 오행 → 음식(오미) 개운
ELEMENT_FOOD = {"목": "신맛·푸른 채소(샐러드, 매실, 키위)", "화": "쓴맛·붉은 음식(토마토, 딸기, 다크초콜릿)",
                "토": "단맛·곡물·뿌리채소(고구마, 단호박, 잡곡밥)", "금": "매운맛·흰 음식(무, 배, 도라지, 생강차)",
                "수": "짠맛·검은 음식(검은콩, 미역, 블루베리)"}
ELEMENT_ITEM = {"목": "초록 식물·나무 소품", "화": "향초·조명·빨간 포인트 소품", "토": "도자기·노란 머그컵",
                "금": "실버 액세서리·시계", "수": "물병·수족관·남색 파우치"}
GROUP_JOB = {
    "비겁": ("내 이름 걸고 하는 일", "프리랜서·1인 창업·전문직·스포츠·코칭"),
    "식상": ("만들고 표현하는 일", "디자인·콘텐츠 크리에이터·요리·교육·기획·마케팅"),
    "재성": ("돈과 사람을 굴리는 일", "영업·유통·MD·재무·투자·사업"),
    "관성": ("조직에서 책임지는 일", "공무원·대기업·법·행정·관리직·의료"),
    "인성": ("배우고 가르치고 돕는 일", "연구·교사·상담·출판·자격 기반 전문직"),
}
GROUP_STYLE = {
    "비겁": "자기 주도형 — 스스로 정한 목표가 있어야 불타오른다냥.",
    "식상": "몰입형 — 좋아하는 걸 할 때 시간 가는 줄 모른다냥. 결과물로 보여주는 게 강점!",
    "재성": "실전형 — 이론보다 해보면서 배우고, 숫자로 성과를 확인할 때 신난다냥.",
    "관성": "체계형 — 마감·규칙·평가가 있을 때 가장 잘 해낸다냥.",
    "인성": "탐구형 — 이해가 돼야 움직인다냥. 공부한 만큼 자신감이 생긴다냥.",
}
LOVE_STYLE = {  # 일지(배우자궁) 십성
    "비견": "친구 같은 연애 — 대등하고 편한 관계가 잘 맞다냥.",
    "겁재": "밀당보다 직진 — 열정적이지만 자존심 싸움은 조심!",
    "식신": "다정한 연애 — 챙겨주고 맛집 다니는 평화로운 커플이 된다냥.",
    "상관": "설렘 중시 — 말이 잘 통하고 재밌는 사람에게 끌린다냥.",
    "편재": "스케일 큰 연애 — 활동적이고 이벤트 좋아하는 사람과 잘 맞다냥.",
    "정재": "안정 추구 — 믿음직하고 성실한 사람이 결국 마음을 얻는다냥.",
    "편관": "강한 끌림 — 카리스마 있는 사람에게 약하다냥. 끌려다니지만 말 것!",
    "정관": "바른 연애 — 예의 바르고 책임감 있는 사람이 이상형이다냥.",
    "편인": "정신적 교감 — 취향·대화가 통하는 사람이 최고다냥.",
    "정인": "보살핌 받는 연애 — 나를 아껴주고 이해해주는 사람과 잘 맞다냥.",
}
SIX_HARMONY = {0: 1, 1: 0, 2: 11, 11: 2, 3: 10, 10: 3, 4: 9, 9: 4, 5: 8, 8: 5, 6: 7, 7: 6}
TRIPLE = [{8, 0, 4}, {11, 3, 7}, {2, 6, 10}, {5, 9, 1}]
WONJIN = {0: 7, 7: 0, 1: 6, 6: 1, 2: 9, 9: 2, 3: 8, 8: 3, 4: 11, 11: 4, 5: 10, 10: 5}


def _tiers(a) -> dict[str, int]:
    t = {e: 0 for e in ELEMENTS}
    t.update({a.yongshin: 2, a.huishin: 1, a.gushin: -1, a.gishin: -2})
    return t


def _clamp(x: float, lo: int = 35, hi: int = 97) -> int:
    return int(round(max(lo, min(hi, x))))


def _pillar_score(chart, a, p: Pillar) -> tuple[float, list, str]:
    t = _tiers(a)
    se, be = ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]
    raw = 0.55 * t[se] + 0.45 * t[be]
    rels = find_relations(chart.pillars, [p])
    good = sum(1 for r in rels if r.kind in GOOD_REL)
    bad = sum(1 for r in rels if r.kind in BAD_REL)
    stage = twelve_stage(chart.day_stem, p.branch)
    score = 60 + raw * 11 + min(good, 3) * 3 - min(bad, 4) * 3.5 + (3 if stage in RISE else -2 if stage in FALL else 0)
    return score, rels, stage


def _grade(s: int) -> str:
    return "대길" if s >= 85 else "길" if s >= 72 else "순탄" if s >= 58 else "보통" if s >= 45 else "조심"


def _elem_of(p: Pillar) -> tuple[str, str]:
    return ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]


# ------------------------------------------------------------------ 오늘
def today_fortune(r, today: date) -> dict:
    c, a = r.chart, r.analysis
    t = r.today_luck
    p = Pillar(t["day_index"], "일진")
    s, rels, stage = _pillar_score(c, a, p)
    score = _clamp(s)
    adv = ELEMENT_ADVICE[a.yongshin]
    return {
        "date": today.isoformat(), "일진": t["day"], "점수": score, "등급": _grade(score),
        "십성": f"{t['stem_god']}/{t['branch_god']}", "12운성": stage,
        "한마디": DAY_TIP[t["stem_god"]],
        "작용": [str(x) for x in rels],
        "행운": {"색": adv["색"].split("·")[0], "숫자": adv["숫자"], "방위": adv["방위"],
               "음식": ELEMENT_FOOD[a.yongshin].split("(")[1].rstrip(")").split(", ")[0]},
        "미션": adv["활동"].split("·")[0] + " 10분 하기",
    }


# ------------------------------------------------------------------ 신년운세
def year_fortune(r, year: int) -> dict:
    c, a = r.chart, r.analysis
    female = c.birth.gender == "여"
    p = Pillar(year_index(year), f"{year}년")
    base, rels, stage = _pillar_score(c, a, p)
    sg, bg = ten_god(c.day_stem, p.stem), ten_god(c.day_stem, branch_main_stem(p.branch))
    gods = {sg, bg}
    groups = {GROUP[g] for g in gods}
    kinds = [x.kind for x in rels]
    day_hit = [x for x in rels if any(m.startswith("일지") for m in x.members)]
    month_hit = [x for x in rels if any(m.startswith("월지") for m in x.members)]
    day_clash = any(x.kind in BAD_REL for x in day_hit)
    day_harmony = any(x.kind in GOOD_REL for x in day_hit)

    def dom(bonus: float) -> int:
        return _clamp(base + bonus)

    money = dom((8 if "재성" in groups else 0) + (3 if "식상" in groups else 0) - (6 if "겁재" in gods else 0))
    work = dom((7 if "관성" in groups else 0) + (3 if "인성" in groups else 0) - (3 if "상관" in gods else 0)
               - (4 if any(x.kind in BAD_REL for x in month_hit) else 0))
    spouse = "관성" if female else "재성"
    love = dom((8 if spouse in groups else 0) + (3 if "식상" in groups else 0)
               + (6 if day_harmony else 0) - (6 if day_clash else 0))
    health = dom(-(4 if stage in FALL else 0) - 2.5 * sum(1 for k in kinds if k in {"충", "형"})
                 - (3 if a.gishin in _elem_of(p) else 0))
    study = dom((8 if "인성" in groups else 0) - (3 if "재성" in groups else 0) + (2 if "식상" in groups else 0))
    people = dom((4 if "비겁" in groups else 0) + 2 * sum(1 for k in kinds if k in GOOD_REL) - (2 if "겁재" in gods else 0))
    total = _clamp(base)
    theme = YEAR_THEME[sg]

    months = []
    for m in wolun(c, year):
        ms, mrels, _ = _pillar_score(c, a, m.pillar)
        months.append({"그룹": [GROUP[m.stem_god], GROUP[m.branch_god]], "월": m.start_kst.month, "절기": m.label.rstrip("~"), "시작": m.start_kst.strftime("%m/%d"),
                       "간지": m.pillar.hanja, "십성": f"{m.stem_god}/{m.branch_god}",
                       "점수": _clamp((ms + base) / 2 + (ms - 60) * 0.6),
                       "한마디": DAY_TIP[m.stem_god], "작용": [str(x) for x in mrels]})
    ranked = sorted(months, key=lambda x: -x["점수"])

    se, be = _elem_of(p)
    tips = []
    if a.gishin in (se, be) or a.gushin in (se, be):
        tips.append(f"올해 기운({se}·{be}) 중에 내게 부담되는 오행이 섞여 있다냥. 용신 {a.yongshin} 기운으로 균형을 잡아라냥.")
    else:
        tips.append(f"올해 기운({se}·{be})이 내 편이다냥! 미뤄둔 일을 시작하기 좋다냥.")
    if day_clash:
        tips.append("배우자궁(일지)이 흔들리는 해 — 연애·이사·생활 리듬에 변화가 오기 쉬우니, 변화를 두려워하기보다 정리의 기회로 삼아라냥.")
    if any(x.kind in BAD_REL for x in month_hit):
        tips.append("월지(사회궁)가 자극받는 해 — 이직·부서 이동·환경 변화 이야기가 나오기 쉽다냥.")
    if day_harmony:
        tips.append("일지와 합이 드는 해 — 좋은 인연·협력자가 들어오기 쉽다냥.")

    return {
        "연도": year, "간지": f"{p.hanja}({p.hangul})", "십성": f"{sg}/{bg}", "12운성": stage,
        "테마": theme[0], "총평": theme[1], "총운": total, "등급": _grade(total),
        "분야": {"재물운": money, "직업운": work, "연애운": love, "건강운": health, "학업운": study, "인간관계": people},
        "작용": [str(x) for x in rels], "조언": tips,
        "일지충": day_clash, "일지합": day_harmony, "월지충": any(x.kind in BAD_REL for x in month_hit),
        "월별": months, "좋은달": [m["월"] for m in ranked[:3]], "조심할달": [m["월"] for m in ranked[-2:]],
    }


# ------------------------------------------------------------------ 평생 총운(대운 그래프)
def life_fortune(r) -> dict:
    c, a = r.chart, r.analysis
    pts = []
    for d in r.daewoon:
        s, rels, stage = _pillar_score(c, a, d.pillar)
        pts.append({"나이": d.start_age, "시작": d.start_year, "간지": d.pillar.hanja, "한글": d.pillar.hangul,
                    "십성": f"{d.stem_god}/{d.branch_god}", "12운성": stage, "점수": _clamp(s),
                    "현재": bool(d.current), "테마": YEAR_THEME[d.stem_god][0].replace("해", "시기")})
    cur = next((x for x in pts if x["현재"]), None)
    # 전성기는 '지금 이후'(현재 대운 포함)에서 고른다 — 지나간 어린 시절을 알려주면 쓸모가 없다
    ahead = [x for x in pts if (cur is None or x["나이"] >= cur["나이"]) and x["나이"] < 70] or pts
    best = max(ahead, key=lambda x: x["점수"])
    nxt = next((x for x in pts if cur and x["나이"] == cur["나이"] + 10), None)
    return {"대운": pts, "전성기": best, "현재": cur, "다음": nxt}


def years_ahead(r, start: int, n: int = 10) -> list[dict]:
    """start년부터 n년간 세운 점수(앞으로 언제 풀리나)."""
    c, a = r.chart, r.analysis
    out = []
    for y in range(start, start + n):
        p = Pillar(year_index(y), f"{y}년")
        s, rels, _ = _pillar_score(c, a, p)
        sg = ten_god(c.day_stem, p.stem)
        out.append({"연도": y, "간지": p.hanja, "점수": _clamp(s), "십성": sg, "테마": YEAR_THEME[sg][0],
                    "십성그룹": [GROUP[sg], GROUP[ten_god(c.day_stem, branch_main_stem(p.branch))]]})
    return out


# ------------------------------------------------------------------ 나에게 맞는 ~
def matches(r) -> dict:
    c, a = r.chart, r.analysis
    top = max(a.group_weight, key=a.group_weight.get)
    low = min(a.group_weight, key=a.group_weight.get)
    yb = c.year.branch
    good = {SIX_HARMONY[yb]} | (next(t for t in TRIPLE if yb in t) - {yb})
    bad = {(yb + 6) % 12, WONJIN[yb]}
    day_god = a.ten_gods["일"]["지지"]
    y, h = ELEMENT_ADVICE[a.yongshin], ELEMENT_ADVICE[a.huishin]
    return {
        "직업": {"유형": GROUP_JOB[top][0], "추천": GROUP_JOB[top][1], "용신분야": y["직무"],
               "근거": f"가장 강한 십성 {top}({a.group_weight[top]}%) + 용신 {a.yongshin}"},
        "공부일하는법": GROUP_STYLE[top],
        "보완할점": f"{low}({a.group_weight[low]}%)이 가장 약하다냥 — " + {
            "비겁": "남 눈치보다 내 의견 말하기 연습!", "식상": "생각만 말고 일단 만들어서 보여주기!",
            "재성": "가계부·예산 관리 습관 들이기!", "관성": "작은 약속·마감부터 지키는 루틴 만들기!",
            "인성": "책 한 권, 강의 하나 꾸준히 듣기!"}[low],
        "연애스타일": LOVE_STYLE.get(day_god, "") if day_god in LOVE_STYLE else "",
        "잘맞는띠": [ZODIAC_LIST[b] for b in sorted(good)],
        "조심할띠": [ZODIAC_LIST[b] for b in sorted(bad)],
        "띠": ZODIAC_LIST[yb],
        "행운의색": [y["색"], h["색"]], "행운의숫자": y["숫자"], "행운의방위": y["방위"],
        "힐링": y["활동"], "음식": ELEMENT_FOOD[a.yongshin], "아이템": ELEMENT_ITEM[a.yongshin],
    }


# ------------------------------------------------------------------ 개운법
def gaewoon(r, year: int) -> dict:
    a = r.analysis
    y, h = ELEMENT_ADVICE[a.yongshin], ELEMENT_ADVICE[a.huishin]
    p = Pillar(year_index(year), "")
    se, be = _elem_of(p)
    rx = [
        {"제목": "행운 컬러", "내용": f"{y['색']} — 옷·폰케이스·네일 포인트로!", "이유": f"용신 {a.yongshin}의 색"},
        {"제목": "책상·침대 방향", "내용": f"{y['방위']}쪽을 바라보거나 그쪽에 두기", "이유": f"용신 {a.yongshin}의 방위"},
        {"제목": "개운 음식", "내용": ELEMENT_FOOD[a.yongshin], "이유": "오행과 맛(오미)의 짝"},
        {"제목": "개운 아이템", "내용": ELEMENT_ITEM[a.yongshin], "이유": f"{a.yongshin} 기운을 곁에 두기"},
        {"제목": "생활 습관", "내용": y["활동"], "이유": f"{a.yongshin} 기운을 몸으로 채우기"},
        {"제목": "보조 처방", "내용": f"{h['색']} 소품, {h['활동'].split('·')[0]}", "이유": f"희신 {a.huishin}이 용신을 돕는다냥"},
    ]
    avoid = f"기신 {a.gishin} 기운이 과해지지 않게 — {ELEMENT_ADVICE[a.gishin]['색']} 계열을 온몸에 두르는 건 피하라냥."
    if a.johu and a.johu != a.yongshin:
        extra = f"계절 균형(조후)으로는 {a.johu} 기운도 필요하다냥 — {ELEMENT_ADVICE[a.johu]['활동'].split('·')[0]}도 추천!"
    else:
        extra = ""
    year_tip = (f"{year}년({p.hanja})은 {se}·{be} 기운의 해다냥. "
                + ("내 용신 기운과 겹쳐서 순풍이다냥!" if a.yongshin in (se, be) else
                   "기신 기운이 섞였으니 개운법을 더 꾸준히!" if a.gishin in (se, be) else "무난한 바람이니 꾸준함이 이긴다냥."))
    return {"처방": rx, "피할것": avoid, "조후": extra, "올해": year_tip}


def bundle(r, today: date) -> dict:
    target = today.year + 1 if today.month >= 10 else today.year
    yf = year_fortune(r, target)
    life = life_fortune(r)
    mt = matches(r)
    return {"오늘운세": today_fortune(r, today), "신년운세": yf, "평생운": life, "맞춤": mt,
            "개운법": gaewoon(r, target), "앞으로10년": years_ahead(r, today.year)}
