import json
import os
import subprocess
import sys
import unittest
from datetime import date, datetime, timedelta

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "src"))

from ksaju import leap_month_of, lunar_to_solar, read_compatibility, read_saju, solar_to_lunar  # noqa: E402
from ksaju.astro import new_moon_k_near, new_moon_utc, solar_term_utc  # noqa: E402
from ksaju.luck import day_ganzi  # noqa: E402

KST = timedelta(hours=9)


class Astro(unittest.TestCase):
    def assertNear(self, got, expect, minutes=2):
        self.assertLessEqual(abs((got - expect).total_seconds()), minutes * 60, f"{got} vs {expect}")

    def test_solar_terms_vs_kasi(self):
        # 한국천문연구원 발표 절입 시각 (KST)
        self.assertNear(solar_term_utc(2024, 315) + KST, datetime(2024, 2, 4, 17, 27))
        self.assertNear(solar_term_utc(2024, 0) + KST, datetime(2024, 3, 20, 12, 6))
        self.assertNear(solar_term_utc(2025, 270) + KST, datetime(2025, 12, 22, 0, 3))
        self.assertNear(solar_term_utc(2023, 90) + KST, datetime(2023, 6, 21, 23, 58))

    def test_new_moon(self):
        k = new_moon_k_near(datetime(2024, 2, 10))
        self.assertNear(new_moon_utc(k) + KST, datetime(2024, 2, 10, 7, 59))


class Lunar(unittest.TestCase):
    def test_seollal(self):
        for y, m, d in [(2023, 1, 22), (2024, 2, 10), (2025, 1, 29), (2026, 2, 17), (1990, 1, 27), (1984, 2, 2)]:
            ld = solar_to_lunar(y, m, d)
            self.assertEqual((ld.month, ld.day, ld.leap), (1, 1, False), (y, m, d))

    def test_leap_months(self):
        self.assertEqual(leap_month_of(2020), 4)
        self.assertEqual(leap_month_of(2023), 2)
        self.assertEqual(leap_month_of(2025), 6)
        self.assertEqual(leap_month_of(2033), 11)
        self.assertIsNone(leap_month_of(2024))

    def test_roundtrip(self):
        self.assertEqual(lunar_to_solar(2025, 8, 15), date(2025, 10, 6))  # 추석
        self.assertEqual(lunar_to_solar(2023, 2, 1, True), date(2023, 3, 22))
        d = date(1950, 1, 1)
        while d < date(2050, 1, 1):
            ld = solar_to_lunar(d.year, d.month, d.day)
            self.assertEqual(lunar_to_solar(ld.year, ld.month, ld.day, ld.leap), d)
            d += timedelta(days=97)


class Pillars(unittest.TestCase):
    def test_known_day_pillars(self):
        self.assertEqual(day_ganzi(date(2000, 1, 1))["day"], "戊午(무오)")
        self.assertEqual(day_ganzi(date(1900, 1, 1))["day"], "甲戌(갑술)")
        self.assertEqual(day_ganzi(date(2024, 2, 10))["day"], "甲辰(갑진)")

    def test_year_changes_at_ipchun(self):
        before = read_saju(2024, 2, 4, 16, 0).chart
        after = read_saju(2024, 2, 4, 18, 0).chart
        self.assertEqual(before.year.hanja, "癸卯")
        self.assertEqual(before.month.hanja, "乙丑")
        self.assertEqual(after.year.hanja, "甲辰")
        self.assertEqual(after.month.hanja, "丙寅")
        self.assertTrue(before.warnings)

    def test_hour_pillar_and_lmt(self):
        c = read_saju(2000, 1, 1, 12, 0).chart
        self.assertEqual(c.hour.hanja, "戊午")
        # 경도 보정 끄면 12:00 → 午시 동일, 13:10 은 보정 시 午, 미보정 시 未
        self.assertEqual(read_saju(2000, 1, 1, 13, 10).chart.hour.hanja, "戊午")
        self.assertEqual(read_saju(2000, 1, 1, 13, 10, apply_lmt=False).chart.hour.hanja, "己未")

    def test_zi_modes(self):
        u = read_saju(2000, 1, 1, 23, 50, apply_lmt=False).chart
        s = read_saju(2000, 1, 1, 23, 50, apply_lmt=False, zi_mode="split").chart
        self.assertEqual(u.day.hanja, "己未")
        self.assertEqual(s.day.hanja, "戊午")
        self.assertEqual(u.hour.hanja, s.hour.hanja)  # 시주는 동일(甲子)

    def test_dst_1988(self):
        c = read_saju(1988, 7, 1, 10, 0).chart
        self.assertIn("서머타임 −60분", c.corrections)

    def test_unknown_hour(self):
        r = read_saju(1985, 3, 3)
        self.assertIsNone(r.chart.hour)
        self.assertEqual(len(r.chart.pillars), 3)

    def test_lunar_input(self):
        r = read_saju(1990, 4, 21, 14, 30, calendar="lunar")
        self.assertEqual(r.chart.solar_date, date(1990, 5, 15))


