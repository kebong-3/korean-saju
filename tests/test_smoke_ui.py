"""화면 자동 점검 — 실제 브라우저(헤드리스 Edge/Chrome)로 다섯 사람의 화면을 그려 본다.

각 프로필로 /#smoke=<생일> 을 열면 앱이 모든 탭을 그리고 결과를 <pre id="smoke-out">에 남긴다.
오류·빈 탭·가로 넘침·만세력 누락이 있으면 실패. 브라우저가 없는 환경에서는 건너뛴다.
"""
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.parse
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CANDIDATES = [os.environ.get("SMOKE_BROWSER", ""),
              r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
              r"C:\Program Files\Google\Chrome\Application\chrome.exe",
              shutil.which("chromium") or "", shutil.which("google-chrome") or "", shutil.which("chromium-browser") or ""]
BROWSER = next((c for c in CANDIDATES if c and Path(c).exists()), None)

PROFILES = {
    "시간 모름": {"name": "지은", "gender": "여", "calendar": "solar", "year": 1999, "month": 8, "day": 21, "hour": None, "minute": 0},
    "음력 윤달": {"name": "윤달", "gender": "여", "calendar": "lunar", "leap": True, "year": 2023, "month": 2, "day": 15, "hour": 10, "minute": 0},
    "야자시": {"name": "자정", "gender": "남", "calendar": "solar", "year": 1995, "month": 12, "day": 31, "hour": 23, "minute": 40, "zi_mode": "split"},
    "1900년대": {"name": "할머니", "gender": "여", "calendar": "solar", "year": 1934, "month": 5, "day": 5, "hour": 6, "minute": 0},
    "남자 기본": {"name": "", "gender": "남", "calendar": "solar", "year": 1987, "month": 3, "day": 25, "hour": 19, "minute": 30, "longitude": 127.49},
}


def _free_port() -> int:
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


@unittest.skipUnless(BROWSER, "헤드리스 브라우저가 없어 화면 점검을 건너뜀")
class SmokeUI(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.port = _free_port()
        # 다른 테스트가 남긴 가짜 저장소·AI 설정을 물려받지 않도록 깨끗한 환경으로 띄운다
        drop = ("VERCEL", "KV_", "UPSTASH_", "BLOB_", "VAPID_", "CRON_", "ANTHROPIC_", "OPENAI_", "GEMINI_")
        env = {k: v for k, v in os.environ.items() if not k.startswith(drop)}
        cls.srv = subprocess.Popen([sys.executable, "-m", "uvicorn", "app:app", "--port", str(cls.port), "--log-level", "warning"],
                                   cwd=ROOT, env=env, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        for _ in range(60):
            try:
                urllib.request.urlopen(f"http://127.0.0.1:{cls.port}/api/status", timeout=1)
                break
            except Exception:  # noqa: BLE001
                time.sleep(0.5)

    @classmethod
    def tearDownClass(cls):
        cls.srv.terminate()
        cls.srv.wait(10)

    def _render(self, birth: dict, width: int) -> dict:
        base = {"calendar": "solar", "leap": False, "minute": 0, "longitude": 126.98, "zi_mode": "unified", "marital": "", "kids": 0}
        url = f"http://127.0.0.1:{self.port}/#smoke=" + urllib.parse.quote(json.dumps({**base, **birth}, ensure_ascii=False))
        with tempfile.TemporaryDirectory() as prof:
            r = subprocess.run([BROWSER, "--headless=new", "--disable-gpu", "--no-first-run", f"--user-data-dir={prof}",
                                f"--window-size={width},800", "--virtual-time-budget=20000", "--dump-dom", url],
                               capture_output=True, timeout=120)
        m = re.search(rb'<pre id="smoke-out">(.*?)</pre>', r.stdout, re.S)
        self.assertTrue(m, f"점검 결과가 없음: {r.stderr[-400:]!r}")
        import html
        return json.loads(html.unescape(m.group(1).decode("utf-8")))

    def test_profiles(self):
        for label, birth in PROFILES.items():
            for width in (375, 320):
                with self.subTest(profile=label, width=width):
                    out = self._render(birth, width)
                    self.assertEqual(out["errors"], [], out)
                    self.assertFalse(out["overflowX"], f"{label} {width}px 가로 넘침")
                    self.assertTrue(out["manse"], f"{label} 만세력 없음")
                    self.assertTrue(out["ok"], out)
                    self.assertLessEqual(out["tabs"]["home"]["h"], 3.2, f"{label} 홈이 너무 김: {out['tabs']['home']}")


if __name__ == "__main__":
    unittest.main()
