"""3·4주차: 위기 문장 감지 · 상담 기억 필드 · 만세력 1,000명 회귀 검사."""
import random
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

import app as appmod  # noqa: E402
from ksaju.calendar import lunar_to_solar, solar_to_lunar  # noqa: E402
from ksaju.core import BirthInput, build_chart, day_index  # noqa: E402


class SafetyTest(unittest.TestCase):
    def test_crisis_phrases(self):
        for s in ("요즘 죽고 싶어", "그만 살고 싶다", "사라지고 싶어요", "없어지고 싶어", "극단적인 선택을 생각해",
                  "살 이유가 없어", "다 끝내고 싶어", "뛰어내리고 싶다", "I want to die"):
            self.assertTrue(appmod.CRISIS.search(s), s)
        for s in ("오늘 회사 가기 싫어", "자살골 넣은 꿈을 꿨어", "연애운이 궁금해", "이직하고 싶어"):
            self.assertFalse(appmod.CRISIS.search(s), s)

    def test_ai_request_accepts_memo(self):
        req = appmod.AIReq(birth={"year": 1999, "month": 8, "day": 21}, memo=["11-20 고민: 이직"],
                           messages=[{"role": "user", "content": "안녕"}])
        self.assertEqual(req.memo, ["11-20 고민: 이직"])
        with self.assertRaises(Exception):
            appmod.AIReq(birth={"year": 1999, "month": 8, "day": 21}, memo=["x"] * 7)


class RegressionTest(unittest.TestCase):
    """무작위 1,000명: 음력 왕복, 일주 연속성, 연주·월주가 절기에서만 바뀌는지."""

    def test_thousand_random_births(self):
        rnd = random.Random(20261127)
        start, span = date(1901, 3, 1), (date(2099, 10, 1) - date(1901, 3, 1)).days
        for _ in range(1000):
            d = start + timedelta(days=rnd.randrange(span))
            lun = solar_to_lunar(d.year, d.month, d.day)
            self.assertEqual(lunar_to_solar(lun.year, lun.month, lun.day, lun.leap), d, f"음력 왕복 {d}")
            self.assertEqual((day_index(d + timedelta(days=1)) - day_index(d)) % 60, 1)
            h = rnd.randrange(24)
            c = build_chart(BirthInput(d.year, d.month, d.day, h, rnd.randrange(60), gender=rnd.choice("남여")))
            # 월간은 연간에서 오호둔으로 정해진다
            first = (c.year.stem % 5) * 2 + 2
            self.assertEqual((c.month.stem - first) % 10, (c.month.branch - 2) % 12 % 10, f"오호둔 {d}")
            if c.hour:
                self.assertEqual(c.hour.stem, ((c.day.stem % 5) * 2 + c.hour.branch) % 10, f"오서둔 {d} {h}시")


if __name__ == "__main__":
    unittest.main()
