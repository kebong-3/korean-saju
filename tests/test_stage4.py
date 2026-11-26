"""4단계: 님 호칭 · 절기 시즌 · 60일주 냥이 카드 · 오늘의 패 · 귀인 퀘스트(보약 편지)."""
import json
import os
import sys
import unittest
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju.core import STEMS, BRANCHES  # noqa: E402
from sajunyang import ilju, pae, season  # noqa: E402
from test_stage2 import _Blob  # noqa: E402


class ContentTest(unittest.TestCase):
    def test_sixty_cards_unique(self):
        names = {ilju.card(i % 10, i % 12)["이름"] for i in range(60)}
        self.assertEqual(len(names), 60)

    def test_season_covers_year(self):
        seen = {season.current(datetime(2026, 1, 1, 12) + __import__("datetime").timedelta(days=d))["이름"] for d in range(0, 366, 5)}
        self.assertEqual(len(seen), 24)
        s = season.current(datetime(2026, 11, 26, 9))
        self.assertEqual((s["이름"], s["다음"]), ("소설", "대설"))
        self.assertGreater(s["남은날"], 0)

    def test_pae_is_stable_per_day(self):
        a = pae.draw("정인/편재", "2026-11-26", "x")
        self.assertEqual(a, pae.draw("정인/편재", "2026-11-26", "x"))
        self.assertEqual(a["십성"], "정인")


class ApiTest(_Blob):
    def test_saju_has_new_fields_and_nim(self):
        d = self.c.post("/api/saju", json={"year": 1997, "month": 3, "day": 12, "hour": 8, "gender": "여", "name": "지영"}).json()
        for k in ("냥이카드", "절기", "오늘의패"):
            self.assertIn(k, d)
        txt = json.dumps(d["이야기"], ensure_ascii=False) + d["상담"]["intro"]
        self.assertIn("지영님", txt)
        self.assertNotIn("지영님님", txt)
        self.assertNotIn("지영님와", txt)
        self.assertEqual(d["이름"], "지영")  # 화면에서 님을 붙이도록 원래 이름은 그대로
        self.assertEqual(len(self.c.get("/api/terms").json()["절기"]), 24)

    def test_letter_quest(self):
        c = self.c
        a = c.post("/api/map", json={"owner": {"year": 1997, "month": 3, "day": 12, "name": "지영"}, "consent": True}).json()
        b = c.post(f"/api/map/{a['id']}/join", json={"name": "민수", "birth": {"year": 1995, "month": 8, "day": 20}, "consent": True, "mutual": True}).json()
        c.post(f"/api/map/{a['id']}/join", json={"name": "솔이", "birth": {"year": 1998, "month": 1, "day": 5}, "consent": True})
        v = c.get(f"/api/map/{a['id']}?token={a['token']}").json()
        mb = next(m for m in v["멤버"] if m["이름"] == "민수")
        ms = next(m for m in v["멤버"] if m["이름"] == "솔이")
        self.assertIn("냥이", mb)
        self.assertIn("용신", mb)
        url = f"/api/map/{a['id']}/member"
        self.assertEqual(c.post(f"{url}/{mb['id']}/letter", json={"token": "x"}).status_code, 403)
        self.assertEqual(c.post(f"{url}/{mb['id']}/letter", json={"token": a["token"], "msg": "<b>힘내</b>"}).status_code, 200)
        self.assertEqual(c.post(f"{url}/{mb['id']}/letter", json={"token": a["token"]}).status_code, 409)   # 하루 한 통
        self.assertEqual(c.post(f"{url}/{ms['id']}/letter", json={"token": a["token"]}).status_code, 409)   # 연결 안 된 친구
        mine = b["내지도"]
        box = c.get(f"/api/map/{mine['id']}/letters?token={mine['token']}").json()["편지"]
        self.assertEqual(len(box), 1)
        self.assertEqual(box[0]["from"], "지영")
        self.assertNotIn("<", box[0]["msg"])
        self.assertEqual(c.get(f"/api/map/{mine['id']}/letters?token=no").status_code, 403)
        # 지도를 지우면 받은 편지도 함께 지워진다
        self.assertTrue(c.delete(f"/api/map/{mine['id']}?token={mine['token']}").json()["ok"])
        self.assertFalse(any(k.startswith(f"letters/{mine['id']}/") for k in self.files))


if __name__ == "__main__":
    unittest.main()
