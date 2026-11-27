"""냥이의 선물: 행운 부적 · 우리 둘 좋은 날 · 기분 리포트 · 생일 냥이 · 입체 아이콘."""
import re
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import extras  # noqa: E402

ME = {"year": 1999, "month": 8, "day": 21, "hour": 9, "name": "지은"}


class GiftApiTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(appmod.app)
        cls.today = appmod.today_kst()

    def test_charm_never_mentions_low_days(self):
        for i in range(1, 40):
            d = (self.today + timedelta(days=i)).isoformat()
            j = self.c.post("/api/charm", json={"birth": ME, "day": d, "purpose": "exam", "wish": "9급 <b>합격</b>!"}).json()
            self.assertNotIn("점수", j)
            self.assertEqual(j["글자"], "合格祈願")
            self.assertTrue(j["행운"]["색"] and j["행운"]["소품"])
            for bad in ("쉬어 가는", "낮은", "나쁜", "안 좋"):
                self.assertNotIn(bad, j["지킴"] + j["기운"] + j["응원"])
            self.assertEqual(j["소원"], "9급 합격!")

    def test_charm_date_range(self):
        past = (self.today - timedelta(days=1)).isoformat()
        self.assertEqual(self.c.post("/api/charm", json={"birth": ME, "day": past}).status_code, 400)
        self.assertEqual(self.c.post("/api/charm", json={"birth": ME, "day": self.today.isoformat(), "purpose": "nope"}).status_code, 422)

    def test_two_days(self):
        j = self.c.post("/api/twodays", json={"a": ME, "b": {"year": 1997, "month": 4, "day": 4}, "purpose": "trip"}).json()
        self.assertEqual(len(j["추천"]), 5)
        self.assertEqual(j["추천"][0]["별"], 5, "60일 중 가장 좋은 날은 별 다섯")
        for key in ("이유", "한줄"):
            self.assertEqual(len({x[key] for x in j["추천"]}), 5, f"다섯 날의 {key}가 겹치지 않는다")
        self.assertTrue(all(x["주말"] for x in j["주말추천"]))
        for x in j["추천"]:
            self.assertGreater(date.fromisoformat(x["날짜"]), self.today)

    def test_mood_report(self):
        recs = [{"d": (self.today - timedelta(days=i)).isoformat(), "m": i % 3} for i in range(1, 21)]
        j = self.c.post("/api/moodreport", json={"birth": ME, "records": recs}).json()
        self.assertEqual(j["기록수"], 20)
        self.assertEqual(sum(v["수"] for v in j["오행"].values()), 20)
        self.assertTrue(j["말"])
        few = [{"d": (self.today - timedelta(days=i)).isoformat(), "m": i % 3} for i in range(1, 6)]
        f = self.c.post("/api/moodreport", json={"birth": ME, "records": few}).json()
        self.assertFalse(f["확신"])
        self.assertIsNone(f["좋은기운"])
        self.assertIn("이르다", f["말"][0])
        self.assertIsNone(f["상관"], "기록 10일 전엔 점수와의 닮음을 말하지 않는다")
        future = [{"d": (self.today + timedelta(days=3)).isoformat(), "m": 1}]
        self.assertEqual(self.c.post("/api/moodreport", json={"birth": ME, "records": future}).status_code, 400)

    def test_birthdays(self):
        ppl = [{"name": "엄마", "birth": {"year": 1968, "month": 12, "day": 3, "calendar": "lunar"}},
               {"name": "윤년", "birth": {"year": 2000, "month": 2, "day": 29}}, {"name": "지은", "birth": ME}]
        out = self.c.post("/api/birthdays", json={"people": ppl}).json()["생일"]
        self.assertEqual([x["디데이"] for x in out], sorted(x["디데이"] for x in out))
        by = {x["이름"]: x for x in out}
        self.assertTrue(by["엄마"]["음력"])
        # 음력 생일은 '그 생일이 속한 해'로 나이를 센다
        y = date.fromisoformat(by["엄마"]["날짜"]).year
        self.assertIn(by["엄마"]["나이"], (y - 1968, y - 1 - 1968))
        self.assertIn(by["윤년"]["날짜"][5:], ("02-28", "02-29"))

    def test_next_birthday_lunar_december(self):
        class B:  # 음력 12월생: 생일이 이듬해 1월(양력)에 온다
            calendar, leap, month, day, year = "lunar", False, 12, 3, 1968
        d, y = extras.next_birthday(B, date(2026, 11, 27))
        self.assertEqual((d.year, d.month), (2027, 1))
        self.assertEqual(y, 2026)


