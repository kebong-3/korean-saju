"""ksaju — 외부 의존성 없는 한국 사주명리 엔진.

>>> from ksaju import read_saju
>>> r = read_saju(1990, 5, 15, 14, 30, gender="여")
>>> print(r.to_markdown())
"""
from .calendar import LunarDate, leap_month_of, lunar_to_solar, solar_to_lunar
from .core import BirthInput, build_chart
from .luck import day_ganzi
from .report import SajuReading, read_compatibility, read_saju

__version__ = "1.0.0"
__all__ = ["read_saju", "read_compatibility", "SajuReading", "BirthInput", "build_chart",
           "solar_to_lunar", "lunar_to_solar", "leap_month_of", "LunarDate", "day_ganzi"]
