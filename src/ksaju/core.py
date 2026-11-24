"""간지 상수와 사주팔자(四柱八字) 원국 계산."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import date, datetime, timedelta

from . import astro
from .calendar import LunarDate, local_to_utc, lunar_to_solar, solar_to_lunar

STEMS = "甲乙丙丁戊己庚辛壬癸"
STEMS_KO = "갑을병정무기경신임계"
BRANCHES = "子丑寅卯辰巳午未申酉戌亥"
BRANCHES_KO = "자축인묘진사오미신유술해"
ZODIAC = "쥐소호랑이토끼용뱀말양원숭이닭개돼지"
ZODIAC_LIST = ["쥐", "소", "호랑이", "토끼", "용", "뱀", "말", "양", "원숭이", "닭", "개", "돼지"]
ELEMENTS = ["목", "화", "토", "금", "수"]
ELEMENTS_HANJA = "木火土金水"
STEM_ELEMENT = [0, 0, 1, 1, 2, 2, 3, 3, 4, 4]
BRANCH_ELEMENT = [4, 2, 0, 0, 2, 1, 1, 2, 3, 3, 2, 4]
# 지장간 (여기, 중기, 정기) — (천간 index, 일수)
HIDDEN = {
    0: [(8, 10), (9, 20)],
    1: [(9, 9), (7, 3), (5, 18)],
    2: [(4, 7), (2, 7), (0, 16)],
    3: [(0, 10), (1, 20)],
    4: [(1, 9), (9, 3), (4, 18)],
    5: [(4, 7), (6, 7), (2, 16)],
    6: [(2, 10), (5, 9), (3, 11)],
    7: [(3, 9), (1, 3), (5, 18)],
    8: [(4, 7), (8, 7), (6, 16)],
    9: [(6, 10), (7, 20)],
    10: [(7, 9), (3, 3), (4, 18)],
    11: [(4, 7), (0, 7), (8, 16)],
}
TERM_NAMES = {  # 태양 황경 → 절기명
    315: "입춘", 330: "우수", 345: "경칩", 0: "춘분", 15: "청명", 30: "곡우",
    45: "입하", 60: "소만", 75: "망종", 90: "하지", 105: "소서", 120: "대서",
    135: "입추", 150: "처서", 165: "백로", 180: "추분", 195: "한로", 210: "상강",
    225: "입동", 240: "소설", 255: "대설", 270: "동지", 285: "소한", 300: "대한",
}
JIE_DEGREES = [315, 345, 15, 45, 75, 105, 135, 165, 195, 225, 255, 285]  # 寅月~丑月 절입
TEN_GODS = ["비견", "겁재", "식신", "상관", "편재", "정재", "편관", "정관", "편인", "정인"]
TEN_GOD_GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성",
                 "정재": "재성", "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}
TWELVE_STAGES = ["장생", "목욕", "관대", "건록", "제왕", "쇠", "병", "사", "묘", "절", "태", "양"]
_LONGEVITY_START = {0: 11, 1: 6, 2: 2, 3: 9, 4: 2, 5: 9, 6: 5, 7: 0, 8: 8, 9: 3}
HOUR_NAMES = ["자시", "축시", "인시", "묘시", "진시", "사시", "오시", "미시", "신시", "유시", "술시", "해시"]

# 1900-01-01 = 甲戌일 (60갑자 index 10)
_DAY_ANCHOR = date(1900, 1, 1)
_DAY_ANCHOR_IDX = 10


def ganzi(idx: int) -> str:
    return STEMS[idx % 10] + BRANCHES[idx % 12]


def ganzi_ko(idx: int) -> str:
    return STEMS_KO[idx % 10] + BRANCHES_KO[idx % 12]


def sexagenary_index(stem: int, branch: int) -> int:
    for i in range(60):
        if i % 10 == stem and i % 12 == branch:
            return i
    raise ValueError("음양이 맞지 않는 간지 조합")


def is_yang_stem(s: int) -> bool:
    return s % 2 == 0


def ten_god(day_stem: int, other_stem: int) -> str:
    de, oe = STEM_ELEMENT[day_stem], STEM_ELEMENT[other_stem]
    same = (day_stem % 2) == (other_stem % 2)
    rel = (oe - de) % 5
    base = {0: 0, 1: 2, 2: 4, 3: 6, 4: 8}[rel]
    return TEN_GODS[base + (0 if same else 1)]


def element_ten_god_group(day_stem: int, element: int) -> str:
    rel = (element - STEM_ELEMENT[day_stem]) % 5
    return ["비겁", "식상", "재성", "관성", "인성"][rel]


def twelve_stage(stem: int, branch: int) -> str:
    start = _LONGEVITY_START[stem]
    off = (branch - start) % 12 if is_yang_stem(stem) else (start - branch) % 12
    return TWELVE_STAGES[off]


def branch_main_stem(branch: int) -> int:
    return HIDDEN[branch][-1][0]


def day_index(d: date) -> int:
    return (_DAY_ANCHOR_IDX + (d - _DAY_ANCHOR).days) % 60


def year_index(saju_year: int) -> int:
    return (saju_year - 4) % 60


def month_index(year_stem: int, month_no: int) -> int:
    """month_no: 0=寅月 … 11=丑月. 오호둔(五虎遁)."""
    first_stem = (year_stem % 5) * 2 + 2  # 甲己→丙, 乙庚→戊 ...
    return sexagenary_index((first_stem + month_no) % 10, (2 + month_no) % 12)


def hour_index(day_stem: int, hour_branch: int) -> int:
    """오서둔(五鼠遁): 甲己일 → 甲子시."""
    return sexagenary_index(((day_stem % 5) * 2 + hour_branch) % 10, hour_branch)


def term_instants(year: int) -> list[tuple[datetime, str, int]]:
    """해당 연도 24절기 (UTC, 이름, 황경) 시간순."""
    out = [(astro.solar_term_utc(year, deg), name, deg) for deg, name in TERM_NAMES.items()]
    return sorted(out)


def jie_instants_around(utc: datetime) -> tuple[tuple[datetime, str], tuple[datetime, str]]:
    """utc 직전·직후의 '절'(월 경계) 시각."""
    cands = []
    for y in (utc.year - 1, utc.year, utc.year + 1):
        for deg in JIE_DEGREES:
            cands.append((astro.solar_term_utc(y, deg), TERM_NAMES[deg]))
    cands.sort()
    prev = max(c for c in cands if c[0] <= utc)
    nxt = min(c for c in cands if c[0] > utc)
    return prev, nxt


@dataclass
class Pillar:
    index: int
    label: str  # 연주/월주/일주/시주

    @property
    def stem(self) -> int:
        return self.index % 10

    @property
    def branch(self) -> int:
        return self.index % 12

    @property
    def hanja(self) -> str:
        return ganzi(self.index)

    @property
    def hangul(self) -> str:
        return ganzi_ko(self.index)

    def __str__(self) -> str:
        return f"{self.hanja}({self.hangul})"


@dataclass
class BirthInput:
    year: int
    month: int
    day: int
    hour: int | None = None
    minute: int = 0
    gender: str = "남"  # 남 / 여
    calendar: str = "solar"  # solar / lunar
    leap: bool = False
    longitude: float = 127.0  # 서울 ≈ 126.98
    apply_lmt: bool = True  # 경도 보정(지방평균시)
    true_solar: bool = False  # 균시차까지 적용(진태양시)
    apply_dst: bool = True  # 과거 서머타임 자동 보정
    zi_mode: str = "unified"  # unified: 23시에 날 바뀜 / split: 야자시(23~24시는 당일 일주)
    name: str = ""


@dataclass
class Chart:
    birth: BirthInput
    solar_date: date
    lunar_date: LunarDate
    utc: datetime
    solar_time: datetime  # 보정된 지방시(시주 판정용)
    corrections: list[str]
    year: Pillar
    month: Pillar
    day: Pillar
    hour: Pillar | None
    prev_jie: tuple[datetime, str]
    next_jie: tuple[datetime, str]
    warnings: list[str] = field(default_factory=list)

    @property
    def pillars(self) -> list[Pillar]:
        return [p for p in (self.hour, self.day, self.month, self.year) if p is not None]

    @property
    def day_stem(self) -> int:
        return self.day.stem


def build_chart(b: BirthInput) -> Chart:
    if b.gender not in ("남", "여"):
        raise ValueError("gender 는 '남' 또는 '여'")
    if b.calendar == "lunar":
        sd = lunar_to_solar(b.year, b.month, b.day, b.leap)
    else:
        sd = date(b.year, b.month, b.day)
    hour_known = b.hour is not None
    h = b.hour if hour_known else 12
    local = datetime(sd.year, sd.month, sd.day, h, b.minute)
    utc, offset, dst = local_to_utc(local, b.apply_dst)
    corrections: list[str] = []
    warnings: list[str] = []
    if dst:
        corrections.append("서머타임 −60분")
    if offset != 540:
        corrections.append(f"당시 표준시 UTC+{offset // 60}:{offset % 60:02d}")

    # 시주 판정용 지방시
    if b.apply_lmt or b.true_solar:
        solar_time = utc + timedelta(minutes=b.longitude * 4)
        corrections.append(f"경도 {b.longitude}° 지방평균시")
        if b.true_solar:
            eot = astro.equation_of_time_minutes(utc)
            solar_time += timedelta(minutes=eot)
            corrections.append(f"균시차 {eot:+.1f}분")
    else:
        solar_time = utc + timedelta(minutes=offset)
    if hour_known:
        delta = round((solar_time - local).total_seconds() / 60)
        corrections.append(f"시주 판정 시각 {solar_time:%H:%M} (입력 대비 {delta:+d}분)")

    # 연·월주: 태양 황경(절입) 기준 — 실제 순간(UTC)으로 판정
    lon = astro.sun_longitude_at(utc)
    month_no = int(((lon - 315) % 360) // 30)  # 0=寅
    ipchun = astro.solar_term_utc(sd.year, 315)
    saju_year = sd.year if utc >= ipchun else sd.year - 1
    # 1월 초(소한~입춘 전)는 전년도 — 위 비교가 처리
    y_idx = year_index(saju_year)
    m_idx = month_index(y_idx % 10, month_no)

    # 일·시주: 보정된 지방시 기준
    st = solar_time
    hour_branch = ((st.hour + 1) // 2) % 12
    day_date = st.date()
    if st.hour == 23 and b.zi_mode == "unified":
        day_date = day_date + timedelta(days=1)
    d_idx = day_index(day_date)
    if st.hour == 23 and b.zi_mode == "split":
        # 야자시: 일주는 당일, 시주 천간은 다음날 기준
        h_idx = hour_index((d_idx + 1) % 10, 0)
    else:
        h_idx = hour_index(d_idx % 10, hour_branch)

    prev_jie, next_jie = jie_instants_around(utc)
    for t, name in (prev_jie, next_jie):
        gap = abs((utc - t).total_seconds()) / 3600
        if gap < 2:
            warnings.append(f"{name} 절입 {gap * 60:.0f}분 전후 출생 — 월주(연주)가 경계에 있으니 출생 시각을 꼭 확인하세요")
    if hour_known:
        mins = st.hour * 60 + st.minute
        edge = min(abs(mins - (2 * k - 1) * 60) % 1440 for k in range(13))
        if edge < 10:
            warnings.append("시(時) 경계 10분 이내 출생 — 시주가 바뀔 수 있습니다")
    else:
        warnings.append("출생 시각 미상 — 시주 없이 삼주(三柱)로 풀이합니다")

    return Chart(
        birth=b, solar_date=sd, lunar_date=solar_to_lunar(sd.year, sd.month, sd.day),
        utc=utc, solar_time=solar_time, corrections=corrections,
        year=Pillar(y_idx, "연주"), month=Pillar(m_idx, "월주"), day=Pillar(d_idx, "일주"),
        hour=Pillar(h_idx, "시주") if hour_known else None,
        prev_jie=prev_jie, next_jie=next_jie, warnings=warnings,
    )
