"""신살(神煞)과 길성(吉星) 판정 — 원국 기둥별 표, 그리고 대운·세운에서 들어오는 신살.

조견표는 여러 자료를 교차 확인해 정했다(docs/manse-sinsal-plan.md 참고).
- 일간 기준: 천을·태극·문창·문곡·학당·천주·관귀학관·복성·금여록·건록·암록·홍염·양인
- 월지 기준: 천덕·월덕·천의성·급각살
- 연지 기준: 고신·과숙
- 삼합 기준(연지·일지): 역마·화개 / 도화는 요즘 만세력처럼 자오묘유 자체로 표시
- 글자 자체: 현침
- 일주·간지: 괴강·백호·고란·음양차착·효신
- 지지 짝: 원진·귀문·천라지망, 일주 기준 공망
"""
from __future__ import annotations

from .core import BRANCHES, STEMS, Chart, Pillar, ganzi

POS = {"시주": "시", "일주": "일", "월주": "월", "연주": "연"}
ORDER = ["시", "일", "월", "연"]

# ── 일간 기준 지지 표 (천간 index → 지지 index 튜플)
_T = lambda s: {i: tuple(BRANCHES.index(ch) for ch in v) for i, v in enumerate(s.split())}  # noqa: E731
BY_DAY_STEM = {
    "천을귀인": _T("丑未 子申 亥酉 亥酉 丑未 子申 丑未 寅午 卯巳 卯巳"),
    "태극귀인": _T("子午 子午 卯酉 卯酉 辰戌丑未 辰戌丑未 寅亥 寅亥 巳申 巳申"),
    "문창귀인": _T("巳 午 申 酉 申 酉 亥 子 寅 卯"),
    "문곡귀인": _T("亥 子 寅 卯 寅 卯 巳 午 申 酉"),
    "학당귀인": _T("亥 午 寅 酉 寅 酉 巳 子 申 卯"),
    "천주귀인": _T("巳 午 巳 午 申 酉 亥 子 寅 卯"),
    "관귀학관": _T("巳 巳 申 申 亥 亥 寅 寅 申 申"),
    "복성귀인": _T("寅子 卯丑 寅子 亥 申 未 午 巳 辰 卯丑"),
    "금여록": _T("辰 巳 未 申 未 申 戌 亥 丑 寅"),
    "건록": _T("寅 卯 巳 午 巳 午 申 酉 亥 子"),
    "암록": _T("亥 戌 申 未 申 未 巳 辰 寅 丑"),
    "홍염살": _T("午 申 寅 未 辰 辰 戌 酉 子 申"),
    "양인살": {0: (3,), 2: (6,), 4: (6,), 6: (9,), 8: (0,)},  # 양간만
}
# ── 월지 기준
CHEONDEOK = {0: "巳", 1: "庚", 2: "丁", 3: "申", 4: "壬", 5: "辛", 6: "亥", 7: "甲", 8: "癸", 9: "寅", 10: "丙", 11: "乙"}
WOLDEOK = {2: "丙", 6: "丙", 10: "丙", 8: "壬", 0: "壬", 4: "壬", 5: "庚", 9: "庚", 1: "庚", 11: "甲", 3: "甲", 7: "甲"}
GEUPGAK = {2: (11, 0), 3: (11, 0), 4: (11, 0), 5: (3, 7), 6: (3, 7), 7: (3, 7),
           8: (2, 10), 9: (2, 10), 10: (2, 10), 11: (1, 4), 0: (1, 4), 1: (1, 4)}
# ── 연지 기준(방합 계절)
_SEASON = {11: 0, 0: 0, 1: 0, 2: 1, 3: 1, 4: 1, 5: 2, 6: 2, 7: 2, 8: 3, 9: 3, 10: 3}
GOSIN = {0: 2, 1: 5, 2: 8, 3: 11}
GWASUK = {0: 10, 1: 1, 2: 4, 3: 7}
# ── 삼합 기준 (branch % 4 → 그룹)
YEOKMA = {2: 8, 0: 2, 1: 11, 3: 5}
HWAGAE = {2: 10, 0: 4, 1: 1, 3: 7}
DOHWA = {0, 3, 6, 9}  # 자오묘유
# ── 글자 자체
HYEONCHIM_S, HYEONCHIM_B = {0, 7}, {3, 6, 7, 8}
# ── 간지
GOEGANG = {"庚辰", "庚戌", "壬辰", "戊戌"}
BAEKHO = {"甲辰", "乙未", "丙戌", "丁丑", "戊辰", "壬戌", "癸丑"}
GORAN = {"甲寅", "乙巳", "丁巳", "戊申", "辛亥"}
EUMYANG = {"丙子", "丙午", "丁丑", "丁未", "戊寅", "戊申", "辛卯", "辛酉", "壬辰", "壬戌", "癸巳", "癸亥"}
HYOSIN = {"甲子", "乙亥", "丙寅", "丁卯", "戊午", "己巳", "庚辰", "庚戌", "辛丑", "辛未", "壬申", "癸酉"}
# ── 지지 짝
WONJIN = [frozenset(p) for p in ((0, 7), (1, 6), (2, 9), (3, 8), (4, 11), (5, 10))]
GWIMUN = [frozenset(p) for p in ((0, 9), (1, 6), (2, 7), (3, 8), (4, 11), (5, 10))]