class Analysis(unittest.TestCase):
    def setUp(self):
        self.r = read_saju(1990, 5, 15, 14, 30, gender="여", today=date(2026, 11, 24))

    def test_structure(self):
        d = self.r.to_dict()
        self.assertAlmostEqual(sum(d["오행"]["비중(%)"].values()), 100, delta=0.5)
        self.assertEqual(d["원국"]["일주"]["간지"], "庚辰")
        self.assertIn("괴강살", d["신살"])
        self.assertEqual(self.r.daewoon_info["direction"], "역행")  # 庚(양)년 여자
        self.assertEqual(sum(p.current for p in self.r.daewoon), 1)
        json.dumps(d, ensure_ascii=False, default=str)

    def test_outputs(self):
        self.assertIn("| 천간 |", self.r.to_markdown())
        self.assertIn("용신", self.r.to_compact())

    def test_seun_relations_only_with_year(self):
        for y in self.r.seun:
            natal = {p.hanja[1] for p in self.r.chart.pillars}
            for rel in y.relations:
                # 세운 글자가 관여한 작용만 나와야 한다
                if rel.startswith(("삼합", "반합", "방합")):
                    self.assertIn(y.pillar.hanja[1], rel)
                else:
                    self.assertIn(f"{y.year}년", rel)
            self.assertTrue(natal)

    def test_compat(self):
        r2 = read_saju(1988, 11, 3, 8, 0)
        res = read_compatibility(self.r, r2)
        self.assertTrue(0 <= res["score"] <= 100)


class MCP(unittest.TestCase):
    def test_stdio(self):
        root = os.path.join(os.path.dirname(__file__), "..")
        msgs = [
            {"jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {}},
            {"jsonrpc": "2.0", "method": "notifications/initialized"},
            {"jsonrpc": "2.0", "id": 2, "method": "tools/list"},
            {"jsonrpc": "2.0", "id": 3, "method": "tools/call", "params": {
                "name": "calculate_saju", "arguments": {"year": 1990, "month": 5, "day": 15, "hour": 14, "gender": "여"}}},
        ]
        inp = "\n".join(json.dumps(m) for m in msgs) + "\n"
        out = subprocess.run([sys.executable, os.path.join(root, "scripts", "mcp.py")], input=inp.encode("utf-8"),
                             capture_output=True, timeout=60).stdout.decode("utf-8")
        replies = [json.loads(line) for line in out.splitlines() if line.strip()]
        self.assertEqual([r["id"] for r in replies], [1, 2, 3])
        self.assertEqual(len(replies[1]["result"]["tools"]), 5)
        self.assertIn("庚辰", replies[2]["result"]["content"][0]["text"])


if __name__ == "__main__":
    unittest.main()
