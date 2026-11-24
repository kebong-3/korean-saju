"""결과 조립: dict(JSON) / Markdown / LLM용 compact 텍스트."""
from __future__ import annotations

from datetime import date, timedelta

from .analysis import Analysis, analyze
from .compat import compatibility
from .core import (BRANCHES, BRANCHES_KO, ELEMENTS, STEM_ELEMENT, STEMS, STEMS_KO, ZODIAC_LIST,
                   BirthInput, Chart, build_chart)
from .luck import day_luck, daewoon, seun, wolun
from .texts import (DAY_MASTER, ELEMENT_ADVICE, ELEMENT_EXCESS, ELEMENT_LACK, GROUP_TEXT, SINSAL_TEXT,
                    STAGE_TEXT, TEN_GOD_TEXT)


class SajuReading:
    def __init__(self, birth: BirthInput, today: date | None = None):
        self.today = today or date.today()
        self.chart: Chart = build_chart(birth)
        self.analysis: Analysis = analyze(self.chart)
        self.daewoon, self.daewoon_info = daewoon(self.chart, self.today)
        self.seun = seun(self.chart, self.today.year - 1, self.today.year + 8)
        self.wolun = wolun(self.chart, self.today.year)
        self.today_luck = day_luck(self.chart, self.today)

    # ------------------------------------------------------------------
    def interpretation(self) -> dict:
        c, a = self.chart, self.analysis
        dm = STEMS[c.day_stem]
        name, desc = DAY_MASTER[dm]
        lack = [e for e, w in a.element_weight.items() if w < 8]
        excess = [e for e, w in a.element_weight.items() if w >= 35]
        top_group = max(a.group_weight, key=a.group_weight.get)
        cur = next((p for p in self.daewoon if p.current), None)
        return {
            "일간": f"{dm}({STEMS_KO[c.day_stem]}) {name} — {desc}",
            "일주": f"{c.day} 일지 12운성 {a.stages['일']}: {STAGE_TEXT[a.stages['일']]}",
            "강약": (f"{a.strength}(지지세력 {a.strength_score}%) · 득령 {'O' if a.deukryeong else 'X'}"
                   f" 득지 {'O' if a.deukji else 'X'} 득세 {'O' if a.deukse else 'X'}"),
            "격국": f"{a.gyeokguk} — {a.gyeok_note}",
            "용신": (f"용신 {a.yongshin} / 희신 {a.huishin} / 기신 {a.gishin} / 구신 {a.gushin} / 한신 {a.hanshin}"
                   + (f" · 조후용신 {a.johu}" if a.johu else "") + f" — {a.yong_note}"),
            "가장 강한 십성": f"{top_group}({a.group_weight[top_group]}%) — {GROUP_TEXT[top_group][0]}: {GROUP_TEXT[top_group][1]}",
            "부족 오행": {e: ELEMENT_LACK[e] for e in lack},
            "과다 오행": {e: ELEMENT_EXCESS[e] for e in excess},
            "신살 풀이": {s.name: SINSAL_TEXT.get(s.name, "") for s in a.sinsal},
            "현재 대운": (cur.describe() + f" — 천간 {cur.stem_god}: {TEN_GOD_TEXT[cur.stem_god]}") if cur else None,
            "개운법": {"용신": a.yongshin, **ELEMENT_ADVICE[a.yongshin]},
        }

    def to_dict(self) -> dict:
        c, a = self.chart, self.analysis
        b = c.birth

        def pdict(p):
            return {"간지": p.hanja, "한글": p.hangul,
                    "천간": {"글자": STEMS[p.stem], "오행": ELEMENTS[STEM_ELEMENT[p.stem]],
                           "십성": a.ten_gods[p.label[0]]["천간"]},
                    "지지": {"글자": BRANCHES[p.branch], "십성": a.ten_gods[p.label[0]]["지지"],
                           "지장간": a.hidden[p.label[0]], "12운성": a.stages[p.label[0]]}}

        return {
            "입력": {"양력": c.solar_date.isoformat(), "음력": str(c.lunar_date),
                   "시각": None if b.hour is None else f"{b.hour:02d}:{b.minute:02d}",
                   "성별": b.gender, "띠": ZODIAC_LIST[c.year.branch], "보정": c.corrections},
            "원국": {p.label: pdict(p) for p in c.pillars},
            "오행": {"개수": a.element_count, "비중(%)": a.element_weight},
            "십성 비중(%)": a.group_weight,
            "강약": {"판정": a.strength, "점수": a.strength_score, "득령": a.deukryeong,
                   "득지": a.deukji, "득세": a.deukse},
            "격국": {"이름": a.gyeokguk, "근거": a.gyeok_note, "참고": a.notes},
            "용신": {"용신": a.yongshin, "희신": a.huishin, "기신": a.gishin, "구신": a.gushin,
                   "한신": a.hanshin, "조후": a.johu, "근거": a.yong_note},
            "합충형파해": [str(r) for r in a.relations],
            "신살": {s.name: s.where for s in a.sinsal},
            "12신살": a.twelve_sinsal,
            "공망": list(a.gongmang),
            "대운": {**self.daewoon_info, "목록": [p.describe() for p in self.daewoon]},
            "세운": [{"연도": y.year, "간지": str(y.pillar), "십성": f"{y.stem_god}/{y.branch_god}",
                    "12운성": y.stage, "작용": y.relations} for y in self.seun],
            "월운": [{"절입": m.start_kst.strftime("%Y-%m-%d %H:%M"), "간지": str(m.pillar),
                    "십성": f"{m.stem_god}/{m.branch_god}"} for m in self.wolun],
            "오늘": self.today_luck,
            "절입": {"직전": f"{c.prev_jie[1]} {(c.prev_jie[0] + timedelta(hours=9)):%Y-%m-%d %H:%M} KST",
                   "직후": f"{c.next_jie[1]} {(c.next_jie[0] + timedelta(hours=9)):%Y-%m-%d %H:%M} KST"},
            "해석": self.interpretation(),
            "주의": c.warnings,
        }

    # ------------------------------------------------------------------
    def to_markdown(self) -> str:
        c, a = self.chart, self.analysis
        d = self.to_dict()
        cols = [p for p in (c.hour, c.day, c.month, c.year)]
        head = ["", "시주", "일주", "월주", "연주"]

        def cell(p, f):
            return "—" if p is None else f(p)

        rows = [
            ["천간 십성"] + [cell(p, lambda p: a.ten_gods[p.label[0]]["천간"]) for p in cols],
            ["천간"] + [cell(p, lambda p: f"**{STEMS[p.stem]}** {STEMS_KO[p.stem]}·{ELEMENTS[STEM_ELEMENT[p.stem]]}") for p in cols],
            ["지지"] + [cell(p, lambda p: f"**{BRANCHES[p.branch]}** {BRANCHES_KO[p.branch]}") for p in cols],
            ["지지 십성"] + [cell(p, lambda p: a.ten_gods[p.label[0]]["지지"]) for p in cols],
            ["지장간"] + [cell(p, lambda p: " ".join(a.hidden[p.label[0]])) for p in cols],
            ["12운성"] + [cell(p, lambda p: a.stages[p.label[0]]) for p in cols],
            ["12신살"] + [cell(p, lambda p: a.twelve_sinsal["연지기준"][p.label[0]]) for p in cols],
        ]
        L = []
        nm = c.birth.name + " 님의 " if c.birth.name else ""
        L.append(f"# {nm}사주팔자\n")
        i = d["입력"]
        L.append(f"- 양력 {i['양력']} {i['시각'] or '(시각 미상)'} · {i['음력']} · {i['성별']} · {i['띠']}띠")
        if c.corrections:
            L.append(f"- 보정: {', '.join(c.corrections)}")
        L.append(f"- 절입: {d['절입']['직전']} → {d['절입']['직후']}\n")
        L.append("| " + " | ".join(head) + " |")
        L.append("|" + "---|" * len(head))
        for r in rows:
            L.append("| " + " | ".join(r) + " |")
        L.append("\n## 오행 분포\n")
        L.append("| 오행 | " + " | ".join(ELEMENTS) + " |")
        L.append("|---|---|---|---|---|---|")
        L.append("| 개수 | " + " | ".join(str(a.element_count[e]) for e in ELEMENTS) + " |")
        L.append("| 비중 | " + " | ".join(f"{a.element_weight[e]}%" + " " + "█" * int(a.element_weight[e] // 5) for e in ELEMENTS) + " |")
        L.append("\n십성 비중: " + ", ".join(f"{k} {v}%" for k, v in a.group_weight.items()))
        L.append("\n## 핵심 판단\n")
        for k, v in d["해석"].items():
            if isinstance(v, dict):
                if v:
                    L.append(f"- **{k}**: " + "; ".join(f"{kk}: {vv}" for kk, vv in v.items()))
            elif v:
                L.append(f"- **{k}**: {v}")
        if a.notes:
            L.append("- **특수격 참고**: " + "; ".join(a.notes))
        L.append("\n## 합충형파해 · 신살\n")
        L.append("- " + ("\n- ".join(d["합충형파해"]) if d["합충형파해"] else "원국 내 특별한 합충 없음"))
        L.append("- 신살: " + (", ".join(f"{k}({'·'.join(v)})" for k, v in d["신살"].items()) or "없음"))
        L.append(f"- 공망: {''.join(a.gongmang)}")
        L.append(f"\n## 대운 ({self.daewoon_info['direction']}, 대운수 {self.daewoon_info['daewoonsu']} — {self.daewoon_info['basis']})\n")
        L.append("| 나이 | 시작 | 간지 | 천간/지지 십성 | 12운성 |")
        L.append("|---|---|---|---|---|")
        for p in self.daewoon:
            star = " ★" if p.current else ""
            L.append(f"| {p.start_age}세{star} | {p.start_year} | {p.pillar} | {p.stem_god}/{p.branch_god} | {p.stage} |")
        L.append("\n## 세운\n")
        L.append("| 연도 | 간지 | 십성 | 12운성 | 원국과의 작용 |")
        L.append("|---|---|---|---|---|")
        for y in self.seun:
            L.append(f"| {y.year} | {y.pillar} | {y.stem_god}/{y.branch_god} | {y.stage} | {', '.join(y.relations) or '—'} |")
        L.append(f"\n## {self.today.year}년 월운\n")
        L.append("| 절입(KST) | 간지 | 십성 |")
        L.append("|---|---|---|")
        for m in self.wolun:
            L.append(f"| {m.label} {m.start_kst:%m-%d %H:%M} | {m.pillar} | {m.stem_god}/{m.branch_god} |")
        t = self.today_luck
        L.append(f"\n오늘({t['date']}) 일진 {t['day']} — {t['stem_god']}/{t['branch_god']}, {t['stage']}"
                 + (f", {', '.join(t['relations'])}" if t["relations"] else ""))
        if c.warnings:
            L.append("\n> ⚠ " + "\n> ⚠ ".join(c.warnings))
        L.append("\n> 사주는 성향과 흐름을 읽는 전통 해석 체계입니다. 건강·법률·투자 판단은 전문가와 상의하세요.")
        return "\n".join(L)

    def to_compact(self) -> str:
        """LLM 프롬프트용 압축 표현."""
        c, a = self.chart, self.analysis
        d = self.to_dict()
        i = d["입력"]
        lines = [
            f"입력 양력{i['양력']} {i['시각'] or '시각미상'} {i['음력']} {i['성별']} {i['띠']}띠 보정[{', '.join(c.corrections)}]",
            "원국(시일월연) " + " ".join(
                (f"{p.hanja}[{a.ten_gods[p.label[0]]['천간']}/{a.ten_gods[p.label[0]]['지지']}"
                 f",{a.stages[p.label[0]]},지장간{'·'.join(a.hidden[p.label[0]])}]") if p else "시주미상"
                for p in (c.hour, c.day, c.month, c.year)),
            "오행% " + " ".join(f"{k}{v}" for k, v in a.element_weight.items())
            + " | 개수 " + " ".join(f"{k}{v}" for k, v in a.element_count.items()),
            "십성% " + " ".join(f"{k}{v}" for k, v in a.group_weight.items()),
            f"강약 {a.strength}({a.strength_score}) 득령{int(a.deukryeong)} 득지{int(a.deukji)} 득세{int(a.deukse)}",
            f"격국 {a.gyeokguk} ({a.gyeok_note}) {' '.join(a.notes)}",
            f"용신 {a.yongshin} 희신 {a.huishin} 기신 {a.gishin} 구신 {a.gushin} 한신 {a.hanshin}"
            + (f" 조후 {a.johu}" if a.johu else "") + f" | {a.yong_note}",
            "합충 " + ("; ".join(d["합충형파해"]) or "없음"),
            "신살 " + (", ".join(f"{k}({'·'.join(v)})" for k, v in d["신살"].items()) or "없음")
            + f" | 공망 {''.join(a.gongmang)}",
            "12신살(연지) " + " ".join(f"{k}:{v}" for k, v in a.twelve_sinsal["연지기준"].items()),
            f"대운 {self.daewoon_info['direction']} 대운수{self.daewoon_info['daewoonsu']}: "
            + " | ".join(p.describe() for p in self.daewoon),
            "세운 " + " | ".join(f"{y.year}{y.pillar.hanja}{y.stem_god}/{y.branch_god}"
                                 + (f"[{';'.join(y.relations)}]" if y.relations else "") for y in self.seun),
            f"월운{self.today.year} " + " | ".join(f"{m.start_kst:%m/%d}{m.pillar.hanja}{m.stem_god}/{m.branch_god}" for m in self.wolun),
            f"오늘 {self.today_luck['date']} {self.today_luck['day']} {self.today_luck['stem_god']}/{self.today_luck['branch_god']} "
            + ";".join(self.today_luck["relations"]),
        ]
        if c.warnings:
            lines.append("주의 " + " / ".join(c.warnings))
        return "\n".join(lines)


def read_saju(year: int, month: int, day: int, hour: int | None = None, minute: int = 0,
              gender: str = "남", today: date | None = None, **kw) -> SajuReading:
    """편의 함수. kw: calendar, leap, longitude, apply_lmt, true_solar, apply_dst, zi_mode, name."""
    return SajuReading(BirthInput(year, month, day, hour, minute, gender, **kw), today)


def read_compatibility(r1: SajuReading, r2: SajuReading) -> dict:
    res = compatibility(r1.chart, r1.analysis, r2.chart, r2.analysis)
    res["1번"] = f"{r1.chart.day} 일주, {r1.analysis.strength}, 용신 {r1.analysis.yongshin}"
    res["2번"] = f"{r2.chart.day} 일주, {r2.analysis.strength}, 용신 {r2.analysis.yongshin}"
    return res