# 이름 → (한자, 종류, 판정 기준 설명). 종류: 귀인(도움) · 길성(복) · 살(양날) · 특수(성향)
CATALOG = {
    "천을귀인": ("天乙貴人", "귀인", "일간"), "태극귀인": ("太極貴人", "귀인", "일간"),
    "천덕귀인": ("天德貴人", "귀인", "월지"), "월덕귀인": ("月德貴人", "귀인", "월지"),
    "문창귀인": ("文昌貴人", "귀인", "일간"), "문곡귀인": ("文曲貴人", "귀인", "일간"),
    "학당귀인": ("學堂貴人", "귀인", "일간"), "관귀학관": ("官貴學館", "귀인", "일간"),
    "천주귀인": ("天廚貴人", "귀인", "일간"), "복성귀인": ("福星貴人", "귀인", "일간"),
    "금여록": ("金輿祿", "길성", "일간"), "건록": ("建祿", "길성", "일간"), "암록": ("暗祿", "길성", "일간"),
    "천의성": ("天醫星", "길성", "월지"),
    "도화살": ("桃花煞", "살", "자오묘유"), "홍염살": ("紅艶煞", "살", "일간"), "역마살": ("驛馬煞", "살", "연지·일지 삼합"),
    "화개살": ("華蓋煞", "살", "연지·일지 삼합"), "양인살": ("羊刃煞", "살", "일간(양간)"), "현침살": ("懸針煞", "살", "글자 모양"),
    "괴강살": ("魁罡煞", "살", "일주"), "백호살": ("白虎煞", "살", "간지"), "귀문관살": ("鬼門關煞", "살", "지지 짝"),
    "원진살": ("怨嗔煞", "살", "지지 짝"), "공망": ("空亡", "살", "일주 순중"),
    "고신살": ("孤辰煞", "특수", "연지"), "과숙살": ("寡宿煞", "특수", "연지"), "고란살": ("孤鸞煞", "특수", "일주"),
    "음양차착살": ("陰陽差錯煞", "특수", "일주"), "효신살": ("梟神煞", "특수", "일주"), "급각살": ("急脚煞", "특수", "월지"),
    "천라지망": ("天羅地網", "특수", "지지 짝"),
}
NAMES = list(CATALOG)


def gongmang(day_idx: int) -> tuple[int, int]:
    b = (day_idx - day_idx % 10) % 12
    return (b + 10) % 12, (b + 11) % 12


def _lookup_branch(chart: Chart, b: int) -> list[str]:
    """일간·월지·연지 기준으로 지지 b 하나가 만드는 신살(원국·운 공통)."""
    ds, mb, yb = chart.day_stem, chart.month.branch, chart.year.branch
    out = [n for n, t in BY_DAY_STEM.items() if b in t.get(ds, ())]
    if CHEONDEOK[mb] == BRANCHES[b]:
        out.append("천덕귀인")
    if b == (mb - 1) % 12:
        out.append("천의성")
    if b in GEUPGAK[mb]:
        out.append("급각살")
    if b == GOSIN[_SEASON[yb]]:
        out.append("고신살")
    if b == GWASUK[_SEASON[yb]]:
        out.append("과숙살")
    if b in DOHWA:
        out.append("도화살")
    if b in HYEONCHIM_B:
        out.append("현침살")
    if b in gongmang(chart.day.index):
        out.append("공망")
    return out


def _lookup_stem(chart: Chart, s: int) -> list[str]:
    mb = chart.month.branch
    out = []
    if CHEONDEOK[mb] == STEMS[s]:
        out.append("천덕귀인")
    if WOLDEOK[mb] == STEMS[s]:
        out.append("월덕귀인")
    if s in HYEONCHIM_S:
        out.append("현침살")
    return out


def _sort(names) -> list[str]:
    return sorted(dict.fromkeys(names), key=NAMES.index)


