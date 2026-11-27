"""보안 강화(사용량 제한·보안 헤더·출처 확인·운영자 점검) · 화면 스크립트 분리."""
import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import guard  # noqa: E402

BIRTH = {"year": 1999, "month": 8, "day": 21, "gender": "여"}


class RateLimitTest(unittest.TestCase):
    def setUp(self):
        self._on = guard.ENABLED
        guard.ENABLED = True
        guard.MEM.d.clear()
        self.c = TestClient(appmod.app)

    def tearDown(self):
        guard.ENABLED = self._on
        guard.MEM.d.clear()

    def test_windows(self):
        t = 1_000_000.0
        for _ in range(10):
            self.assertIsNone(guard.check("ai", "1.2.3.4", t))
        wait = guard.check("ai", "1.2.3.4", t)
        self.assertTrue(wait and wait <= 60)
        self.assertIsNone(guard.check("ai", "5.6.7.8", t), "다른 사람은 막히지 않는다")
        self.assertIsNone(guard.check("ai", "1.2.3.4", t + 61), "1분이 지나면 다시 된다")

    def test_ai_endpoint_returns_429(self):
        h = {"x-vercel-forwarded-for": "9.9.9.9"}
        codes = [self.c.post("/api/ai", json={"birth": BIRTH, "messages": []}, headers=h).status_code for _ in range(11)]
        self.assertNotIn(429, codes[:10])
        r = self.c.post("/api/ai", json={"birth": BIRTH, "messages": []}, headers=h)
        self.assertEqual(r.status_code, 429)
        self.assertIn("Retry-After", r.headers)
        self.assertIn("숨 고르는", r.json()["detail"])

    def test_ip_is_not_stored_raw(self):
        guard.check("calc", "10.0.0.1", 5.0)
        self.assertFalse(any("10.0.0.1" in k for k in guard.MEM.d))

    def test_off_by_default_locally(self):
        guard.ENABLED = False
        for _ in range(30):
            self.assertIsNone(guard.check("ai", "1.1.1.1", 1.0))


class ProtectTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(appmod.app)

    def test_security_headers(self):
        for path in ("/api/meta", "/guide", "/api/status"):
            r = self.c.get(path)
            for k in ("Content-Security-Policy", "Strict-Transport-Security", "X-Frame-Options", "Permissions-Policy"):
                self.assertIn(k, r.headers, f"{path} {k}")
        self.assertIn("frame-ancestors 'none'", self.c.get("/api/meta").headers["Content-Security-Policy"])

    def test_vercel_json_matches(self):
        v = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        first = v["headers"][0]
        self.assertEqual(first["source"], "/(.*)")
        self.assertEqual({h["key"]: h["value"] for h in first["headers"]}, guard.HEADERS)

    def test_cross_site_post_blocked(self):
        r = self.c.post("/api/saju", json=BIRTH, headers={"Origin": "https://evil.example"})
        self.assertEqual(r.status_code, 403)
        self.assertEqual(self.c.post("/api/saju", json=BIRTH, headers={"Origin": "http://testserver"}).status_code, 200)
        self.assertEqual(self.c.post("/api/saju", json=BIRTH).status_code, 200)

    def test_body_too_large(self):
        r = self.c.post("/api/saju", content=b"x" * 1_100_000, headers={"Content-Type": "application/json"})
        self.assertEqual(r.status_code, 413)

    def test_status_hides_internals(self):
        j = self.c.get("/api/status").json()
        self.assertNotIn("key_from", j)
        self.assertNotIn("provider", j)
        self.assertEqual(self.c.get("/api/status?check=1").status_code, 401)

    def test_api_not_cached_by_default(self):
        r = self.c.post("/api/saju", json=BIRTH)
        self.assertEqual(r.headers.get("Cache-Control"), "no-store")

    def test_share_page_has_no_inline_script(self):
        self.assertNotIn("<script", self.c.get("/m/abcd1234").text)

    def test_same_origin_rules(self):
        self.assertTrue(guard.same_origin(None, "a.app"))
        self.assertTrue(guard.same_origin("https://a.app", "a.app"))
        self.assertTrue(guard.same_origin("http://localhost:8001", "x"))
        self.assertFalse(guard.same_origin("null", "a.app"))
        self.assertFalse(guard.same_origin("https://a.app.evil.com", "a.app"))


class SplitScriptsTest(unittest.TestCase):
    """index.html · sw.js · public/js 가 같은 파일 목록을 같은 순서로 쓰는지, 인라인 스크립트가 없는지."""

    def test_lists_agree(self):
        html = (ROOT / "public/index.html").read_text(encoding="utf-8")
        tags = re.findall(r'<script src="/js/([a-z0-9]+)\.js\?v=(\d+)" defer></script>', html)
        names = [n for n, _ in tags]
        sw = (ROOT / "public/sw.js").read_text(encoding="utf-8")
        sw_js = json.loads(re.search(r"const JS = (\[.*?\]);", sw).group(1))
        ver = re.search(r'const V = "(\d+)"', sw).group(1)
        self.assertEqual(names, sw_js)
        self.assertEqual({v for _, v in tags}, {ver})
        self.assertEqual(sorted(names), sorted(p.stem for p in (ROOT / "public/js").glob("*.js")))
        self.assertEqual(names[0], "core")
        self.assertEqual(names[-1], "init")
        self.assertIn(f'const APPV = "{ver}"', (ROOT / "public/js/shell.js").read_text(encoding="utf-8"))
        self.assertIn(f"style.css?v={ver}", html)
        self.assertFalse((ROOT / "public/app.js").exists())

    def test_no_inline_scripts(self):
        html = (ROOT / "public/index.html").read_text(encoding="utf-8")
        self.assertEqual(re.findall(r"<script(?![^>]*\bsrc=)[^>]*>", html), [])
        self.assertNotRegex(html, r"\son[a-z]+=")

    def test_each_file_strict_and_no_duplicate_globals(self):
        seen = {}
        for p in sorted((ROOT / "public/js").glob("*.js")):
            s = p.read_text(encoding="utf-8")
            self.assertTrue(s.startswith('"use strict";'), p.name)
            for m in re.finditer(r"^(?:async function|function|const|let|class) ([A-Za-z_$][\w$]*)", s, re.M):
                self.assertNotIn(m.group(1), seen, f"{m.group(1)}: {seen.get(m.group(1))} / {p.name}")
                seen[m.group(1)] = p.name


if __name__ == "__main__":
    unittest.main()
