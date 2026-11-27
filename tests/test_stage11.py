"""가족 지도: 모든 짝의 케미 · 우리 집 오행 · 가족 관계 꼬리표 · 저장하지 않음."""
import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from sajunyang import inyeon  # noqa: E402

ME = {"year": 1990, "month": 6, "day": 5, "name": "미경"}
FAM = [{"name": "남편", "rel": "spouse", "birth": {"year": 1988, "month": 4, "day": 12, "gender": "남"}},
       {"name": "서윤", "rel": "child", "birth": {"year": 2016, "month": 9, "day": 3}},
       {"name": "도현", "rel": "child", "birth": {"year": 2019, "month": 2, "day": 21, "gender": "남"}},
       {"name": "엄마", "rel": "parent", "birth": {"year": 1962, "month": 11, "day": 8}}]


class FamilyMapTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.c = TestClient(appmod.app)
        cls.j = cls.c.post("/api/familymap", json={"me": ME, "members": FAM}).json()

    def test_all_pairs(self):
        n = len(FAM) + 1
        self.assertEqual(len(self.j["짝"]), n * (n - 1) // 2)
        chems = [p["케미"] for p in self.j["짝"]]
        self.assertEqual(chems, sorted(chems, reverse=True))
        for p in self.j["짝"]:
            self.assertTrue(p["좋은"])

    def test_my_pairs_match_guides(self):
        by = {m["이름"]: m["케미"] for m in self.j["지도"]["멤버"]}
        for p in self.j["짝"]:
            if p["ai"] == 0:
                self.assertEqual(p["케미"], by[p["b"]], p)

    def test_household(self):
        h = self.j["우리집"]
        self.assertAlmostEqual(sum(h["오행"].values()), 100, delta=2)
        self.assertEqual(h["부족"], min(h["오행"], key=h["오행"].get))
        self.assertIn(h["부족"], h["처방"])
        self.assertTrue(h["이름"].endswith("네"))

    def test_family_roles_and_names(self):
        ms = {m["이름"]: m for m in self.j["지도"]["멤버"]}
        self.assertEqual(ms["남편"]["설명서"]["관계"]["이름"], "배우자")
        self.assertIn(ms["서윤"]["설명서"]["별명"], [v[0] for v in inyeon.FUN["child"].values()])
        self.assertIn(ms["엄마"]["설명서"]["별명"], [v[0] for v in inyeon.FUN["parent"].values()])
        text = json.dumps(self.j, ensure_ascii=False)
        for bad in ("엄마님", "남편님", "서윤님"):
            self.assertNotIn(bad, text)
        self.assertEqual([p["관계"] for p in self.j["사람"]], ["me", "spouse", "child", "child", "parent"])

    def test_limits(self):
        many = [dict(FAM[0], name=f"가족{i}") for i in range(9)]
        self.assertEqual(self.c.post("/api/familymap", json={"me": ME, "members": many}).status_code, 422)
        bad = [dict(FAM[0], rel="boss")]
        self.assertEqual(self.c.post("/api/familymap", json={"me": ME, "members": bad}).status_code, 422)
        self.assertEqual(self.c.post("/api/familymap", json={"me": ME, "members": []}).status_code, 200)

    def test_inverse_family_roles(self):
        self.assertEqual(inyeon.INVERSE["child"], "parent")
        self.assertEqual(inyeon.INVERSE["parent"], "child")

    def test_family_tab_wired(self):
        compat = (ROOT / "public/js/compat.js").read_text(encoding="utf-8")
        self.assertIn('data-cmode="family"', compat)
        self.assertNotIn('data-cmode="child"', compat)
        self.assertIn("renderFamilyPane()", compat)
        fam = (ROOT / "public/js/family.js").read_text(encoding="utf-8")
        self.assertIn('store.set("fam", list)', fam)
        self.assertIn("/api/familymap", fam)


if __name__ == "__main__":
    unittest.main()
