"""명령줄 인터페이스.

  ksaju 1990-05-15 14:30 -g 여
  ksaju 1990-04-21 --lunar -g 남 --format json
  ksaju compat 1990-05-15/14:30/여 1988-11-03/08:00/남
  ksaju lunar 2025-08-15            (음력→양력)
  ksaju solar 2025-10-06            (양력→음력)
  ksaju day 2026-01-01              (일진)
"""
from __future__ import annotations

import argparse
import json
import sys
from datetime import date

from . import __version__
from .calendar import lunar_to_solar, solar_to_lunar
from .luck import day_ganzi
from .report import read_compatibility, read_saju


def _date(s: str) -> tuple[int, int, int]:
    y, m, d = (int(x) for x in s.split("-"))
    return y, m, d


def _time(s: str | None) -> tuple[int | None, int]:
    if not s or s in ("?", "모름"):
        return None, 0
    h, _, m = s.partition(":")
    return int(h), int(m or 0)


def _common(p: argparse.ArgumentParser):
    p.add_argument("--lunar", action="store_true", help="입력 날짜가 음력")
    p.add_argument("--leap", action="store_true", help="음력 윤달")
    p.add_argument("--lon", type=float, default=127.0, help="출생지 경도 (기본 127.0=서울 근사)")
    p.add_argument("--no-lmt", action="store_true", help="경도(지방시) 보정 끄기")
    p.add_argument("--true-solar", action="store_true", help="균시차까지 적용한 진태양시")
    p.add_argument("--no-dst", action="store_true", help="과거 서머타임 자동 보정 끄기")
    p.add_argument("--zi", choices=["unified", "split"], default="unified",
                   help="unified=23시 일주 변경(정자시) / split=야자시·조자시 구분")


def _kw(a) -> dict:
    return dict(calendar="lunar" if a.lunar else "solar", leap=a.leap, longitude=a.lon,
                apply_lmt=not a.no_lmt, true_solar=a.true_solar, apply_dst=not a.no_dst, zi_mode=a.zi)


def main(argv: list[str] | None = None) -> int:
    argv = list(sys.argv[1:] if argv is None else argv)
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    sub = argv[0] if argv and argv[0] in ("compat", "lunar", "solar", "day") else None

    if sub == "lunar":
        y, m, d = _date(argv[1])
        print(lunar_to_solar(y, m, d, "--leap" in argv).isoformat())
        return 0
    if sub == "solar":
        print(solar_to_lunar(*_date(argv[1])))
        return 0
    if sub == "day":
        d = date(*_date(argv[1])) if len(argv) > 1 else date.today()
        print(json.dumps(day_ganzi(d), ensure_ascii=False))
        return 0
    if sub == "compat":
        p = argparse.ArgumentParser(prog="ksaju compat")
        p.add_argument("p1", help="YYYY-MM-DD/HH:MM/성별")
        p.add_argument("p2")
        _common(p)
        a = p.parse_args(argv[1:])
        rs = []
        for spec in (a.p1, a.p2):
            ds, ts, g = (spec.split("/") + ["", "남"])[:3]
            h, mi = _time(ts)
            rs.append(read_saju(*_date(ds), h, mi, gender=g or "남", **_kw(a)))
        print(json.dumps(read_compatibility(*rs), ensure_ascii=False, indent=2))
        return 0

    p = argparse.ArgumentParser(prog="ksaju", description="한국 사주명리 계산기 " + __version__)
    p.add_argument("date", help="YYYY-MM-DD")
    p.add_argument("time", nargs="?", help="HH:MM (모르면 생략)")
    p.add_argument("-g", "--gender", default="남", choices=["남", "여"])
    p.add_argument("-n", "--name", default="")
    p.add_argument("--format", choices=["md", "json", "compact"], default="md")
    p.add_argument("--today", help="기준일 YYYY-MM-DD (대운·세운 계산용)")
    p.add_argument("--version", action="version", version=__version__)
    _common(p)
    a = p.parse_args(argv)
    h, mi = _time(a.time)
    today = date(*_date(a.today)) if a.today else None
    r = read_saju(*_date(a.date), h, mi, gender=a.gender, today=today, name=a.name, **_kw(a))
    if a.format == "json":
        print(json.dumps(r.to_dict(), ensure_ascii=False, indent=2, default=str))
    elif a.format == "compact":
        print(r.to_compact())
    else:
        print(r.to_markdown())
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
