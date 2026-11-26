"""냥이 월령: 달마다 두 줄 노래가 붙고, 한 해 안에서 겹치지 않게 고르는지."""
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju import read_saju  # noqa: E402
from sajunyang import wolryeong  # noqa: E402
from sajunyang.fortune import bundle  # noqa: E402


class WolryeongTest(unittest.TestCase):
    def test_every_month_has_verse(self):
        for y, m, d in [(1997, 3, 12), (1985, 4, 2), (2001, 11, 30)]:
            b = bundle(read_saju(y, m, d, 8, gender="여", today=date(2026, 11, 26)), date(2026, 11, 26))
            ms = b["신년운세"]["월별"]
            self.assertEqual(len(ms), 12)
            for x in ms:
                v = x["월령"]
                self.assertEqual(len(v["구절"]), 2)
                self.assertTrue(v["계절"] and v["풀이"])
            firsts = [x["월령"]["구절"][0] for x in ms]
            # 이웃한 달끼리는 같은 노래가 나오지 않는다
            self.assertTrue(all(a != b for a, b in zip(firsts, firsts[1:])))
            self.assertIn("월령", b["이번달"])

    def test_tiers(self):
        self.assertEqual(wolryeong.tier(70), "good")
        self.assertEqual(wolryeong.tier(55), "mid")
        self.assertEqual(wolryeong.tier(40), "low")
        a = wolryeong.verse(5, "재성", 70, "편재")["구절"]
        b = wolryeong.verse(5, "재성", 70, "정재")["구절"]
        self.assertNotEqual(a, b)


if __name__ == "__main__":
    unittest.main()
