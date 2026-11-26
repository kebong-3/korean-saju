"""2단계: 택일 도우미 · 기록 백업(복구 코드) · 아침 운세 알림."""
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju import read_saju  # noqa: E402
from sajunyang import push, taegil  # noqa: E402

ME = {"year": 1997, "month": 3, "day": 12, "hour": 8, "gender": "여", "name": "냥"}


class TaegilTest(unittest.TestCase):
    def test_pick(self):
        r = read_saju(1997, 3, 12, 8, gender="여", today=date(2026, 11, 26))
        for p in ("move", "contract", "interview", "date", "exam", "start"):
            t = taegil.pick(r, p, date(2026, 11, 26), 60)
            self.assertEqual(len(t["추천"]), 5)
            self.assertTrue(all(not x["주의"] for x in t["추천"]))       # 추천일엔 충·형이 없다
            self.assertEqual([x["date"] for x in t["추천"]], sorted(x["date"] for x in t["추천"]))
            self.assertTrue(all(0 <= x["점수"] <= 100 for x in t["추천"]))
        mv = taegil.pick(r, "move", date(2026, 11, 26), 60)
        self.assertTrue(any(x["손없는날"] for x in mv["추천"]))


class _Blob(unittest.TestCase):
    def setUp(self):
        os.environ["VERCEL"] = "1"
        from fastapi.testclient import TestClient
        import app
        from sajunyang import share_store as ss
        self.files, self.ss = {}, ss
        self._orig = (ss._bput, ss._bget, ss._blist, ss._bdel)
        ss._bput = lambda path, obj: self.files.__setitem__(path, json.dumps(obj))
        ss._bget = lambda path: json.loads(self.files[path]) if path in self.files else None
        ss._blist = lambda prefix: [k for k in self.files if k.startswith(prefix)]
        ss._bdel = lambda paths: [self.files.pop(k, None) for k in paths]
        os.environ["BLOB_READ_WRITE_TOKEN"] = "fake"
        self.c = TestClient(app.app)

    def tearDown(self):
        self.ss._bput, self.ss._bget, self.ss._blist, self.ss._bdel = self._orig
        for k in ("BLOB_READ_WRITE_TOKEN", "VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "CRON_SECRET"):
            os.environ.pop(k, None)


class ApiTest(_Blob):
    def test_taegil_api(self):
        r = self.c.post("/api/taegil", json={"birth": ME, "purpose": "interview"})
        self.assertEqual(r.status_code, 200)
        self.assertEqual(r.json()["이름"], "면접·발표")
        self.assertEqual(self.c.post("/api/taegil", json={"birth": ME, "purpose": "hack"}).status_code, 422)

    def test_backup_roundtrip(self):
        c, bid = self.c, "0123456789abcdef0123456789abcdef"
        self.assertEqual(c.get(f"/api/backup/{bid}").status_code, 404)
        self.assertEqual(c.post("/api/backup", json={"id": "../x", "iv": "AAAAAAAAAAAA", "ct": "Q" * 20}).status_code, 422)
        self.assertEqual(c.post("/api/backup", json={"id": bid, "iv": "AAAAAAAAAAAAAAAA", "ct": "Q" * 40}).status_code, 200)
        self.assertEqual(c.get(f"/api/backup/{bid}").json()["ct"], "Q" * 40)
        self.assertIn(f"backups/{bid}.json", self.files)
        self.assertTrue(c.delete(f"/api/backup/{bid}").json()["ok"])
        self.assertEqual(c.get(f"/api/backup/{bid}").status_code, 404)

    def test_push_needs_keys_and_cron_secret(self):
        c = self.c
        self.assertIsNone(c.get("/api/status").json()["push_key"])
        sub = {"endpoint": "https://fcm.googleapis.com/fcm/send/abc", "keys": {"p256dh": "x", "auth": "y"}}
        self.assertEqual(c.post("/api/push", json={"sub": sub, "ilgan": 9, "yong": ["금"]}).status_code, 503)
        os.environ["VAPID_PUBLIC_KEY"], os.environ["VAPID_PRIVATE_KEY"] = "pub", "priv"
        self.assertEqual(c.get("/api/status").json()["push_key"], "pub")
        bad = {**sub, "endpoint": "https://evil.example/steal"}
        self.assertEqual(c.post("/api/push", json={"sub": bad, "ilgan": 9}).status_code, 400)
        self.assertEqual(c.post("/api/push", json={"sub": sub, "ilgan": 9, "yong": ["금", "토"]}).status_code, 200)
        saved = json.dumps(self.files, ensure_ascii=False)
        self.assertNotIn("1997", saved)                                   # 생일은 저장하지 않는다
        self.assertEqual(c.get("/api/cron/morning").status_code, 401)     # CRON_SECRET 없으면 막힌다
        os.environ["CRON_SECRET"] = "s3"
        self.assertEqual(c.get("/api/cron/morning", headers={"Authorization": "Bearer no"}).status_code, 401)
        with mock.patch("pywebpush.webpush") as wp:
            out = c.get("/api/cron/morning", headers={"Authorization": "Bearer s3"}).json()
            self.assertEqual(out["sent"], 1)
            data = json.loads(wp.call_args.kwargs["data"])
            self.assertIn("의 날", data["title"])
            out2 = c.get("/api/cron/morning", headers={"Authorization": "Bearer s3"}).json()
            self.assertEqual(out2["skip"], 1)                             # 하루 한 번만
        self.assertTrue(c.post("/api/push/off", json={"endpoint": sub["endpoint"]}).json()["ok"])
        self.assertFalse(any(k.startswith("push/") for k in self.files))


class MapWaitMutualTest(_Blob):
    def test_waitlist_and_mutual(self):
        c = self.c
        a = c.post("/api/map", json={"owner": {"year": 1985, "month": 4, "day": 2, "name": "정의형"}, "consent": True}).json()
        for i in range(10):
            r = c.post(f"/api/map/{a['id']}/join", json={"name": f"친{i}", "birth": {"year": 1980 + i, "month": 3, "day": 5 + i}, "consent": True}).json()
            self.assertFalse(r["대기"])
        b = c.post(f"/api/map/{a['id']}/join", json={"name": "지영", "birth": {"year": 1993, "month": 7, "day": 21}, "consent": True, "mutual": True}).json()
        self.assertTrue(b["대기"])                                       # 11번째는 대기 명단
        mine = b["내지도"]
        self.assertTrue(mine["new"] and mine["주인올림"])
        mv = c.get(f"/api/map/{mine['id']}?token={mine['token']}").json()
        self.assertEqual([m["이름"] for m in mv["멤버"]], ["정의형"])     # 서로 연결: 주인이 내 지도에
        again = c.post(f"/api/map/{a['id']}/join", json={"name": "지영", "birth": {"year": 1993, "month": 7, "day": 21}, "consent": True,
                                                         "mutual": True, "my_map": {"id": mine["id"], "token": mine["token"]}}).json()
        self.assertTrue(again["이미"])                                   # 같은 지도 쌍은 중복 안 됨
        self.assertFalse(again["내지도"]["주인올림"])
        own = c.get(f"/api/map/{a['id']}?token={a['token']}").json()
        pub = c.get(f"/api/map/{a['id']}").json()
        self.assertEqual((len(own["멤버"]), len(own["대기"]), own["정원"]), (10, 1, 10))
        self.assertNotIn("대기", pub)                                    # 대기 이름은 주인만
        self.assertEqual(pub["대기수"], 1)
        w, act = own["대기"][0]["id"], own["멤버"][0]["id"]
        url = f"/api/map/{a['id']}/member"
        self.assertEqual(c.post(f"{url}/{w}/wait", json={"token": a["token"], "wait": False}).status_code, 409)  # 꽉 참
        self.assertEqual(c.post(f"{url}/{act}/wait", json={"token": "nope", "wait": True}).status_code, 403)
        self.assertEqual(c.post(f"{url}/{act}/wait", json={"token": a["token"], "wait": True}).status_code, 200)
        self.assertEqual(c.post(f"{url}/{w}/wait", json={"token": a["token"], "wait": False}).status_code, 200)
        self.assertEqual(c.post(f"/api/map/{mine['id']}/join", json={"name": "x", "birth": {"year": 1990, "month": 1, "day": 1}, "consent": True,
                                                                     "my_map": {"id": mine["id"], "token": mine["token"]}}).status_code, 400)


class PushMsgTest(unittest.TestCase):
    def test_hosts(self):
        self.assertTrue(push.endpoint_ok("https://web.push.apple.com/abc"))
        self.assertFalse(push.endpoint_ok("http://fcm.googleapis.com/x"))
        self.assertFalse(push.endpoint_ok("https://fcm.googleapis.com.evil.io/x"))


if __name__ == "__main__":
    unittest.main()
