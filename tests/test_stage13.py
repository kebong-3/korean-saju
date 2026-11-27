"""3차 후기 P0: 알림 아침/저녁 · 아이 표현 · 출산 택일 거절 · 의견함 · 내 기록 지우기(문제 풀기) · 접근성."""
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import inyeon, push  # noqa: E402

JS = {p.stem: p.read_text(encoding="utf-8") for p in (ROOT / "public/js").glob("*.js")}


class PushTimeTest(unittest.TestCase):
    def test_evening_message_is_tomorrow(self):
        m = push.message(1, ["수"], date(2026, 12, 1), "evening")
        self.assertTrue(m["title"].startswith("🌙 내일은"))

    def test_send_all_filters_by_time(self):
        sent = []
        subs = [("a", {"sub": {"endpoint": "https://fcm.googleapis.com/a"}, "ilgan": 1, "yong": [], "when": "morning"}),
                ("b", {"sub": {"endpoint": "https://fcm.googleapis.com/b"}, "ilgan": 1, "yong": [], "when": "evening"}),
                ("c", {"sub": {"endpoint": "https://fcm.googleapis.com/c"}, "ilgan": 1, "yong": []})]  # 예전 구독 = 아침

        class Store:
            def list_docs(self, idx):
                return [(k, dict(v)) for k, v in subs]

            def put_doc(self, *a, **k):
                pass

            def del_doc(self, *a, **k):
                pass

        fake = mock.MagicMock()
        fake.webpush = lambda subscription_info, **k: sent.append(subscription_info["endpoint"][-1])
        fake.WebPushException = Exception
        with mock.patch.dict(sys.modules, {"pywebpush": fake}), mock.patch.dict(os.environ, {"VAPID_PRIVATE_KEY": "x"}):
            r = push.send_all(Store(), date(2026, 12, 1), when={"morning"})
            self.assertEqual(sorted(sent), ["a", "c"])
            self.assertEqual(r["skip"], 1)
            sent.clear()
            push.send_all(Store(), date(2026, 12, 1), kind="evening", when={"evening"})
            self.assertEqual(sent, ["b"])
            sent.clear()
            push.send_all(Store(), date(2026, 12, 6), kind="sunday")
            self.assertEqual(sorted(sent), ["a", "b", "c"], "일요일 돌아보기는 모두에게")

    def test_cron_evening_needs_secret(self):
        c = TestClient(appmod.app)
        self.assertEqual(c.get("/api/cron/evening").status_code, 401)
        v = json.loads((ROOT / "vercel.json").read_text(encoding="utf-8"))
        paths = {x["path"]: x["schedule"] for x in v["crons"]}
        self.assertEqual(paths.get("/api/cron/evening"), "0 12 * * *")  # 21시 KST
        self.assertEqual(len(v["crons"]), 2)

    def test_push_req_accepts_time(self):
        req = appmod.PushReq(sub={"endpoint": "https://fcm.googleapis.com/x", "keys": {"p256dh": "a", "auth": "b"}}, ilgan=1, when="evening")
        self.assertEqual(req.when, "evening")


class CareTest(unittest.TestCase):
    def test_child_wording_is_gentle(self):
        for k in ("guiin", "jjak", "mine", "arm", "tiger"):
            v = {"나에게": {"키": k, "영향력": 60, "십성": "편관"}, "상대에게": {"영향력": 50}, "유형": {"오행": "수"}, "용신": "목", "케미": 70,
                 "좋은점": ["일간: 壬(임)이 丙(병)을 누름 — 상대가 주도·통제하는 구조"], "아쉬운점": []}
            g = inyeon.guide(v, "child")
            text = json.dumps(g, ensure_ascii=False)
            for bad in ("단련시키는 아이", "다그치", "지시", "통제", "센 말에 감정"):
                self.assertNotIn(bad, text, (k, bad))
            self.assertNotIn("존중", g["근거"], "아이에겐 위계 근거를 붙이지 않는다")
            for t in g["카드"].values():
                self.assertLessEqual(len(t), 20)

    def test_birth_date_picking_declined(self):
        for q in ("출산 날짜 언제로 잡으면 좋을까?", "제왕절개 날 잡으려는데", "택일로 출산일 골라줘"):
            self.assertTrue(appmod.BIRTH_PICK.search(q), q)
        for q in ("출산 후 이직 고민", "출산하면 운이 어때?", "아기 이름 뭐가 좋아"):
            self.assertFalse(appmod.BIRTH_PICK.search(q), q)
        self.assertIn("의료진", appmod.BIRTH_PICK_MSG)


class FeedbackTest(unittest.TestCase):
    def setUp(self):
        from sajunyang import share_store as ss
        self.files, self.ss = {}, ss
        self._orig = (ss._bput, ss._bget, ss._blist, ss._bdel)
        ss._bput = lambda path, obj: self.files.__setitem__(path, json.dumps(obj))
        ss._bget = lambda path: json.loads(self.files[path]) if path in self.files else None
        ss._blist = lambda prefix: [k for k in self.files if k.startswith(prefix)]
        ss._bdel = lambda paths: [self.files.pop(k, None) for k in paths]
        self.env = mock.patch.dict(os.environ, {"BLOB_READ_WRITE_TOKEN": "fake", "CRON_SECRET": "s3cret"})
        self.env.start()
        self.c = TestClient(appmod.app)

    def tearDown(self):
        self.ss._bput, self.ss._bget, self.ss._blist, self.ss._bdel = self._orig
        self.env.stop()

    def test_feedback_private(self):
        self.assertTrue(self.c.post("/api/feedback", json={"kind": "idea", "text": "저녁 알림 <b>좋아요</b>", "appv": "34"}).json()["ok"])
        self.assertEqual(self.c.post("/api/feedback", json={"kind": "spam", "text": "x x"}).status_code, 422)
        self.assertEqual(self.c.get("/api/feedback").status_code, 401, "아무나 못 읽는다")
        got = self.c.get("/api/feedback", headers={"Authorization": "Bearer s3cret"}).json()["의견"]
        self.assertEqual(got[0]["text"], "저녁 알림 좋아요")
        self.assertNotIn("birth", json.dumps(got))


class ClientWiringTest(unittest.TestCase):
    def test_wipe_needs_quiz(self):
        md = JS["mydata"]
        self.assertIn("btn.disabled = +inp.value.trim() !== ans", md)
        self.assertIn('id="md-del" disabled', md)
        self.assertIn('k.startsWith("nyang:")', md)
        self.assertIn('["@mydata", "🗂️", "내 정보 관리"]', JS["play"])
        self.assertIn('["@feedback", "💌", "의견 보내기"]', JS["play"])

    def test_push_time_choice(self):
        r = JS["records"]
        self.assertIn('data-when="evening"', r)
        self.assertIn("when })", r)

    def test_accessibility(self):
        self.assertIn('aria-label="${esc(t)} 뜻 보기"', JS["core"])
        self.assertNotIn('<button class="blank"', JS["reading"])
        self.assertIn('stroke-dasharray="2.5 5"', JS["family"], "색약: 조율 필요 선은 짧은 점선")
        self.assertIn("aria-label=\"${esc(alt)}\"", JS["family"])


if __name__ == "__main__":
    unittest.main()