class IconsTest(unittest.TestCase):
    def test_icons_unique_in_menus(self):
        js = (ROOT / "public/js/icons3d.js").read_text(encoding="utf-8")
        names = re.findall(r"^  (\w+): \(", js, re.M)
        self.assertGreaterEqual(len(names), 30)
        self.assertEqual(len(names), len(set(names)))
        read_ic = re.search(r"const READ_IC = \{(.+?)\};", js, re.S).group(1)
        vals = re.findall(r':\s*"(\w+)"', read_ic)
        self.assertEqual(len(vals), len(set(vals)), "대풀이 메뉴 아이콘이 겹치지 않는다")
        for v in vals + ["love", "marriage", "charm", "twodays", "moodreport", "birthday", "pae", "garden", "mood", "reading"]:
            self.assertIn(v, names)

    def test_tiles_wired(self):
        path = (ROOT / "public/js/path.js").read_text(encoding="utf-8")
        self.assertNotIn('class="now-chip"', path)
        self.assertIn("GIFT_TILES.map", path)
        home = (ROOT / "public/js/home.js").read_text(encoding="utf-8")
        self.assertIn("ritualTiles()", home)
        self.assertNotIn("ritual-more", home)


class ThemeAndP1Test(unittest.TestCase):
    """색 테마(기본 벚꽃, 밤 자동은 선택) · 저장한 사람 · 전체 메뉴 · NEW · 생일 카드 개인정보."""

    def setUp(self):
        self.js = {p.stem: p.read_text(encoding="utf-8") for p in (ROOT / "public/js").glob("*.js")}
        self.boot = (ROOT / "public/boot.js").read_text(encoding="utf-8")
        self.css = (ROOT / "public/style.css").read_text(encoding="utf-8")

    def test_default_theme_is_light(self):
        self.assertIn('localStorage.getItem("nyang:theme") || "day"', self.boot)
        self.assertNotIn("prefers-color-scheme", self.boot, "폰 다크 모드라고 자동으로 어둡게 하지 않는다")
        self.assertIn('nyang:autonight") === "1"', self.boot)
        for t in ("day", "hanji", "matcha", "night"):
            self.assertIn(f'["{t}",', self.js["look"])
        self.assertIn("html.t-hanji {", self.css)
        self.assertIn("html.t-matcha {", self.css)
        html = (ROOT / "public/index.html").read_text(encoding="utf-8")
        sw = (ROOT / "public/sw.js").read_text(encoding="utf-8")
        v = re.search(r"boot\.js\?v=(\d+)", html).group(1)
        self.assertIn(f"/boot.js?v={v}", sw, "부트 스크립트 버전이 서비스 워커와 같다")

    def test_p1_wired(self):
        self.assertIn('store.get("people", [])', self.js["gifts"])
        self.assertIn("savePerson(", self.js["gifts"])
        self.assertIn('seen:${k}', self.js["path"])
        for k in ("charm", "twodays", "moodreport", "birthday"):
            self.assertIn(f"""'@gift="{k}"'""", self.js["play"])
        self.assertIn('"@cfamily"', self.js["play"])
        self.assertIn("showAge ?? me", self.js["gifts"], "다른 사람 생일 카드는 나이·띠 숨김이 기본")


if __name__ == "__main__":
    unittest.main()
