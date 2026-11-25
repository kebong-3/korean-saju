"""sajunyang.story_me — 「내 사주」 이야기책 형식·내용 검사."""
from __future__ import annotations

import os
import re
import sys
import unittest
from datetime import date

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path[:0] = [os.path.join(ROOT, "src"), ROOT]

from ksaju import read_saju  # noqa: E402
from sajunyang import story_me  # noqa: E402
from sajunyang.story_me import jo  # noqa: E402

TODAY = date(2026, 11, 25)
# (연, 월, 일, 시, 분, 성별, 달력, 이름)
CASES = [
    (1987, 3, 25, 19, 30, "남", "solar", "정의형"),
    (1950, 1, 1, 0, 30, "여", "solar", ""),
    (1952, 7, 15, 12, 0, "남", "solar", "김철수"),
    (1955, 11, 3, None, 0, "여", "solar", ""),
    (1958, 5, 20, 6, 10, "남", "lunar", "박영희"),
    (1960, 2, 4, 17, 0, "여", "solar", ""),
    (1962, 9, 9, 9, 9, "남", "solar", "이민"),
    (1964, 12, 31, 23, 40, "여", "solar", ""),
    (1966, 6, 6, None, 0, "남", "lunar", ""),
    (1968, 4, 1, 4, 0, "여", "solar", "최지우"),
    (1970, 8, 15, 15, 20, "남", "solar", ""),
    (1972, 10, 10, 10, 10, "여", "lunar", "한별"),
    (1974, 1, 20, 21, 0, "남", "solar", ""),
    (1976, 3, 3, None, 0, "여", "solar", "오세린"),
    (1978, 7, 7, 7, 7, "남", "solar", ""),
    (1980, 11, 11, 13, 30, "여", "solar", ""),
    (1982, 2, 28, 2, 0, "남", "lunar", "강산"),
    (1984, 5, 5, 11, 0, "여", "solar", ""),
    (1986, 9, 30, None, 0, "남", "solar", ""),
    (1988, 12, 25, 18, 45, "여", "solar", "윤아"),
    (1990, 6, 21, 5, 30, "남", "solar", ""),
    (1992, 8, 8, 20, 0, "여", "lunar", ""),
    (1994, 4, 15, 14, 0, "남", "solar", "서준"),
    (1996, 10, 3, 1, 0, "여", "solar", ""),
    (1998, 1, 1, None, 0, "남", "solar", ""),
    (2000, 2, 29, 12, 0, "여", "solar", "하늘"),
    (2002, 6, 30, 16, 0, "남", "solar", ""),
    (2004, 9, 15, 8, 0, "여", "lunar", ""),
    (2006, 3, 21, 22, 0, "남", "solar", ""),
    (2008, 8, 8, 8, 8, "여", "solar", "지민"),
    (2010, 12, 12, None, 0, "남", "solar", ""),
    (1985, 7, 1, 3, 0, "여", "solar", ""),
    (1979, 5, 25, 19, 0, "남", "solar", ""),
]
REQUIRED_IDS = ["ilgan", "ilju", "gangyak", "ohaeng", "gyeokguk", "sipseong", "yongshin", "sinsal", "hapchung"]
CHAPTER_KEYS = {"id", "icon", "title", "term", "summary", "story", "tip", "핵심", "설화"}
CHIP_KEYS = {"성격", "강점", "조심", "보약"}
JUNK = ("{", "}", "None", "[]", "[[", "]]", "  ", "..", " ,", " .")


def _read(case):
    y, m, d, h, mi, g, cal, nm = case
    return read_saju(y, m, d, h, mi, gender=g, calendar=cal, longitude=126.98, name=nm, today=TODAY)


