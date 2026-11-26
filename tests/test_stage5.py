"""5단계: 만세력 표 · 신살과 길성 · 신살 이야기."""
import sys
import unittest
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path[:0] = [str(ROOT / "src"), str(ROOT)]

from fastapi.testclient import TestClient  # noqa: E402

import app as appmod  # noqa: E402
from ksaju import read_saju, sinsal as SS  # noqa: E402
from ksaju.core import BirthInput, Pillar, build_chart, sexagenary_index  # noqa: E402
from sajunyang import sinsal_story as st  # noqa: E402


def chart_of(*ganji):
    """간지 4개(시·일·월·연)로 가짜 원국을 만든다."""
    c = build_chart(BirthInput(1990, 6, 15, 12))
    S, B = "甲乙丙丁戊己庚辛壬癸", "子丑寅卯辰巳午未申酉戌亥"
    for lbl, g in zip(("hour", "day", "month", "year"), ganji):
        idx = sexagenary_index(S.index(g[0]), B.index(g[1]))
        setattr(c, lbl, Pillar(idx, {"hour": "시주", "day": "일주", "month": "월주", "year": "연주"}[lbl]))
    return c


class EngineTest(unittest.TestCase):
    def test_matches_reference_chart(self):
        """포스텔러 화면(1987-03-25 19:30 남, 순천)과 같은 신살·12신살."""
        c = build_chart(BirthInput(1987, 3, 25, 19, 30, gender="남", longitude=127.49))
        self.assertEqual([p.hanja for p in c.pillars], ["辛酉", "癸酉", "癸卯", "丁卯"])
        n = SS.natal(c)
        self.assertEqual(n["천간"]["시"], ["현침살"])
        for pos in ("월", "연"):
            for s in ("천을귀인", "문창귀인", "학당귀인", "천주귀인", "도화살", "현침살"):
                self.assertIn(s, n["지지"][pos])
        for pos in ("시", "일"):
            self.assertIn("문곡귀인", n["지지"][pos])
            self.assertIn("도화살", n["지지"][pos])
        self.assertEqual(n["12신살"], {"시": "재살", "일": "재살", "월": "장성살", "연": "재살"})

    def test_rules(self):
        n = SS.natal(chart_of("甲申", "庚辰", "丙寅", "壬戌"))  # 庚辰 괴강 일주, 寅申충·辰戌충, 壬戌 백호
        self.assertIn("괴강살", n["지지"]["일"])
        self.assertIn("백호살", n["지지"]["연"])
        n2 = SS.natal(chart_of("丁亥", "甲戌", "丙子", "辛未"))  # 戌亥 천라, 子未 원진
        self.assertIn("천라지망", n2["지지"]["시"])
        self.assertIn("원진살", n2["지지"]["월"])
        self.assertIn("원진살", n2["지지"]["연"])
        # 괴강 일주가 아니면 다른 기둥의 괴강 간지는 인정하지 않는다
        n3 = SS.natal(chart_of("庚戌", "甲子", "丙寅", "戊戌"))
        self.assertNotIn("괴강살", sum(n3["지지"].values(), []))

    def test_hongyeom_eul_is_shin(self):
        n = SS.natal(chart_of("甲申", "乙丑", "丙寅", "丁卯"))
        self.assertIn("홍염살", n["지지"]["시"])

    def test_every_name_has_story(self):
        self.assertEqual(set(st.INFO), set(SS.CATALOG))
        for k, v in st.INFO.items():
            for f in ("한줄", "옛뜻", "요즘", "강점", "조심", "쓰는법", "운", "준비"):
                self.assertTrue(v.get(f), f"{k}.{f}")


class ApiTest(unittest.TestCase):
    def test_saju_has_manse_and_story(self):
        c = TestClient(appmod.app)
        d = c.post("/api/saju", json={"year": 1987, "month": 3, "day": 25, "hour": 19, "minute": 30,
                                      "gender": "남", "longitude": 127.49, "name": "의형"}).json()
        self.assertIn("천을귀인", [x["이름"] for x in d["신살표"]["목록"]])
        self.assertEqual(len(d["운줄"]["대운"]), 10)
        self.assertEqual(d["운줄"]["대운"][0]["간지"], "壬寅")
        self.assertEqual(len(d["운줄"]["월운"]), 12)
        y = d["신살이야기"]
        self.assertIn("의형님", y["한눈에"])
        self.assertTrue(y["나"] and y["처방"])
        m = c.get("/api/meta").json()["sinsal"]
        self.assertEqual(set(m["설명"]), set(SS.CATALOG))

    def test_without_hour(self):
        r = read_saju(1997, 3, 12, None, gender="여", today=date(2026, 11, 26))
        n = SS.natal(r.chart)
        self.assertFalse(n["시주있음"])
        self.assertEqual(n["지지"]["시"], [])
        st.build(r, n, "지영님", date(2026, 11, 26))


if __name__ == "__main__":
    unittest.main()
