"""냥이의 인연 수첩(실제 관계·사용설명서·인맥 별자리) · 오행 구슬(상담 하루 5개)."""
import json
import os
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import guard, inyeon, relation  # noqa: E402

ME = {"year": 1999, "month": 8, "day": 21, "name": "지은"}
OTHERS = [{"name": "팀장님", "role": "boss", "birth": {"year": 1980, "month": 3, "day": 2}},
          {"name": "지수", "role": "friend", "birth": {"year": 1999, "month": 1, "day": 9}},
          {"name": "막내", "role": "junior", "birth": {"year": 2001, "month": 11, "day": 30}},
          {"name": "엄마", "role": "family", "birth": {"year": 1968, "month": 6, "day": 14}},
          {"name": "민호", "birth": {"year": 1997, "month": 4, "day": 4}}]


class GuideContentTest(unittest.TestCase):
    def test_every_role_and_kind_has_text(self):
        for role in ["", *inyeon.ROLE_ORDER]:
            for k in relation.KIND_ORDER:
                view = {"나에게": {"키": k, "영향력": 60}, "상대에게": {"영향력": 50}, "유형": {"오행": "수"}}
                g = inyeon.guide(view, role)
                for f in ("별명", "한줄", "존중", "조심", "보완", "선물", "말투"):
                    self.assertTrue(g[f], (role, k, f))
                self.assertEqual(g["주고받기"]["나는"], "받는 쪽")
                self.assertEqual(bool(g["관계"]), bool(role))

    def test_unknown_role_is_ignored(self):
        g = inyeon.guide({"나에게": {"키": "guiin", "영향력": 50}, "상대에게": {"영향력": 50}, "유형": {}}, "hacker")
        self.assertIsNone(g["관계"])

    def test_inverse_roles(self):
        self.assertEqual(inyeon.INVERSE["boss"], "junior")
        self.assertEqual(inyeon.INVERSE.get("friend", "friend"), "friend")

    def test_particles(self):
        self.assertEqual(inyeon._j("엄마", "은", "는"), "엄마는")
        self.assertEqual(inyeon._j("지수님", "은", "는"), "지수님은")
        self.assertEqual(inyeon._n({"이름": "엄마", "관계": "family"}), "엄마")
        self.assertEqual(inyeon._n({"이름": "팀장님"}), "팀장님")


class MapCalcRolesTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(appmod.app)
        cls.j = cls.c.post("/api/mapcalc", json={"me": ME, "others": OTHERS}).json()

    def test_members_carry_role_and_guide(self):
        by = {m["이름"]: m for m in self.j["멤버"]}
        self.assertEqual(by["팀장님"]["관계"], "boss")
        self.assertEqual(by["민호"]["관계"], "")
        self.assertEqual(by["팀장님"]["설명서"]["관계"]["이름"], "상사·선배")
        self.assertIn(by["지수"]["설명서"]["별명"], [v[0] for v in inyeon.FUN["friend"].values()])

    def test_network(self):
        n = self.j["인맥"]
        self.assertEqual(sum(n["유형수"].values()), 5)
        self.assertEqual(n["관계수"]["boss"], 1)
        self.assertEqual(n["관계미정"], 1)
        self.assertEqual(n["직장"]["인원"], 2)
        self.assertTrue(n["별자리"]["이름"])
        self.assertTrue(any("보약" in t for t in n["조언"]))
        self.assertNotRegex(json.dumps(n, ensure_ascii=False), r"님님|엄마님")
        self.assertIn("관계종류", self.j)
        self.assertIn("캐릭터", self.j)

    def test_bad_role_rejected(self):
        bad = [{"name": "x", "role": "hacker", "birth": {"year": 1990, "month": 1, "day": 1}}]
        self.assertEqual(self.c.post("/api/mapcalc", json={"me": ME, "others": bad}).status_code, 422)

    def test_empty_map(self):
        j = self.c.post("/api/mapcalc", json={"me": ME, "others": []}).json()
        self.assertEqual(j["인맥"]["별자리"]["이름"], "아직 빈 하늘")


