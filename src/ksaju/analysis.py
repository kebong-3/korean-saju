"""원국 분석: 오행 분포, 십성, 12운성, 합충형파해, 신살, 강약, 격국, 용신."""
from __future__ import annotations

from dataclasses import dataclass, field
from itertools import combinations

from .core import (BRANCH_ELEMENT, BRANCHES, ELEMENTS, HIDDEN, STEM_ELEMENT, STEMS, STEMS_KO, TEN_GOD_GROUP,
                   Chart, Pillar, branch_main_stem, element_ten_god_group, is_yang_stem, ten_god,
                   twelve_stage)

# --------------------------------------------------------------------------
# 관계표
# --------------------------------------------------------------------------
STEM_COMBINE = {frozenset((0, 5)): 2, frozenset((1, 6)): 3, frozenset((2, 7)): 4,
                frozenset((3, 8)): 0, frozenset((4, 9)): 1}  # → 화(化) 오행
STEM_CLASH = [frozenset(p) for p in ((0, 6), (1, 7), (2, 8), (3, 9))]
SIX_COMBINE = {frozenset((0, 1)): 2, frozenset((2, 11)): 0, frozenset((3, 10)): 1,
               frozenset((4, 9)): 3, frozenset((5, 8)): 4, frozenset((6, 7)): 1}
THREE_COMBINE = [((8, 0, 4), 4), ((11, 3, 7), 0), ((2, 6, 10), 1), ((5, 9, 1), 3)]
DIRECTION_COMBINE = [((2, 3, 4), 0), ((5, 6, 7), 1), ((8, 9, 10), 3), ((11, 0, 1), 4)]
PUNISH_PAIRS = {frozenset((2, 5)): "인사형", frozenset((5, 8)): "사신형", frozenset((2, 8)): "인신형",
                frozenset((1, 10)): "축술형", frozenset((10, 7)): "술미형", frozenset((1, 7)): "축미형",
                frozenset((0, 3)): "자묘형(무례지형)"}
SELF_PUNISH = {4, 6, 9, 11}  # 辰午酉亥 자형
BREAK = [frozenset(p) for p in ((0, 9), (1, 4), (2, 11), (3, 6), (5, 8), (7, 10))]
HARM = [frozenset(p) for p in ((0, 7), (1, 6), (2, 5), (3, 4), (8, 11), (9, 10))]
WONJIN = [frozenset(p) for p in ((0, 7), (1, 6), (2, 9), (3, 8), (4, 11), (5, 10))]
GWIMUN = [frozenset(p) for p in ((0, 9), (1, 6), (2, 7), (3, 8), (4, 11), (5, 10))]

POS_KO = {"연주": "연", "월주": "월", "일주": "일", "시주": "시"}


@dataclass
class Relation:
    kind: str  # 천간합, 천간충, 육합, 삼합, 반합, 방합, 충, 형, 파, 해, 원진, 귀문
    members: list[str]
    detail: str = ""

    def __str__(self) -> str:
        return f"{self.kind}: {'·'.join(self.members)}{(' ' + self.detail) if self.detail else ''}"


