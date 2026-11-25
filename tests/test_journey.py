from __future__ import annotations

import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju import read_saju  # noqa: E402
from sajunyang import journey  # noqa: E402
from sajunyang.fortune import bundle  # noqa: E402

TODAY = date(2026, 11, 25)
PEOPLE = [(1987, 3, 25, 19, "남"), (1992, 8, 1, None, "여"), (1960, 1, 15, 6, "남"), (2005, 12, 31, 23, "여"), (1975, 6, 6, 12, "여")]


class JourneyTest(unittest.TestCase):
    def test_build(self):
        for y, m, d, h, g in PEOPLE:
            r = read_saju(y, m, d, h, 0, gender=g, today=TODAY)
            fx = bundle(r, TODAY)
            j = journey.build(r, fx, TODAY, f"{y}{m}{d}")
            past, fut, w = j["지난해들"], j["앞으로"], j["한구절"]
            self.assertTrue(past and past[0]["연도"] == TODAY.year - 1)
            self.assertTrue(all(len(p["질문"]) == 2 and "냥" in p["질문"][0] for p in past))
            self.assertEqual(fut[0]["연도"], TODAY.year)
            self.assertTrue(all(len(f["준비"]) == 3 and f["키워드"] and f["조심"] for f in fut))
            for k in ("출전", "원문", "뜻", "풀이"):
                self.assertTrue(w[k])

    def test_wisdom_rotates(self):
        r = read_saju(1987, 3, 25, 19, 30, gender="남", today=TODAY)
        seen = {journey.wisdom(r, date(2026, 11, d), "x")["원문"] for d in range(1, 29)}
        self.assertGreater(len(seen), 5)


if __name__ == "__main__":
    unittest.main()