class SharedMapRolesTest(unittest.TestCase):
    """가짜 Blob 저장소: 손님이 고른 관계 · 주인만 보이기 · 주인이 바꾸기 · 서로 연결 시 반대 관계."""

    def setUp(self):
        from sajunyang import share_store as ss
        self.files, self.ss = {}, ss
        self._orig = (ss._bput, ss._bget, ss._blist, ss._bdel)
        ss._bput = lambda path, obj: self.files.__setitem__(path, json.dumps(obj))
        ss._bget = lambda path: json.loads(self.files[path]) if path in self.files else None
        ss._blist = lambda prefix: [k for k in self.files if k.startswith(prefix)]
        ss._bdel = lambda paths: [self.files.pop(k, None) for k in paths]
        os.environ["BLOB_READ_WRITE_TOKEN"] = "fake"
        self._on = guard.ENABLED
        guard.ENABLED = False
        self.c = TestClient(appmod.app)

    def tearDown(self):
        self.ss._bput, self.ss._bget, self.ss._blist, self.ss._bdel = self._orig
        os.environ.pop("BLOB_READ_WRITE_TOKEN", None)
        guard.ENABLED = self._on

    def test_roles_flow(self):
        c = self.c
        own = c.post("/api/map", json={"owner": ME, "consent": True}).json()
        j = c.post(f"/api/map/{own['id']}/join", json={"name": "팀장", "role": "boss", "mutual": True, "consent": True,
                                                       "birth": {"year": 1980, "month": 3, "day": 2}}).json()
        self.assertEqual(j["내설명서"]["관계"]["키"], "junior", "손님 입장에선 주인이 후배")
        # 주인에게만 관계와 설명서가 보인다
        mine = c.get(f"/api/map/{own['id']}", headers={"X-Token": own["token"]}).json()
        self.assertEqual(mine["멤버"][0]["관계"], "boss")
        self.assertIn("설명서", mine["멤버"][0])
        self.assertIn("인맥", mine)
        pub = c.get(f"/api/map/{own['id']}").json()
        self.assertNotIn("관계", pub["멤버"][0])
        self.assertNotIn("설명서", pub["멤버"][0])
        self.assertNotIn("인맥", pub)
        # 손님 지도(서로 연결)에는 주인이 '후배'로 올라간다
        back = c.get(f"/api/map/{j['내지도']['id']}", headers={"X-Token": j["내지도"]["token"]}).json()
        self.assertEqual(back["멤버"][0]["관계"], "junior")
        # 주인이 관계를 바꾸고 지울 수 있다 · 남은 못 바꾼다
        pid = mine["멤버"][0]["id"]
        self.assertEqual(c.post(f"/api/map/{own['id']}/member/{pid}/role", json={"token": "nope", "role": "friend"}).status_code, 403)
        self.assertTrue(c.post(f"/api/map/{own['id']}/member/{pid}/role", json={"token": own["token"], "role": "friend"}).json()["ok"])
        again = c.get(f"/api/map/{own['id']}", headers={"X-Token": own["token"]}).json()
        self.assertEqual(again["멤버"][0]["설명서"]["관계"]["키"], "friend")
        c.post(f"/api/map/{own['id']}/member/{pid}/role", json={"token": own["token"], "role": ""})
        self.assertEqual(c.get(f"/api/map/{own['id']}", headers={"X-Token": own["token"]}).json()["멤버"][0]["관계"], "")
        self.assertEqual(c.post(f"/api/map/{own['id']}/member/{pid}/role", json={"token": own["token"], "role": "boss2"}).status_code, 422)


class BeadsClientTest(unittest.TestCase):
    """상담 하루 다섯 알: 위기 문장은 구슬과 상관없이 먼저 안내하고, 답을 받았을 때만 구슬을 쓴다."""

    def test_order_in_talk(self):
        s = (ROOT / "public/js/talk.js").read_text(encoding="utf-8")
        self.assertIn("const BEADS = 5;", s)
        inner = s[s.index("async function handleFreeInner"):s.index("/** 다른 탭에서")]
        self.assertLess(inner.index("CRISIS.test(q)"), inner.index("beadsLeft()"), "위기 안내가 구슬 검사보다 먼저")
        ai = s[s.index("async function aiSend"):]
        self.assertLess(ai.index("if (text) {"), ai.index("useBead()"), "답을 받았을 때만 구슬 사용")
        self.assertEqual(len(re.findall(r"useBead\(\)", s)), 3)  # 정의 1 + 규칙 상담 1 + AI 1


if __name__ == "__main__":
    unittest.main()