def find_relations(pillars: list[Pillar], extra: list[Pillar] | None = None) -> list[Relation]:
    """원국(및 대운·세운 등 extra) 사이의 합충형파해."""
    items = pillars + (extra or [])
    out: list[Relation] = []

    def tag(p: Pillar, part: str) -> str:
        ch = STEMS[p.stem] if part == "s" else BRANCHES[p.branch]
        return f"{POS_KO.get(p.label, p.label)}{'간' if part == 's' else '지'} {ch}"

    for a, b in combinations(items, 2):
        if extra is not None:
            ina = any(a is e for e in extra); inb = any(b is e for e in extra)
            if ina == inb:  # 원국끼리 또는 운끼리는 제외
                continue
        s = frozenset((a.stem, b.stem))
        if s in STEM_COMBINE:
            out.append(Relation("천간합", [tag(a, "s"), tag(b, "s")], f"→{ELEMENTS[STEM_COMBINE[s]]}"))
        if s in STEM_CLASH:
            out.append(Relation("천간충", [tag(a, "s"), tag(b, "s")]))
        br = frozenset((a.branch, b.branch))
        m = [tag(a, "b"), tag(b, "b")]
        if br in SIX_COMBINE:
            out.append(Relation("육합", m, f"→{ELEMENTS[SIX_COMBINE[br]]}"))
        if len(br) == 2 and (a.branch - b.branch) % 12 == 6:
            out.append(Relation("충", m))
        if br in PUNISH_PAIRS:
            out.append(Relation("형", m, PUNISH_PAIRS[br]))
        if a.branch == b.branch and a.branch in SELF_PUNISH:
            out.append(Relation("형", m, "자형"))
        if br in BREAK:
            out.append(Relation("파", m))
        if br in HARM:
            out.append(Relation("해", m))
        if br in WONJIN:
            out.append(Relation("원진", m))
        if br in GWIMUN:
            out.append(Relation("귀문", m))

    branches = {p.branch for p in items}
    ext = {p.branch for p in extra} if extra else None
    natal = {p.branch for p in pillars}

    def new_combo(have):
        return ext is None or (any(b in ext for b in have) and not all(b in natal for b in have))

    for trio, el in THREE_COMBINE:
        have = [b for b in trio if b in branches]
        if not new_combo(have):
            continue
        if len(have) == 3:
            out.append(Relation("삼합", [BRANCHES[b] for b in trio], f"{ELEMENTS[el]}국"))
        elif len(have) == 2 and trio[1] in have:  # 왕지 포함 반합
            out.append(Relation("반합", [BRANCHES[b] for b in have], f"{ELEMENTS[el]}국"))
    for trio, el in DIRECTION_COMBINE:
        if all(b in branches for b in trio) and new_combo(list(trio)):
            out.append(Relation("방합", [BRANCHES[b] for b in trio], f"{ELEMENTS[el]}방"))
    return out


# --------------------------------------------------------------------------
# 신살
# --------------------------------------------------------------------------
TWELVE_SINSAL = ["겁살", "재살", "천살", "지살", "연살(도화)", "월살", "망신살", "장성살",
                 "반안살", "역마살", "육해살", "화개살"]
_GROUP_FIRST = {0: 8, 4: 8, 8: 8, 2: 2, 6: 2, 10: 2, 5: 5, 9: 5, 1: 5, 11: 11, 3: 11, 7: 11}


def twelve_sinsal(base_branch: int, target: int) -> str:
    return TWELVE_SINSAL[(target - (_GROUP_FIRST[base_branch] - 3)) % 12]


CHEONEUL = {0: (1, 7), 4: (1, 7), 6: (1, 7), 1: (0, 8), 5: (0, 8), 2: (11, 9), 3: (11, 9),
            7: (2, 6), 8: (5, 3), 9: (5, 3)}
MUNCHANG = {0: 5, 1: 6, 2: 8, 3: 9, 4: 8, 5: 9, 6: 11, 7: 0, 8: 2, 9: 3}
YANGIN = {0: 3, 2: 6, 4: 6, 6: 9, 8: 0}
HONGYEOM = {0: 6, 1: 6, 2: 2, 3: 7, 4: 4, 5: 4, 6: 10, 7: 9, 8: 0, 9: 8}
GEUMYEO = {0: 4, 1: 5, 2: 7, 3: 8, 4: 7, 5: 8, 6: 10, 7: 11, 8: 1, 9: 2}
GOEGANG = {"庚辰", "庚戌", "壬辰", "壬戌", "戊戌"}
BAEKHO = {"甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"}
CHEONDEOK = {2: "丁", 3: "申", 4: "壬", 5: "辛", 6: "亥", 7: "甲", 8: "癸", 9: "寅", 10: "丙",
             11: "乙", 0: "巳", 1: "庚"}
WOLDEOK = {2: "丙", 6: "丙", 10: "丙", 8: "壬", 0: "壬", 4: "壬", 11: "甲", 3: "甲", 7: "甲",
           5: "庚", 9: "庚", 1: "庚"}


