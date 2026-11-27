"""후기 반영 3차: 점수 근거 · 보기 설정(차분한 말투·점수 숨기기·글자 크게) · 약속 보너스 구슬 · 문장 점검."""
import random
import re
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju import read_saju  # noqa: E402
from sajunyang.fortune import day_fortune  # noqa: E402

JS = {p.stem: p.read_text(encoding="utf-8") for p in (ROOT / "public/js").glob("*.js")}


class ScoreWhyTest(unittest.TestCase):
    def test_breakdown_adds_up(self):
        rnd = random.Random(4)
        for _ in range(15):
            r = read_saju(rnd.randrange(1975, 2006), rnd.randrange(1, 13), rnd.randrange(1, 29), rnd.randrange(24), 0, today=date(2026, 11, 27))
            for i in range(40):
                f = day_fortune(r, date(2026, 11, 27) + timedelta(days=i))
                self.assertEqual(sum(x["점"] for x in f["근거"]), f["점수"], f["근거"])
                self.assertEqual(f["근거"][0], {"말": "기본 점수", "점": 60})
                for x in f["근거"][1:3]:
                    self.assertRegex(x["말"], r"\((목|금)\)은 |\((화|토|수)\)는 ", "오행 이름에 맞는 조사")


class PrefsClientTest(unittest.TestCase):
    def test_calm_rule_keeps_cat_name(self):
        m = re.search(r"const CALM_RE = /(.+?)/g;", JS["look"])
        self.assertTrue(m)
        rx = re.compile(m.group(1))
        self.assertEqual(rx.sub(r"\1", "좋은 아침이다냥! 사주냥이가 보라냥. 같이 가자냥"), "좋은 아침이다! 사주냥이가 보라. 같이 가자")
        self.assertEqual(rx.sub(r"\1", "냥이 카드 · 60일주 냥이"), "냥이 카드 · 60일주 냥이")

    def test_prefs_wired(self):
        look = JS["look"]
        for k in ('data-pref="${key}"', "applyPrefs();", 'classList.toggle("big"', 'classList.toggle("noscore"'):
            self.assertIn(k, look)
        self.assertIn("hideScore()", JS["home"])
        self.assertIn('ring(t["점수"], t["등급"], "fortune")', JS["home"])
        self.assertIn('["@themesheet", "🌙", "보기 설정"]', JS["play"])

    def test_bonus_bead(self):
        talk = JS["talk"]
        self.assertIn("const beadMax = () => BEADS + beadBonus();", talk)
        self.assertIn('store.set("beadBonus", kstDate(0))', JS["look"], "약속을 지키면 오늘 보너스")

    def test_kinder_words(self):
        flow = JS["flow"]
        self.assertNotIn('past: "정리"', flow)
        self.assertIn("버텨 낸 시간", flow)
        self.assertIn("숨 고르는 날", JS["home"])
        self.assertNotIn("보고다냥", flow)

    def test_workplace_consent_note(self):
        self.assertIn("nyang:workNote", JS["inyeon"])


if __name__ == "__main__":
    unittest.main()
