"""검색 안내 페이지 · 다양한 알림 문구."""
import sys
import unittest
from datetime import date
from pathlib import Path
from urllib.parse import quote

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import push, seo  # noqa: E402


class SeoTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(appmod.app)

    def test_pages_render(self):
        for path, word in [("/guide", "명리 안내"), ("/manse", "만세력"), ("/sinsal", "도화살"), ("/ilju", "을사일주"),
                           ("/2027", "정미"), ("/jeolgi", "입춘"), (f"/sinsal/{quote('도화살')}", "요즘 해석"),
                           (f"/ilju/{quote('을사')}", "총명한 들꽃 냥이")]:
            r = self.c.get(path)
            self.assertEqual(r.status_code, 200, path)
            self.assertIn(word, r.text, path)
            self.assertIn('rel="canonical"', r.text)
            self.assertIn("생일 넣고 내 사주로 보기", r.text)

    def test_unknown_pages_404(self):
        for path in (f"/sinsal/{quote('없는살')}", f"/ilju/{quote('갑축')}", f"/ilju/{quote('가나')}"):
            self.assertEqual(self.c.get(path).status_code, 404, path)

    def test_sitemap_and_robots(self):
        sm = self.c.get("/sitemap.xml").text
        self.assertEqual(sm.count("<url>"), len(seo.urls()))
        self.assertEqual(len(seo.urls()), 7 + 32 + 60)
        self.assertIn("Sitemap:", self.c.get("/robots.txt").text)
        for u in seo.urls()[1:]:
            self.assertEqual(self.c.get(u).status_code, 200, u)

    def test_no_script_injection(self):
        r = self.c.get(f"/sinsal/{quote('<script>')}")
        self.assertEqual(r.status_code, 404)


class PushTest(unittest.TestCase):
    def test_kinds(self):
        sun = push.message(1, ["수"], date(2026, 11, 29), "sunday")
        self.assertIn("now=week", sun["url"])
        mon = push.message(1, ["수", "금"], date(2026, 11, 30))
        self.assertIn("힘 실을 날", mon["body"])
        term = push.message(1, ["수"], date(2026, 12, 7))  # 대설(2026-12-07)
        self.assertIn("대설", term["title"])
        day = push.message(1, ["수"], date(2026, 12, 2))
        self.assertIn("의 날", day["title"])

    def test_best_day_prefers_yongshin(self):
        from datetime import timedelta
        start, yong = date(2026, 11, 30), ["수", "금"]
        score = lambda d: (2 if "수" in push._day_els(d) else 0) + (1 if "금" in push._day_els(d) else 0)  # noqa: E731
        b = push.best_day(yong, start)
        week = [start + timedelta(days=i) for i in range(7)]
        self.assertIn(b, week)
        self.assertEqual(score(b), max(score(d) for d in week))


if __name__ == "__main__":
    unittest.main()