def gongmang(day_idx: int) -> tuple[int, int]:
    start = day_idx - day_idx % 10
    b = start % 12
    return (b + 10) % 12, (b + 11) % 12


@dataclass
class Sinsal:
    name: str
    where: list[str]


def find_sinsal(chart: Chart) -> tuple[list[Sinsal], dict[str, dict[str, str]]]:
    ps = chart.pillars
    ds = chart.day_stem
    found: dict[str, list[str]] = {}

    def add(name: str, where: str):
        found.setdefault(name, [])
        if where not in found[name]:
            found[name].append(where)

    for p in ps:
        pos = POS_KO[p.label]
        if p.branch in CHEONEUL[ds] or p.branch in CHEONEUL[chart.year.stem]:
            add("천을귀인", pos)
        if p.branch == MUNCHANG[ds]:
            add("문창귀인", pos)
        if ds in YANGIN and p.branch == YANGIN[ds]:
            add("양인살", pos)
        if p.branch == HONGYEOM[ds]:
            add("홍염살", pos)
        if p.branch == GEUMYEO[ds]:
            add("금여록", pos)
        if p.hanja in BAEKHO:
            add("백호대살", pos)
        if STEMS[p.stem] == CHEONDEOK[chart.month.branch] or BRANCHES[p.branch] == CHEONDEOK[chart.month.branch]:
            if p.label != "월주":
                add("천덕귀인", pos)
        if STEMS[p.stem] == WOLDEOK[chart.month.branch] and p.label != "월주":
            add("월덕귀인", pos)
    if chart.day.hanja in GOEGANG:
        add("괴강살", "일")
    gm = gongmang(chart.day.index)
    for p in ps:
        if p.label != "일주" and p.branch in gm:
            add("공망", POS_KO[p.label])

    # 12신살 (연지 기준, 일지 기준)
    twelve: dict[str, dict[str, str]] = {"연지기준": {}, "일지기준": {}}
    for p in ps:
        twelve["연지기준"][POS_KO[p.label]] = twelve_sinsal(chart.year.branch, p.branch)
        twelve["일지기준"][POS_KO[p.label]] = twelve_sinsal(chart.day.branch, p.branch)
    for basis in twelve.values():
        for pos, name in basis.items():
            if name in ("역마살", "연살(도화)", "화개살") and pos not in ("연",):
                add(name.replace("연살(도화)", "도화살"), pos)
    return [Sinsal(k, v) for k, v in found.items()], twelve


# --------------------------------------------------------------------------
# 오행·강약·격국·용신
# --------------------------------------------------------------------------
POS_WEIGHT = {("연주", "s"): 1.0, ("월주", "s"): 1.0, ("시주", "s"): 1.0,
              ("연주", "b"): 1.0, ("월주", "b"): 3.0, ("일주", "b"): 1.5, ("시주", "b"): 1.0}


@dataclass
class Analysis:
    element_count: dict[str, int]
    element_weight: dict[str, float]  # 지장간 반영 가중치(%)
    ten_gods: dict[str, dict[str, str]]
    hidden: dict[str, list[str]]
    stages: dict[str, str]
    group_weight: dict[str, float]
    strength_score: float
    strength: str
    deukryeong: bool
    deukji: bool
    deukse: bool
    gyeokguk: str
    gyeok_note: str
    yongshin: str
    huishin: str
    gishin: str
    gushin: str
    hanshin: str
    johu: str | None
    yong_note: str
    relations: list[Relation]
    sinsal: list[Sinsal]
    twelve_sinsal: dict[str, dict[str, str]]
    gongmang: tuple[str, str]
    notes: list[str] = field(default_factory=list)


def _branch_elements(branch: int) -> list[tuple[int, float]]:
    total = sum(d for _, d in HIDDEN[branch])
    return [(STEM_ELEMENT[s], d / total) for s, d in HIDDEN[branch]]