def natal(chart: Chart) -> dict:
    ps = chart.pillars
    day = chart.day
    stem_row: dict[str, list[str]] = {p: [] for p in ORDER}
    br_row: dict[str, list[str]] = {p: [] for p in ORDER}
    basis: dict[str, list[str]] = {}

    def note(name, text):
        basis.setdefault(name, [])
        if text not in basis[name]:
            basis[name].append(text)

    for p in ps:
        pos = POS[p.label]
        for n in _lookup_stem(chart, p.stem):
            stem_row[pos].append(n)
        for n in _lookup_branch(chart, p.branch):
            if n == "공망" and p.label == "일주":
                continue
            if n == "천덕귀인" and p.label == "월주":
                continue
            br_row[pos].append(n)
        # 역마·화개: 연지·일지 삼합 기준(기준 글자 자신은 제외)
        for base, self_pos in ((chart.year.branch, "연"), (day.branch, "일")):
            if pos == self_pos:
                continue
            if p.branch == YEOKMA[base % 4]:
                br_row[pos].append("역마살"); note("역마살", f"{'연지' if self_pos == '연' else '일지'} {BRANCHES[base]} 기준")
            if p.branch == HWAGAE[base % 4]:
                br_row[pos].append("화개살"); note("화개살", f"{'연지' if self_pos == '연' else '일지'} {BRANCHES[base]} 기준")
        if p.hanja in BAEKHO:
            br_row[pos].append("백호살")
        if day.hanja in GOEGANG and p.hanja in GOEGANG:
            br_row[pos].append("괴강살")
    if day.hanja in GORAN:
        br_row["일"].append("고란살")
    if day.hanja in EUMYANG:
        br_row["일"].append("음양차착살")
    if day.hanja in HYOSIN:
        br_row["일"].append("효신살")
    # 지지 짝: 원진·귀문·천라지망
    for i, a in enumerate(ps):
        for b in ps[i + 1:]:
            pair = frozenset((a.branch, b.branch))
            for name, table in (("원진살", WONJIN), ("귀문관살", GWIMUN)):
                if pair in table:
                    br_row[POS[a.label]].append(name); br_row[POS[b.label]].append(name)
                    note(name, f"{BRANCHES[a.branch]}·{BRANCHES[b.branch]}")
            if pair in (frozenset((10, 11)), frozenset((4, 5))):
                br_row[POS[a.label]].append("천라지망"); br_row[POS[b.label]].append("천라지망")
                note("천라지망", "戌亥 천라" if 10 in pair else "辰巳 지망")

    stem_row = {k: _sort(v) for k, v in stem_row.items()}
    br_row = {k: _sort(v) for k, v in br_row.items()}
    where: dict[str, list[str]] = {}
    for row, label in ((stem_row, "간"), (br_row, "지")):
        for pos in ORDER:
            for n in row[pos]:
                where.setdefault(n, [])
                if pos + label not in where[n]:
                    where[n].append(pos + label)
    hc = sum(1 for p in ps if p.stem in HYEONCHIM_S) + sum(1 for p in ps if p.branch in HYEONCHIM_B)
    items = []
    for n in _sort(where):
        hanja, kind, base = CATALOG[n]
        items.append({"이름": n, "한자": hanja, "종류": kind, "기준": base, "자리": where[n],
                      "근거": basis.get(n, []), "개수": len(where[n])})
    has = {p.label: p for p in ps}
    s12 = {}
    for p in ps:
        pos = POS[p.label]
        base = day.branch if p.label == "연주" else chart.year.branch
        s12[pos] = twelve_sinsal(base, p.branch)
    return {"천간": stem_row, "지지": br_row, "목록": items, "12신살": s12,
            "현침개수": hc, "시주있음": "시주" in has,
            "공망": [BRANCHES[b] for b in gongmang(day.index)]}


TWELVE = ["겁살", "재살", "천살", "지살", "연살", "월살", "망신살", "장성살", "반안살", "역마살", "육해살", "화개살"]
_FIRST = {0: 5, 4: 5, 8: 5, 2: 11, 6: 11, 10: 11, 5: 2, 9: 2, 1: 2, 11: 8, 3: 8, 7: 8}  # 그룹별 겁살 자리


def twelve_sinsal(base: int, target: int) -> str:
    """12신살: 기준 지지의 삼합 그룹에서 겁살부터 차례로 배정."""
    return TWELVE[(target - _FIRST[base]) % 12]


def incoming(chart: Chart, p: Pillar) -> list[str]:
    """대운·세운 기둥 하나가 원국에 들여오는 신살."""
    out = _lookup_stem(chart, p.stem) + _lookup_branch(chart, p.branch)
    for base in (chart.year.branch, chart.day.branch):
        if p.branch == YEOKMA[base % 4]:
            out.append("역마살")
        if p.branch == HWAGAE[base % 4]:
            out.append("화개살")
    if p.hanja in BAEKHO:
        out.append("백호살")
    if chart.day.hanja in GOEGANG and p.hanja in GOEGANG:
        out.append("괴강살")
    db = chart.day.branch
    if frozenset((db, p.branch)) in WONJIN:
        out.append("원진살")
    if frozenset((db, p.branch)) in GWIMUN:
        out.append("귀문관살")
    return _sort(out)


def pillar_name(idx: int) -> str:
    return ganzi(idx)
