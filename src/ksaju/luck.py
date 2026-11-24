"""운의 흐름: 대운(大運)·세운(歲運)·월운(月運)·일진(日辰)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta

from . import astro
from .analysis import find_relations
from .core import (JIE_DEGREES, TERM_NAMES, Chart, Pillar, branch_main_stem, day_index, ganzi,
                   ganzi_ko, is_yang_stem, month_index, ten_god, twelve_stage, year_index)


@dataclass
class LuckPeriod:
    pillar: Pillar
    start_age: int  # 한국식 대운수 기준 나이(만 나이)
    start_year: int
    stem_god: str
    branch_god: str
    stage: str
    current: bool = False

    def describe(self) -> str:
        return (f"{self.start_age:>2}세({self.start_year}~) {self.pillar} "
                f"{self.stem_god}/{self.branch_god} {self.stage}{' ★' if self.current else ''}")


def daewoon(chart: Chart, today: date | None = None, count: int = 10) -> tuple[list[LuckPeriod], dict]:
    today = today or date.today()
    forward = is_yang_stem(chart.year.stem) == (chart.birth.gender == "남")
    target = chart.next_jie if forward else chart.prev_jie
    days = abs((target[0] - chart.utc).total_seconds()) / 86400
    years_exact = days / 3  # 3일 = 1년, 1일 = 4개월
    su = max(1, round(years_exact))
    info = {
        "direction": "순행" if forward else "역행",
        "basis": f"{'다음' if forward else '이전'} 절기 {target[1]}까지 {days:.2f}일 ÷ 3",
        "exact_years": round(years_exact, 2),
        "daewoonsu": su,
    }
    periods = []
    by = chart.solar_date.year
    age_now = today.year - by - ((today.month, today.day) < (chart.solar_date.month, chart.solar_date.day))
    ds = chart.day_stem
    for k in range(1, count + 1):
        idx = (chart.month.index + (k if forward else -k)) % 60
        p = Pillar(idx, f"대운{k}")
        start_age = su + (k - 1) * 10
        periods.append(LuckPeriod(
            pillar=p, start_age=start_age, start_year=by + start_age,
            stem_god=ten_god(ds, p.stem), branch_god=ten_god(ds, branch_main_stem(p.branch)),
            stage=twelve_stage(ds, p.branch),
            current=start_age <= age_now < start_age + 10,
        ))
    return periods, info


@dataclass
class YearLuck:
    year: int
    pillar: Pillar
    stem_god: str
    branch_god: str
    stage: str
    relations: list[str]


def seun(chart: Chart, start: int, end: int) -> list[YearLuck]:
    out = []
    ds = chart.day_stem
    for y in range(start, end + 1):
        p = Pillar(year_index(y), f"{y}년")
        rels = [str(r) for r in find_relations(chart.pillars, [p])]
        out.append(YearLuck(y, p, ten_god(ds, p.stem), ten_god(ds, branch_main_stem(p.branch)),
                            twelve_stage(ds, p.branch), rels))
    return out


@dataclass
class MonthLuck:
    label: str
    start_kst: datetime
    pillar: Pillar
    stem_god: str
    branch_god: str


def wolun(chart: Chart, year: int) -> list[MonthLuck]:
    """year 년(입춘~다음 입춘) 12개월의 월운."""
    ds = chart.day_stem
    ys = year_index(year) % 10
    out = []
    for m, deg in enumerate(JIE_DEGREES):
        y = year if m < 11 else year + 1  # 丑月(소한)은 다음 해 1월
        t = astro.solar_term_utc(y, deg) + timedelta(hours=9)
        p = Pillar(month_index(ys, m), "월운")
        out.append(MonthLuck(f"{TERM_NAMES[deg]}~", t, p, ten_god(ds, p.stem),
                             ten_god(ds, branch_main_stem(p.branch))))
    return out


def day_ganzi(d: date) -> dict:
    """해당 날짜의 일진과 연·월 간지(정오 KST 기준)."""
    utc = datetime(d.year, d.month, d.day, 3, 0)
    lon = astro.sun_longitude_at(utc)
    mno = int(((lon - 315) % 360) // 30)
    sy = d.year if utc >= astro.solar_term_utc(d.year, 315) else d.year - 1
    yi = year_index(sy)
    mi = month_index(yi % 10, mno)
    di = day_index(d)
    return {"date": d.isoformat(), "year": f"{ganzi(yi)}({ganzi_ko(yi)})",
            "month": f"{ganzi(mi)}({ganzi_ko(mi)})", "day": f"{ganzi(di)}({ganzi_ko(di)})",
            "day_index": di}


def day_luck(chart: Chart, d: date) -> dict:
    g = day_ganzi(d)
    p = Pillar(g["day_index"], "일진")
    ds = chart.day_stem
    g.update({
        "stem_god": ten_god(ds, p.stem), "branch_god": ten_god(ds, branch_main_stem(p.branch)),
        "stage": twelve_stage(ds, p.branch),
        "relations": [str(r) for r in find_relations(chart.pillars, [p])],
    })
    return g