def analyze(chart: Chart) -> Analysis:
    ds = chart.day_stem
    ps = chart.pillars
    count = {e: 0 for e in ELEMENTS}
    weight = {e: 0.0 for e in ELEMENTS}
    for p in ps:
        count[ELEMENTS[STEM_ELEMENT[p.stem]]] += 1
        count[ELEMENTS[BRANCH_ELEMENT[p.branch]]] += 1

    group_w = {g: 0.0 for g in ("비겁", "식상", "재성", "관성", "인성")}
    for p in ps:
        if p.label != "일주":
            w = POS_WEIGHT[(p.label, "s")]
            weight[ELEMENTS[STEM_ELEMENT[p.stem]]] += w
            group_w[element_ten_god_group(ds, STEM_ELEMENT[p.stem])] += w
        else:
            weight[ELEMENTS[STEM_ELEMENT[p.stem]]] += 1.0
        bw = POS_WEIGHT[(p.label, "b")]
        for el, frac in _branch_elements(p.branch):
            weight[ELEMENTS[el]] += bw * frac
            group_w[element_ten_god_group(ds, el)] += bw * frac
    tot_w = sum(weight.values())
    weight_pct = {k: round(v / tot_w * 100, 1) for k, v in weight.items()}
    tot_g = sum(group_w.values())
    group_pct = {k: round(v / tot_g * 100, 1) for k, v in group_w.items()}

    support = group_w["비겁"] + group_w["인성"]
    score = round(support / tot_g * 100, 1)
    if score >= 70:
        strength = "극신강"
    elif score >= 55:
        strength = "신강"
    elif score > 45:
        strength = "중화"
    elif score > 30:
        strength = "신약"
    else:
        strength = "극신약"

    month_main = branch_main_stem(chart.month.branch)
    deukryeong = TEN_GOD_GROUP[ten_god(ds, month_main)] in ("비겁", "인성")
    deukji = TEN_GOD_GROUP[ten_god(ds, branch_main_stem(chart.day.branch))] in ("비겁", "인성")
    others = [p.stem for p in ps if p.label != "일주"]
    deukse = sum(TEN_GOD_GROUP[ten_god(ds, s)] in ("비겁", "인성") for s in others) >= max(1, len(others) / 2 + 0.01)

    # 십성·지장간·12운성
    tg: dict[str, dict[str, str]] = {}
    hidden: dict[str, list[str]] = {}
    stages: dict[str, str] = {}
    for p in ps:
        pos = POS_KO[p.label]
        tg[pos] = {"천간": "일간(나)" if p.label == "일주" else ten_god(ds, p.stem),
                   "지지": ten_god(ds, branch_main_stem(p.branch))}
        hidden[pos] = [f"{STEMS[s]}({ten_god(ds, s)})" for s, _ in HIDDEN[p.branch]]
        stages[pos] = twelve_stage(ds, p.branch)

    # 격국 (자평진전식): 월지가 일간의 록/양인이면 건록·양인격,
    # 아니면 월지 지장간 중 천간에 투출한 것(정기→중기→여기, 비겁 제외) → 없으면 정기
    month_stage = twelve_stage(ds, chart.month.branch)
    month_hidden = [s for s, _ in HIDDEN[chart.month.branch]][::-1]
    other_stems = {p.stem for p in ps if p.label != "일주"}
    if month_stage == "건록":
        gyeok, pick, tgod, tuchul = "건록격", month_main, ten_god(ds, month_main), False
    elif month_stage == "제왕" and is_yang_stem(ds):
        gyeok, pick, tgod, tuchul = "양인격", month_main, ten_god(ds, month_main), False
    else:
        cands = [s for s in month_hidden if s in other_stems and TEN_GOD_GROUP[ten_god(ds, s)] != "비겁"]
        tuchul = bool(cands)
        pick = cands[0] if cands else month_main
        tgod = ten_god(ds, pick)
        if TEN_GOD_GROUP[tgod] == "비겁":
            gyeok = "월겁격"
        elif tgod == "편관":
            gyeok = "편관격(칠살격)"
        else:
            gyeok = f"{tgod}격"
    gyeok_note = (f"월지 {BRANCHES[chart.month.branch]}({month_stage})의 지장간 {STEMS[pick]}"
                  f"{(('이' if STEMS_KO[pick] in '갑을병정경신임' else '가') + ' 천간에 투출') if tuchul else '(정기)'} → {tgod}")
    notes: list[str] = []
    if strength == "극신강" and group_pct["비겁"] >= 50:
        notes.append("비겁이 압도적 — 종왕격(전왕격) 성립 여부를 함께 검토할 만함")
    if strength == "극신약":
        top = max(("식상", "재성", "관성"), key=lambda g: group_w[g])
        notes.append(f"일간이 매우 약하고 {top}이 강함 — 종격(從{top}) 가능성 검토")
    if chart.day.hanja in GOEGANG:
        notes.append("일주 괴강 — 괴강격 성향(강한 결단력·극단성)")

    # 용신 (억부 + 조후)
    de = STEM_ELEMENT[ds]
    el_of = {"비겁": de, "식상": (de + 1) % 5, "재성": (de + 2) % 5, "관성": (de + 3) % 5, "인성": (de + 4) % 5}
    if score >= 55 or (score > 45 and deukryeong):
        if group_w["인성"] > group_w["비겁"]:
            yong_g = "재성"
            yreason = "신강하고 인성이 무거워 재성으로 인성을 제어(재극인)"
        elif group_w["관성"] >= group_w["식상"]:
            yong_g = "관성"
            yreason = "신강하고 비겁이 많아 관성으로 비겁을 제어"
        else:
            yong_g = "식상"
            yreason = "신강하고 비겁이 많아 식상으로 기운을 설기(泄氣)"
    else:
        drain = {g: group_w[g] for g in ("식상", "재성", "관성")}
        top = max(drain, key=drain.get)
        weak = "신약한데" if score <= 45 else "중화이나 월령을 얻지 못해 일간 쪽이 조금 약하고"
        if top == "재성":
            yong_g = "비겁"
            yreason = f"{weak} 재성이 무거워 비겁으로 재성을 감당(재다신약 방지)"
        else:
            yong_g = "인성"
            yreason = f"{weak} {top}이 강해 인성으로 일간을 생조" + (" (살인상생)" if top == "관성" else "")
    y_el = el_of[yong_g]
    hui = (y_el + 4) % 5   # 용신을 생하는 오행
    gi = (y_el + 3) % 5    # 용신을 극하는 오행
    gu = (gi + 4) % 5      # 기신을 생하는 오행
    han = ({0, 1, 2, 3, 4} - {y_el, hui, gi, gu}).pop()

    johu = None
    mb = chart.month.branch
    if mb in (5, 6, 7) and weight_pct["수"] < 15:
        johu = "수"
    elif mb in (11, 0, 1) and weight_pct["화"] < 15:
        johu = "화"
    yong_note = f"억부: {yreason}."
    if johu:
        yong_note += (f" 조후: {'여름(巳午未)' if johu == '수' else '겨울(亥子丑)'} 생으로 "
                      f"{johu}의 조후가 필요(궁통보감 관점). 실전에서는 조후를 우선하는 학파도 있음.")

    rels = find_relations(ps)
    sins, twelve = find_sinsal(chart)
    gm = gongmang(chart.day.index)
    return Analysis(
        element_count=count, element_weight=weight_pct, ten_gods=tg, hidden=hidden, stages=stages,
        group_weight=group_pct, strength_score=score, strength=strength,
        deukryeong=deukryeong, deukji=deukji, deukse=deukse,
        gyeokguk=gyeok, gyeok_note=gyeok_note,
        yongshin=ELEMENTS[y_el], huishin=ELEMENTS[hui], gishin=ELEMENTS[gi], gushin=ELEMENTS[gu],
        hanshin=ELEMENTS[han], johu=johu, yong_note=yong_note,
        relations=rels, sinsal=sins, twelve_sinsal=twelve,
        gongmang=(BRANCHES[gm[0]], BRANCHES[gm[1]]), notes=notes,
    )
