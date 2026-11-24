"""한국 시간 이력(표준시·서머타임)과 한국 음력(태음태양력) 계산.

음력은 표를 내장하지 않고 천문 계산(합삭·중기)으로 생성한다.
규칙: 한국 표준시 기준 날짜로 합삭일을 초하루로 하고, 동지를 포함한 달을 11월로,
동지~동지 사이 13개월이면 중기가 없는 첫 달을 윤달로 둔다 (한국천문연구원 방식).
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, timedelta
from functools import lru_cache

from . import astro

# --------------------------------------------------------------------------
# 한국 표준시 이력 (UTC 오프셋, 분)
# --------------------------------------------------------------------------
_TZ_HISTORY = [
    # (시작(현지 벽시계), 오프셋 분)
    (datetime(1800, 1, 1), 510),            # 1908 이전: 동경 127.5° 기준으로 간주
    (datetime(1912, 1, 1), 540),            # 조선총독부 동경 135° (UTC+9)
    (datetime(1954, 3, 21), 510),           # 대한민국 UTC+8:30
    (datetime(1961, 8, 10), 540),           # UTC+9 복귀
]

# 서머타임(일광절약시간) — 현지 벽시계 기준 [시작, 끝)
_DST = [
    (datetime(1948, 6, 1, 0), datetime(1948, 9, 13, 0)),
    (datetime(1949, 4, 3, 0), datetime(1949, 9, 11, 0)),
    (datetime(1950, 4, 1, 0), datetime(1950, 9, 10, 0)),
    (datetime(1951, 5, 6, 0), datetime(1951, 9, 9, 0)),
    (datetime(1955, 5, 5, 0), datetime(1955, 9, 9, 0)),
    (datetime(1956, 5, 20, 0), datetime(1956, 9, 30, 0)),
    (datetime(1957, 5, 5, 0), datetime(1957, 9, 22, 0)),
    (datetime(1958, 5, 4, 0), datetime(1958, 9, 21, 0)),
    (datetime(1959, 5, 3, 0), datetime(1959, 9, 20, 0)),
    (datetime(1960, 5, 1, 0), datetime(1960, 9, 18, 0)),
    (datetime(1987, 5, 10, 2), datetime(1987, 10, 11, 3)),
    (datetime(1988, 5, 8, 2), datetime(1988, 10, 9, 3)),
]


def standard_offset_minutes(local: datetime) -> int:
    off = _TZ_HISTORY[0][1]
    for start, o in _TZ_HISTORY:
        if local >= start:
            off = o
    return off


def dst_active(local: datetime) -> bool:
    return any(s <= local < e for s, e in _DST)


def local_to_utc(local: datetime, apply_dst: bool = True) -> tuple[datetime, int, bool]:
    """현지 벽시계 → (UTC, 표준시 오프셋 분, 서머타임 적용여부)."""
    off = standard_offset_minutes(local)
    dst = apply_dst and dst_active(local)
    utc = local - timedelta(minutes=off + (60 if dst else 0))
    return utc, off, dst


def utc_to_kst_date(utc: datetime) -> date:
    """UTC 순간 → 그 시대 한국 표준시 기준 날짜(음력 계산용)."""
    guess = utc + timedelta(minutes=540)
    off = standard_offset_minutes(guess)
    return (utc + timedelta(minutes=off)).date()


# --------------------------------------------------------------------------
# 음력
# --------------------------------------------------------------------------
@dataclass(frozen=True)
class LunarDate:
    year: int
    month: int
    day: int
    leap: bool = False

    def __str__(self) -> str:
        return f"음력 {self.year}.{self.month:02d}.{self.day:02d}{'(윤)' if self.leap else ''}"


def _new_moon_date(k: int) -> date:
    return utc_to_kst_date(astro.new_moon_utc(k))


def _month_start_on_or_before(d: date) -> int:
    k = astro.new_moon_k_near(datetime(d.year, d.month, d.day)) + 1
    while _new_moon_date(k) > d:
        k -= 1
    return k


@lru_cache(maxsize=None)
def _principal_term_dates(year: int) -> tuple[date, ...]:
    """해당 연도의 중기(황경 30°의 배수) 12개 날짜."""
    return tuple(sorted(utc_to_kst_date(astro.solar_term_utc(year, deg))
                        for deg in range(0, 360, 30)))


def _has_principal_term(start: date, end: date) -> bool:
    for y in {start.year, end.year}:
        for d in _principal_term_dates(y):
            if start <= d < end:
                return True
    return False


@lru_cache(maxsize=None)
def _sui(year: int) -> tuple[tuple[date, int, bool], ...]:
    """(year-1)년 동지월 ~ year년 동지월 직전까지의 달 목록: (초하루, 월, 윤달)."""
    ws_prev = utc_to_kst_date(astro.solar_term_utc(year - 1, 270))
    ws_this = utc_to_kst_date(astro.solar_term_utc(year, 270))
    k0 = _month_start_on_or_before(ws_prev)
    k1 = _month_start_on_or_before(ws_this)
    starts = [_new_moon_date(k) for k in range(k0, k1 + 1)]  # 마지막은 다음 11월
    leap_year = (k1 - k0) == 13
    months = []
    num = 11
    leap_used = False
    for i in range(k1 - k0):
        if i == 0:
            months.append((starts[0], 11, False))
            continue
        if leap_year and not leap_used and not _has_principal_term(starts[i], starts[i + 1]):
            months.append((starts[i], num, True))
            leap_used = True
            continue
        num = num % 12 + 1
        months.append((starts[i], num, False))
    months.append((starts[-1], 11, False))  # 센티넬(다음 해 11월)
    return tuple(months)


def solar_to_lunar(y: int, m: int, d: int) -> LunarDate:
    target = date(y, m, d)
    sui_year = y if target < _sui(y + 1)[0][0] else y + 1
    months = _sui(sui_year)
    for i in range(len(months) - 1):
        start, num, leap = months[i]
        if start <= target < months[i + 1][0]:
            # 11·12월(동지월 이후, 정월 전)은 전년도 음력 연도
            first_month_idx = next(j for j, (_, n, lp) in enumerate(months) if n == 1 and not lp)
            lyear = sui_year - 1 if i < first_month_idx else sui_year
            return LunarDate(lyear, num, (target - start).days + 1, leap)
    raise ValueError("음력 변환 범위를 벗어났습니다")


def lunar_to_solar(y: int, m: int, d: int, leap: bool = False) -> date:
    for sui_year in (y, y + 1):
        months = _sui(sui_year)
        first_idx = next(j for j, (_, n, lp) in enumerate(months) if n == 1 and not lp)
        for i in range(len(months) - 1):
            start, num, lp = months[i]
            lyear = sui_year - 1 if i < first_idx else sui_year
            if lyear == y and num == m and lp == leap:
                length = (months[i + 1][0] - start).days
                if not 1 <= d <= length:
                    raise ValueError(f"음력 {y}년 {'윤' if leap else ''}{m}월은 {length}일까지입니다")
                return start + timedelta(days=d - 1)
    raise ValueError(f"음력 {y}년에 {'윤' if leap else ''}{m}월이 없습니다")


def leap_month_of(year: int) -> int | None:
    """음력 year 년의 윤달 번호(없으면 None)."""
    for sui_year in (year, year + 1):
        months = _sui(sui_year)
        first_idx = next(j for j, (_, n, lp) in enumerate(months) if n == 1 and not lp)
        for i, (_, num, lp) in enumerate(months[:-1]):
            lyear = sui_year - 1 if i < first_idx else sui_year
            if lp and lyear == year:
                return num
    return None
