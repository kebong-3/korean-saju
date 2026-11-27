"""3차 후기 P1·P2: 택일 14가지 · 별밤 제안 · 오늘의 인연 기준 · 가족 지도 기억 · 기념일 디데이 · 읽어 주기 · 만세력 인쇄 · 저장 한도."""
import itertools
import random
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from ksaju import read_saju  # noqa: E402
from sajunyang import taegil  # noqa: E402

JS = {p.stem: p.read_text(encoding="utf-8") for p in (ROOT / "public/js").glob("*.js")}
T = date(2026, 11, 28)


class TaegilTest(unittest.TestCase):
    def test_purposes(self):
        self.assertEqual(len(taegil.PURPOSES), 14)
        for k in ("wedding", "opening", "relocate", "travel", "car", "proposal", "launch", "begin"):
            self.assertIn(k, taegil.PURPOSES)
        names = " ".join(v[1] for v in taegil.PURPOSES.values())
        for medical in ("출산", "수술", "시술"):
            self.assertNotIn(medical, names, "의료 일정은 택일하지 않는다")
        c = TestClient(appmod.app)
        for k in taegil.PURPOSES:
            r = c.post("/api/taegil", json={"birth": {"year": 1995, "month": 5, "day": 5}, "purpose": k})
            self.assertEqual(r.status_code, 200, k)
            self.assertIn("의료진", r.json()["안내"])
        js = JS["records"]
        for k in taegil.PURPOSES:
            self.assertIn(f'["{k}",', js, f"화면에도 {k}")

    def test_purposes_pick_different_days(self):
        rnd, P, tot = random.Random(3), list(taegil.PURPOSES), []
        for _ in range(8):
            r = read_saju(rnd.randrange(1975, 2004), rnd.randrange(1, 13), rnd.randrange(1, 29), None, 0, gender=rnd.choice("남여"), today=T)
            picks = {p: {x["date"] for x in taegil.pick(r, p, T)["추천"]} for p in P}
            tot += [len(picks[a] & picks[b]) / 5 for a, b in itertools.combinations(P, 2)]
        self.assertLess(sum(tot) / len(tot), 0.45, "목적을 바꾸면 추천 날짜도 대체로 달라진다")

    def test_wedding_avoids_spouse_clash_and_relocate_uses_son(self):
        r = read_saju(1995, 5, 5, None, 0, gender="여", today=T)
        w = taegil.pick(r, "wedding", T)
        self.assertFalse(any("배우자 자리" in " ".join(x["주의"]) for x in w["추천"]))
        rl = taegil.pick(r, "relocate", T)
        self.assertTrue(any(x["손없는날"] for x in rl["추천"]))

    def test_two_days_wedding(self):
        j = TestClient(appmod.app).post("/api/twodays", json={"a": {"year": 1995, "month": 5, "day": 5}, "b": {"year": 1994, "month": 2, "day": 2},
                                                              "purpose": "wedding"}).json()
        self.assertEqual(j["목적"], "결혼식·상견례")


class ClientTest(unittest.TestCase):
    def test_night_suggest_once(self):
        self.assertIn('localStorage.getItem("nyang:nightAsked")', JS["look"])
        self.assertIn("setTimeout(nightSuggest", JS["shell"])

    def test_today_yeon_basis_and_family_cache(self):
        self.assertIn("고르는 법:", JS["inyeon"])
        self.assertIn('store.set("famcache"', JS["family"])

    def test_dday_speak_print_limits(self):
        self.assertIn('["dday", "기념일 디데이"', JS["gifts"])
        self.assertIn('\'@gift="dday"\'', JS["play"])
        self.assertIn('u.lang = "ko-KR"', JS["mydata"])
        self.assertIn("window.print()", JS["saju"])
        self.assertIn('store.set("people", l.slice(-50))', JS["gifts"])
        css = (ROOT / "public/style.css").read_text(encoding="utf-8")
        self.assertIn("html.printing .print-sheet { display: block;", css)


if __name__ == "__main__":
    unittest.main()