class StoryMe(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.results = []
        for case in CASES:
            r = _read(case)
            cls.results.append((case, r, story_me.build(r, case[-1])))

    def _paragraphs(self, d):
        out = list(d["서문"]) + list(d["맺음"]) + [d["핵심"]] + list(d["한줄"].values())
        for ch in d["장"]:
            out += ch["story"] + [ch["title"], ch["summary"], ch["tip"], ch["핵심"]]
            if ch["설화"]:
                out.append(ch["설화"])
        return out

    def test_format(self):
        for case, _, d in self.results:
            with self.subTest(case=case):
                self.assertEqual(set(d), {"핵심", "한줄", "서문", "장", "맺음"})
                self.assertTrue(2 <= len(d["서문"]) <= 3)
                self.assertTrue(1 <= len(d["맺음"]) <= 2)
                self.assertTrue(8 <= len(d["장"]) <= 11)
                ids = [ch["id"] for ch in d["장"]]
                self.assertEqual(len(ids), len(set(ids)))
                self.assertEqual([i for i in ids if i in REQUIRED_IDS], REQUIRED_IDS)
                for ch in d["장"]:
                    self.assertEqual(set(ch), CHAPTER_KEYS, ch["id"])
                    for k in ("id", "icon", "title", "term", "summary", "tip", "핵심", "설화"):
                        self.assertIsInstance(ch[k], str)
                    self.assertIsInstance(ch["story"], list)
                    self.assertTrue(3 <= len(ch["story"]) <= 4, (ch["id"], len(ch["story"])))
                    self.assertTrue(ch["summary"] and ch["tip"] and ch["title"] and ch["icon"])
                    self.assertLessEqual(len(ch["summary"]), 40, ch["summary"])

    def test_no_empty_or_junk(self):
        for case, _, d in self.results:
            for p in self._paragraphs(d):
                with self.subTest(case=case, text=p[:30]):
                    self.assertIsInstance(p, str)
                    self.assertTrue(p.strip())
                    self.assertEqual(p, p.strip())
                    for j in JUNK:
                        self.assertNotIn(j, p)
                    self.assertNotIn("\n", p)

    def test_nyang_voice(self):
        """서문·각 장 문단·맺음 문단마다 냥이체가 1~4번."""
        for case, _, d in self.results:
            paras = (list(d["서문"]) + list(d["맺음"]) + [p for ch in d["장"] for p in ch["story"]]
                     + [ch["설화"] for ch in d["장"] if ch["설화"]] + [ch["핵심"] for ch in d["장"]] + [d["핵심"]])
            for p in paras:
                with self.subTest(case=case, text=p[:30]):
                    self.assertTrue(1 <= p.count("냥") <= 4, p)

    def test_core_and_chips(self):
        """기본 화면용 핵심·한줄·짧은 tip."""
        for case, _, d in self.results:
            with self.subTest(case=case):
                top = d["핵심"]
                self.assertTrue(20 <= len(top) <= 120, top)
                self.assertIn("냥", top)
                self.assertEqual(set(d["한줄"]), CHIP_KEYS)
                for k, v in d["한줄"].items():
                    self.assertTrue(v and len(v) <= 30, (k, v))
                for ch in d["장"]:
                    core = ch["핵심"]
                    self.assertTrue(50 <= len(core) <= 110, (ch["id"], len(core), core))
                    self.assertIn("냥", core)
                    self.assertLessEqual(len(ch["tip"]), 60, ch["tip"])

    def test_tale_moved_out(self):
        """설화는 story에서 빠져 '설화' 키로 옮겨지고, 이 사람과 잇는 한 줄로 끝난다."""
        for case, _, d in self.results:
            who = case[-1] or "너"
            for ch in d["장"]:
                with self.subTest(case=case, ch=ch["id"]):
                    t = ch["설화"]
                    self.assertTrue(t)
                    body = " ".join(ch["story"])
                    self.assertNotIn(t, body)
                    self.assertNotIn(t.split(". ")[0], body)  # 설화 첫 문장도 story에 없어야 한다
                    self.assertTrue(3 <= story_me.nsent(t) <= 5, t)
                    last = t.rsplit(". ", 1)[-1]
                    self.assertIn(who, last)
                    self.assertTrue(last.endswith("냥."), last)

    def test_length(self):
        for case, _, d in self.results:
            n = sum(len(p) for p in self._paragraphs(d))
            with self.subTest(case=case):
                self.assertTrue(4500 <= n <= 10000, n)

    def test_uses_real_data(self):
        for case, r, d in self.results:
            c, a = r.chart, r.analysis
            with self.subTest(case=case):
                ch = {x["id"]: x for x in d["장"]}
                self.assertIn(c.day.hanja, " ".join(d["서문"]))
                self.assertIn(c.month.hanja, " ".join(d["서문"]))
                if c.hour is not None:
                    self.assertIn(c.hour.hanja, " ".join(d["서문"]))
                else:
                    self.assertIn("시를 몰라", " ".join(d["서문"]))
                from ksaju.core import STEMS
                self.assertIn(STEMS[c.day_stem], " ".join(ch["ilgan"]["story"]))
                self.assertIn(a.gyeokguk, " ".join(ch["gyeokguk"]["story"]))
                self.assertIn(a.yongshin, ch["yongshin"]["summary"])
                ohaeng = " ".join(ch["ohaeng"]["story"])
                for e, v in a.element_weight.items():
                    s = f"{v:.1f}".rstrip("0").rstrip(".") + "%"
                    self.assertIn(f"{e} {s}", ohaeng)
                sinsal = " ".join(ch["sinsal"]["story"])
                for s in a.sinsal:
                    self.assertIn(s.name, sinsal)
                self.assertIn(a.strength, " ".join(ch["gangyak"]["story"]))

    def test_consistency(self):
        """기운의 세기·용신과 모순된 말을 하지 않는다."""
        for case, r, d in self.results:
            a = r.analysis
            ch = {x["id"]: x for x in d["장"]}
            with self.subTest(case=case):
                g = ch["gangyak"]["story"][2]
                if a.strength in ("신강", "극신강"):
                    self.assertNotIn("신약", g)
                    self.assertNotIn("짐 쪽으로", g)
                if a.strength in ("신약", "극신약"):
                    self.assertNotIn("신강", g)
                    self.assertNotIn("힘 쪽으로", g)
                tip = ch["ohaeng"]["tip"]
                m = re.match(r"부족한 (.)\(", tip)
                if m:  # 오행 장에서 채우라고 권하는 오행은 용신·희신이어야 한다
                    self.assertIn(m.group(1), (a.yongshin, a.huishin))
                self.assertIn(f"용신은 {a.yongshin}", " ".join(ch["yongshin"]["story"]))

    def test_people_differ(self):
        seen_intro, seen_ilgan = {}, {}
        for case, _, d in self.results:
            intro = "".join(d["서문"])
            ilgan = "".join(d["장"][0]["story"])
            self.assertNotIn(intro, seen_intro, (case, seen_intro.get(intro)))
            self.assertNotIn(ilgan, seen_ilgan, (case, seen_ilgan.get(ilgan)))
            seen_intro[intro] = case
            seen_ilgan[ilgan] = case
        # 사람마다 장별 핵심 묶음이 달라야 한다
        cores = [tuple(ch["핵심"] for ch in d["장"]) for _, _, d in self.results]
        self.assertEqual(len(cores), len(set(cores)))
        # 같은 일간끼리도 다른 데이터를 인용해 일부 장의 핵심은 달라야 한다
        by_stem = {}
        for _, r, d in self.results:
            by_stem.setdefault(r.chart.day_stem, []).append([ch["핵심"] for ch in d["장"]])
        pairs = [v for v in by_stem.values() if len(v) >= 2]
        self.assertTrue(pairs)
        for v in pairs:
            diff = sum(1 for x, y in zip(v[0], v[1]) if x != y)
            self.assertGreaterEqual(diff, 3)
        # 같은 장이라도 서로 다른 사람이면 문단 구성이 충분히 달라야 한다
        a, b = self.results[0][2], self.results[1][2]
        for ca, cb in zip(a["장"], b["장"]):
            self.assertNotEqual(ca["story"], cb["story"], ca["id"])

    def test_name_default(self):
        r = _read(CASES[1])
        d = story_me.build(r, "")
        text = " ".join(d["서문"] + d["맺음"])
        self.assertIn("너의", text)
        d2 = story_me.build(r, "콩이")
        self.assertIn("콩이", " ".join(d2["서문"]))

    def test_deterministic(self):
        r = _read(CASES[0])
        self.assertEqual(story_me.build(r, "정의형"), story_me.build(r, "정의형"))


PROFS = [None, {"결혼": "미혼"}, {"결혼": "연애중"}, {"결혼": "기혼", "자녀": 2}, {"결혼": "기타"}]


def _texts(d, with_tale=True):
    out = [d["핵심"]] + list(d["한줄"].values()) + list(d["서문"]) + list(d["맺음"])
    for ch in d["장"]:
        out += ch["story"] + [ch["title"], ch["summary"], ch["tip"], ch["핵심"]]
        if with_tale:
            out.append(ch["설화"])
    return out


class ProfVariants(unittest.TestCase):
    """기초정보(결혼·자녀)에 따라 풀이가 달라진다."""

    @classmethod
    def setUpClass(cls):
        cls.runs = []
        for case in CASES[:14]:
            r = _read(case)
            cls.runs.append((case, r, [story_me.build(r, case[-1], pf) for pf in PROFS]))

    def test_backward_compatible(self):
        for case, r, outs in self.runs[:4]:
            base = story_me.build(r, case[-1])
            self.assertEqual(outs[0], base)
            self.assertEqual(story_me.build(r, case[-1], {}), base)
            self.assertEqual(story_me.build(r, case[-1], {"결혼": "", "자녀": 0}), base)

    def test_variants_differ(self):
        for case, _, outs in self.runs:
            with self.subTest(case=case):
                love = [next(ch for ch in d["장"] if ch["id"] == "inyeon") for d in outs]
                for i in range(len(love)):
                    for j in range(i + 1, len(love)):
                        self.assertNotEqual(love[i]["story"], love[j]["story"], (PROFS[i], PROFS[j]))
                        self.assertNotEqual(love[i]["핵심"], love[j]["핵심"], (PROFS[i], PROFS[j]))
                self.assertEqual(love[3]["title"], "부부와 가정")

    def test_words_by_status(self):
        for case, _, outs in self.runs:
            for pf, d in zip(PROFS, outs):
                st = (pf or {}).get("결혼", "")
                with self.subTest(case=case, st=st):
                    body = " ".join(_texts(d, with_tale=False))
                    if st in ("미혼", "연애중", "기타"):
                        hit = re.findall(r"(?<![가-힣])(남편|아내|배우자)", body)
                        self.assertEqual(hit, [], hit)
                    if st == "기혼":
                        whole = " ".join(_texts(d))
                        for w in ("썸", "소개팅"):
                            self.assertNotIn(w, whole)
                        self.assertIn("배우자궁", body)

    def test_kids_chapter(self):
        for case, r, outs in self.runs:
            with self.subTest(case=case):
                for pf, d in zip(PROFS, outs):
                    ids = [ch["id"] for ch in d["장"]]
                    self.assertEqual("janyeo" in ids, bool((pf or {}).get("자녀")))
                ch = next(c for c in outs[3]["장"] if c["id"] == "janyeo")
                self.assertEqual(outs[3]["장"][-1]["id"], "janyeo")
                self.assertIn("자녀 2명", ch["summary"])
                self.assertIn("궁합", ch["핵심"])
                self.assertIn("궁합 탭", " ".join(ch["story"]))
                if r.chart.hour is not None:
                    self.assertIn(r.chart.hour.hanja, " ".join(ch["story"]))
                else:
                    self.assertIn("시를 몰라", " ".join(ch["story"]))
                one = story_me.build(r, case[-1], {"결혼": "미혼", "자녀": 0})
                self.assertNotIn("janyeo", [c["id"] for c in one["장"]])

    def test_variant_format(self):
        """모든 기초정보 조합에서도 형식·길이·냥이체·설화 규칙이 지켜진다."""
        for case, _, outs in self.runs:
            who = case[-1] or "너"
            for pf, d in zip(PROFS, outs):
                with self.subTest(case=case, pf=pf):
                    self.assertEqual(set(d), {"핵심", "한줄", "서문", "장", "맺음"})
                    for k, v in d["한줄"].items():
                        self.assertTrue(v and len(v) <= 30, v)
                    for t in _texts(d):
                        for j in JUNK:
                            self.assertNotIn(j, t)
                    for ch in d["장"]:
                        self.assertEqual(set(ch), CHAPTER_KEYS)
                        self.assertTrue(3 <= len(ch["story"]) <= 4, ch["id"])
                        self.assertTrue(50 <= len(ch["핵심"]) <= 110, ch["핵심"])
                        self.assertIn("냥", ch["핵심"])
                        self.assertLessEqual(len(ch["tip"]), 60, ch["tip"])
                        for p in ch["story"] + [ch["설화"]]:
                            self.assertTrue(1 <= p.count("냥") <= 4, p)
                        self.assertNotIn(ch["설화"].split(". ")[0], " ".join(ch["story"]))
                        last = ch["설화"].rsplit(". ", 1)[-1]
                        self.assertIn(who, last)


class Josa(unittest.TestCase):
    def test_josa(self):
        self.assertEqual(jo("금(金)", "은/는"), "금(金)은")
        self.assertEqual(jo("토(土)", "은/는"), "토(土)는")
        self.assertEqual(jo("癸(계)", "이/가"), "癸(계)가")
        self.assertEqual(jo("酉(유)", "을/를"), "酉(유)를")
        self.assertEqual(jo("卯(묘)", "과/와"), "卯(묘)와")
        self.assertEqual(jo("물", "으로/로"), "물로")
        self.assertEqual(jo("금", "으로/로"), "금으로")
        self.assertEqual(jo("38.1%", "으로/로"), "38.1%로")
        self.assertEqual(jo("'식신격'", "이/가"), "'식신격'이")
        self.assertEqual(jo("편관격(칠살격)", "이/가"), "편관격(칠살격)이")
        self.assertEqual(jo("정의형", "은/는"), "정의형은")
        self.assertEqual(jo("丁", "이/가"), "丁이")
        self.assertEqual(jo("癸酉(계유)", "은/는"), "癸酉(계유)는")
        self.assertEqual(jo("월간 癸(편인)", "이/가"), "월간 癸(편인)가")
        self.assertEqual(jo("인성(36.8%)", "과/와"), "인성(36.8%)과")


if __name__ == "__main__":
    unittest.main()
