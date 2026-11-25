"""관계 지도(귀인 지도) — 관계 유형·점수 범위·개인정보·공유 저장 흐름."""
import json
import os
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from ksaju import read_saju  # noqa: E402
from sajunyang import relation  # noqa: E402

T = date(2026, 11, 26)


def R(y, m, d, h=None, g="여"):
    return read_saju(y, m, d, h, 0, gender=g, today=T)


class RelationTest(unittest.TestCase):
    def test_kind_follows_day_master_elements(self):
        me = R(1990, 5, 15, 14)  # 庚 금
        cases = {"guiin": None, "jjak": None}
        for y in range(1980, 2005):
            for mo in (1, 4, 7, 10):
                o = R(y, mo, 10, 12)
                k = relation.relate(me, o, 2027)["나에게"]["키"]
                code = (o.chart.day_stem // 2 - me.chart.day_stem // 2) % 5
                expect = relation.KIND[code][0]
                self.assertEqual(k, expect)
                cases[k] = True
        self.assertTrue(all(cases.values()))

    def test_scores_in_range_and_both_sides(self):
        me = R(1999, 8, 21, 9)
        for y in range(1970, 2010, 3):
            r = relation.relate(me, R(y, (y % 12) + 1, (y % 27) + 1, (y * 7) % 24, "남"), 2027)
            self.assertTrue(30 <= r["케미"] <= 98)
            for side in ("나에게", "상대에게"):
                self.assertTrue(0 <= r[side]["보완"] <= 100)
                self.assertTrue(0 <= r[side]["영향력"] <= 100)
            self.assertIn(r["흐름"][:2], ("서로", "상대", "내가"))

    def test_summary(self):
        me = R(1990, 5, 15, 14)
        members = [relation.member_view(f"친구{i}", relation.relate(me, R(1985 + i, 3, 3 + i, 8), 2027), 10.0) for i in range(5)]
        s = relation.summary(me, members, 2027)
        self.assertEqual(s["인원"], 5)
        self.assertTrue(0 <= s["귀인점수"] <= 100)
        self.assertEqual(sum(s["유형수"].values()), 5)
        self.assertEqual(relation.summary(me, [], 2027)["귀인점수"], 0)


class ShareFlowTest(unittest.TestCase):
    """메모리 가짜 저장소로 지도 만들기 → 친구 참여 → 공개 보기 → 삭제."""

    def setUp(self):
        os.environ["VERCEL"] = "1"
        from fastapi.testclient import TestClient
        import app
        from sajunyang import share_store
        self.db = {}

        def fake(cmds):
            out = []
            for c in cmds:
                op = c[0]
                if op == "SET":
                    self.db[c[1]] = c[2]; out.append("OK")
                elif op == "GET":
                    out.append(self.db.get(c[1]))
                elif op == "HSET":
                    self.db.setdefault(c[1], {})[c[2]] = c[3]; out.append(1)
                elif op == "HGETALL":
                    out.append([x for kv in self.db.get(c[1], {}).items() for x in kv])
                elif op == "HDEL":
                    self.db.get(c[1], {}).pop(c[2], None); out.append(1)
                elif op == "DEL":
                    for k in c[1:]:
                        self.db.pop(k, None)
                    out.append(1)
                else:
                    out.append(1)
            return out
        self._orig = (share_store._pipe, share_store.configured)
        share_store._pipe, share_store.configured = fake, (lambda: True)
        self.ss = share_store
        self.c = TestClient(app.app)

    def tearDown(self):
        self.ss._pipe, self.ss.configured = self._orig

    def test_flow_and_privacy(self):
        c = self.c
        self.assertEqual(c.post("/api/map", json={"owner": {"year": 1990, "month": 5, "day": 15}, "consent": False}).status_code, 400)
        r = c.post("/api/map", json={"owner": {"year": 1990, "month": 5, "day": 15, "hour": 14, "name": "문지"}, "consent": True}).json()
        mid, tok = r["id"], r["token"]
        j = c.post(f"/api/map/{mid}/join", json={"name": "어진<b>", "birth": {"year": 1992, "month": 7, "day": 3}, "consent": True})
        self.assertEqual(j.status_code, 200)
        jj = j.json()
        self.assertIn("내시선", jj)
        pub = c.get(f"/api/map/{mid}").json()
        self.assertEqual(len(pub["멤버"]), 1)
        self.assertEqual(pub["멤버"][0]["이름"], "어진b")
        dump = json.dumps(pub, ensure_ascii=False) + json.dumps(self.db, ensure_ascii=False)
        self.assertNotIn("1992", dump)            # 친구 생년은 어디에도 저장·노출되지 않는다
        self.assertNotIn('"year": 1990', json.dumps(pub))  # 주인 생년도 공개 화면엔 없다
        self.assertFalse(pub["주인권한"])
        self.assertTrue(c.get(f"/api/map/{mid}?token={tok}").json()["주인권한"])
        pid = pub["멤버"][0]["id"]
        self.assertEqual(c.delete(f"/api/map/{mid}/member/{pid}?token=nope").status_code, 403)
        self.assertTrue(c.delete(f"/api/map/{mid}/member/{pid}?token={jj['token']}").json()["ok"])
        self.assertEqual(c.get("/api/map/zz").status_code, 404)


if __name__ == "__main__":
    unittest.main()
