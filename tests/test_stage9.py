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


class VillageTest(unittest.TestCase):
    """묘연 마을: 카드 글자 수 · 전설 조건 · 달 인연 · 도감 · 오늘의 인연."""

    def test_card_lines_fit_story_box(self):
        for k, lines in inyeon.SHORT.items():
            self.assertEqual(len(lines), 4)
            for t in lines:
                self.assertLessEqual(len(t), 20, (k, t))  # 카드 칸: 한 줄 10자 × 최대 3줄
        for k in relation.KIND_ORDER:
            self.assertIn(k, inyeon.LORE)
            self.assertIn(k, inyeon.VOICE)
            self.assertIn(k, inyeon.HELLO)

    def test_legend_needs_cheoneul_and_high_chem(self):
        v = lambda g, c: {"나에게": {"천을귀인": g}, "케미": c}  # noqa: E731
        self.assertTrue(inyeon.is_legend(v(True, 85)))
        self.assertFalse(inyeon.is_legend(v(True, 84)))
        self.assertFalse(inyeon.is_legend(v(False, 98)))

    def test_moon_tiers(self):
        self.assertEqual(inyeon.moon(90)["이름"], "보름달 인연")
        self.assertEqual(inyeon.moon(70)["이름"], "차오르는 달 인연")
        self.assertEqual(inyeon.moon(30)["이름"], "초승달 인연")

    def test_dex_and_today(self):
        from datetime import date
        j = TestClient(appmod.app).post("/api/mapcalc", json={"me": ME, "others": OTHERS}).json()
        d = j["인맥"]["도감"]
        self.assertEqual(d["수"], len(set(m["나에게"]["키"] for m in j["멤버"])))
        self.assertTrue(d["칭호"].split()[-1])
        t = j["오늘인연"]
        self.assertIn(t["이름"], [m["이름"] for m in j["멤버"]])
        self.assertTrue(t["한마디"] and t["이유"])
        self.assertNotRegex(t["이유"], r"님님|냥가|엄마님")
        picks = {inyeon.today_pick(j["멤버"], date(2026, 12, i))["이름"] for i in range(1, 15)}
        self.assertGreaterEqual(len(picks), 3, "날마다 다른 사람이 골라진다")
        self.assertEqual(inyeon.today_pick(j["멤버"], date(2026, 12, 3)), inyeon.today_pick(j["멤버"], date(2026, 12, 3)))
        boss = next(m for m in j["멤버"] if m["관계"] == "boss")
        self.assertIn(inyeon.HELLO[boss["나에게"]["키"]][1], [inyeon.today_pick([boss], date(2026, 12, 1))["한마디"]], "상사에겐 존댓말")
        self.assertIn("마을", j)
        self.assertIsNone(inyeon.today_pick([], date(2026, 12, 1)))


class PersonalGuideTest(unittest.TestCase):
    """같은 관계 유형이어도 사람마다 다른 사용설명서(십성 + 두 사람만의 근거)."""

    @classmethod
    def setUpClass(cls):
        import random
        rnd = random.Random(7)
        others = [{"name": f"친구{i}", "role": "friend", "birth": {"year": rnd.randrange(1970, 2004), "month": rnd.randrange(1, 13),
                                                                  "day": rnd.randrange(1, 29)}} for i in range(30)]
        cls.ms = TestClient(appmod.app).post("/api/mapcalc", json={"me": ME, "others": others}).json()["멤버"]

    def test_guides_are_mostly_unique(self):
        full = lambda g: tuple(g[k] + "|" + g["근거"].get(k, "") for k in ("존중", "조심", "보완", "선물"))  # noqa: E731
        self.assertGreaterEqual(len({full(m["설명서"]) for m in self.ms}), 25)
        self.assertTrue(all(len(m["설명서"]["근거"]) >= 1 for m in self.ms))

    def test_base_follows_ten_god(self):
        for m in self.ms:
            sg = m["나에게"]["십성"]
            self.assertEqual(m["설명서"]["존중"], inyeon.BASE10[sg][0])

    def test_card_lines_still_fit(self):
        for m in self.ms:
            for k, v in m["설명서"]["카드"].items():
                self.assertLessEqual(len(v), 20, (k, v))

    def test_korean_particles(self):
        text = json.dumps(self.ms, ensure_ascii=False)
        for bad in ("상대이 ", "나이 베풀", "나이 받", "나이 주도", "대화이 ", "한마디이 ", "냥가 "):
            self.assertNotIn(bad, text, bad)

    def test_facts_parser(self):
        f = inyeon._facts({"좋은점": ["일간: 천간합(→금) — 서로에게 강하게 끌리는 관계", "내 보약(용신) 수 기운을 넉넉히(40%) 가진 사람"],
                           "아쉬운점": ["띠: 해 — 은근한 오해 주의", "일지(가까운 사이 자리): 충 — 끌림도 크지만 부딪힘도 큼"]})
        self.assertEqual(f["일간"], "합")
        self.assertEqual(f["보약"], "수")
        self.assertEqual(f["나쁜"][0], ("일지", "충"), "가까운 사이 자리가 먼저")
        f2 = inyeon._facts({"좋은점": ["일간: 壬(임)이 乙(을)을 살려 줌 — 상대가 베풀고 내가 받는 구조"]})
        self.assertEqual(f2["일간"], "them_give")
        f3 = inyeon._facts({"아쉬운점": ["일간: 乙(을)이 戊(무)를 누름 — 나이 주도·통제하는 구조"]})  # 예전에 저장된 문장
        self.assertEqual(f3["일간"], "me_lead")


if __name__ == "__main__":
    unittest.main()
