"""사주냥이 부모-자녀 궁합(sajunyang.family) 검사."""
from __future__ import annotations

import ast
import json
import os
import re
import sys
import unittest
from datetime import date

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "src"))
sys.path.insert(0, ROOT)

from ksaju import read_saju  # noqa: E402
from sajunyang import family  # noqa: E402

TODAY = date(2026, 11, 25)

PARENTS = [
    (1950, 4, 5, 7, 0, "남"), (1955, 10, 20, None, 0, "여"), (1960, 1, 9, 14, 30, "여"), (1963, 7, 7, 22, 0, "남"),
    (1968, 6, 6, None, 0, "여"), (1970, 12, 1, 9, 15, "남"), (1974, 3, 3, 3, 0, "여"), (1977, 8, 30, 18, 0, "남"),
    (1980, 5, 5, 12, 0, "여"), (1983, 11, 11, None, 0, "남"), (1987, 3, 25, 19, 30, "남"), (1989, 9, 19, 6, 40, "여"),
    (1991, 2, 14, 16, 0, "여"), (1993, 6, 30, 1, 10, "남"), (1995, 10, 10, None, 0, "여"),
]
# 자녀: TODAY 기준 영유아(0~6)·초등(7~12)·청소년(13~18)·성인(19+)
CHILDREN = [
    (2021, 5, 5, 10, 0, "남"), (2020, 8, 15, 10, 0, "여"), (2023, 1, 30, None, 0, "여"), (2024, 7, 7, 3, 0, "남"),
    (2016, 3, 1, 8, 0, "여"), (2015, 11, 20, None, 0, "남"), (2018, 9, 9, 21, 0, "여"), (2014, 12, 24, 13, 0, "남"),
    (2010, 6, 10, 9, 0, "여"), (2012, 5, 1, None, 0, "남"), (2008, 2, 2, 8, 0, "여"), (2011, 10, 3, 17, 30, "남"),
    (2000, 1, 1, 0, 30, "남"), (1995, 9, 9, None, 0, "남"), (1990, 4, 4, 11, 0, "여"), (2005, 8, 8, 19, 0, "여"),
]
NAMES = [["정의형", "아린"], ["", ""], ["미숙", "준호"], ["Alex", "Mia"], ["나", "하늘"], ["은영", "도윤"], ["철수", "철수"]]

JUNK = ["{", "}", "None", "[]", "1번", "2번", "이(가)", "을(를)", "은(는)", "와(과)", "(으)로"]
KEYS = {"제목", "관계유형", "핵심", "한줄", "서문", "장", "맺음"}
CH_KEYS = {"id", "icon", "title", "summary", "핵심", "story", "설화", "tip"}
IDS = ["temper", "bond", "distance", "tonic", "parenting", "conflict", "year"]

_R: dict = {}


def rd(b):
    if b not in _R:
        _R[b] = read_saju(*b[:5], gender=b[5], today=TODAY)
    return _R[b]


def sents(t: str) -> list:
    return [x for x in re.split(r"(?<=[.!?])\s+", t) if x.strip()]


def strings(o):
    if isinstance(o, str):
        yield o
    elif isinstance(o, dict):
        for k, v in o.items():
            yield from strings(k)
            yield from strings(v)
    elif isinstance(o, (list, tuple)):
        for v in o:
            yield from strings(v)


def pairs() -> list:
    out = []
    for i, c in enumerate(CHILDREN):
        for j in range(3):
            p = PARENTS[(i * 3 + j * 5) % len(PARENTS)]
            if c[0] - p[0] >= 18:
                out.append((p, c))
    return out


class Family(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.res = []
        for k, (p, c) in enumerate(pairs()):
            names = NAMES[k % len(NAMES)]
            out = family.build(rd(p), rd(c), names, TODAY)
            cls.res.append((p, c, names, out))

    def test_coverage(self):
        self.assertGreaterEqual(len(self.res), 40)
        stages = {family._stage(family._age(rd(c).chart.solar_date, TODAY)) for p, c, *_ in self.res}
        self.assertEqual(stages, set(family.STAGES))
        self.assertEqual({p[5] for p, *_ in self.res}, {"남", "여"})
        self.assertTrue(any(p[3] is None or c[3] is None for p, c, *_ in self.res))

    def test_shape_and_lengths(self):
        for p, c, names, o in self.res:
            with self.subTest(p=p, c=c):
                self.assertEqual(set(o), KEYS)
                self.assertTrue(o["제목"].strip())
                self.assertIn(o["관계유형"], set(family.BOND_TYPE.values()))
                self.assertLessEqual(len(o["관계유형"]), 12)
                self.assertLessEqual(len(o["핵심"]), 120, o["핵심"])
                self.assertEqual(len(sents(o["핵심"])), 2, o["핵심"])
                self.assertEqual(set(o["한줄"]), {"찰떡", "삐걱", "비결"})
                for v in o["한줄"].values():
                    self.assertTrue(v.strip())
                    self.assertLessEqual(len(v), 35, v)
                    self.assertIn("냥", v)
                self.assertTrue(2 <= len(o["서문"]) <= 3)
                self.assertTrue(1 <= len(o["맺음"]) <= 2)
                self.assertEqual([ch["id"] for ch in o["장"]], IDS)
                for ch in o["장"]:
                    self.assertEqual(set(ch), CH_KEYS)
                    self.assertTrue(50 <= len(ch["핵심"]) <= 110, (ch["id"], len(ch["핵심"]), ch["핵심"]))
                    self.assertTrue(1 <= len(sents(ch["핵심"])) <= 2, ch["핵심"])
                    self.assertLessEqual(len(ch["tip"]), 60, ch["tip"])
                    self.assertGreaterEqual(len(ch["story"]), 2)
                    for para in ch["story"]:
                        self.assertTrue(para.strip())
                        self.assertTrue(1 <= len(sents(para)) <= 5, para)

    def test_nyang_and_junk(self):
        for p, c, names, o in self.res:
            with self.subTest(p=p, c=c):
                for s in [o["핵심"]] + o["서문"] + o["맺음"]:
                    self.assertIn("냥", s)
                for ch in o["장"]:
                    for s in [ch["핵심"], ch["tip"], ch["설화"]] + ch["story"]:
                        self.assertIn("냥", s)
                for s in strings(o):
                    self.assertTrue(s.strip(), "빈 문자열")
                    for j in JUNK:
                        self.assertNotIn(j, s, f"{j!r} in {s[:80]!r}")
                    self.assertIsNone(re.search(r"(다냥냥|\.\.(?!\.)|\s\s)", s), s)
                    self.assertIsNone(re.search(r"[가-힣]해이다냥|해으로|파이다냥|부모'이다냥", s), s)

    def test_tales_separate(self):
        for p, c, names, o in self.res:
            with self.subTest(p=p, c=c):
                tales = [ch["설화"] for ch in o["장"]]
                self.assertEqual(len(tales), len(set(tales)))
                for ch in o["장"]:
                    for t in tales:
                        self.assertNotIn(t, ch["story"])
                    self.assertNotIn(ch["핵심"], ch["story"])

    def test_pairs_differ_and_quote_data(self):
        outs = set()
        for p, c, names, o in self.res:
            rp, rc = rd(p), rd(c)
            outs.add(json.dumps(o, ensure_ascii=False))
            with self.subTest(p=p, c=c):
                temper = o["장"][0]
                self.assertIn(rc.chart.day.hanja[0], temper["핵심"])
                bond = " ".join(o["장"][1]["story"])
                self.assertIn(rp.chart.day.hanja[0], bond)
                self.assertIn(rc.chart.day.hanja[0], bond)
                dist = " ".join(o["장"][2]["story"])
                self.assertIn(rp.chart.day.hanja[1], dist)
                self.assertIn(rc.chart.day.hanja[1], dist)
                self.assertIn("%", " ".join(o["장"][3]["story"]))
                self.assertIn(str(TODAY.year), " ".join(o["장"][6]["story"]))
                role = "아빠" if p[5] == "남" else "엄마"
                self.assertIn(role, o["제목"] + " ".join(o["서문"]))
                if p[3] is None or c[3] is None:
                    self.assertIn("시주", " ".join(o["서문"]))
        self.assertEqual(len(outs), len(self.res))

    def test_age_stage_changes_text(self):
        rp = rd((1970, 12, 1, 9, 15, "남"))
        rc = rd((2000, 1, 1, 0, 30, "남"))
        days = {"영유아": date(2004, 6, 1), "초등": date(2010, 6, 1), "청소년": date(2015, 6, 1), "성인": TODAY}
        outs = {}
        for st, d in days.items():
            o = family.build(rp, rc, ["아빠", "준"], d)
            outs[st] = o
            self.assertIn(st, " ".join(o["서문"]))
            self.assertIn(family.STAGE_ADV[st], o["핵심"])
            self.assertIn(family.STAGE_BOND[st], o["장"][1]["story"])
        self.assertIn("사춘기", json.dumps(outs["청소년"], ensure_ascii=False))
        adult = json.dumps(outs["성인"], ensure_ascii=False)
        self.assertTrue("독립" in adult and "존중" in adult)
        for key in ("핵심", "맺음"):
            vals = [json.dumps(outs[s][key], ensure_ascii=False) for s in days]
            self.assertEqual(len(set(vals)), 4, key)
        convs = {" ".join(outs[s]["장"][5]["story"]) for s in days}
        self.assertEqual(len(convs), 4)

    def test_names_fallback(self):
        rp, rc = rd(PARENTS[10]), rd(CHILDREN[1])
        o = family.build(rp, rc, ["", ""], TODAY)
        t = json.dumps(o, ensure_ascii=False)
        self.assertIn("너", t)
        self.assertIn("아이", t)
        self.assertNotIn("너가", t)
        o2 = family.build(rp, rc, [], TODAY)
        self.assertEqual(set(o2), KEYS)

    def test_example(self):
        rp = read_saju(1987, 3, 25, 19, 30, gender="남", longitude=126.85, today=TODAY)
        rc = read_saju(2020, 8, 15, 10, 0, gender="여", today=TODAY)
        o = family.build(rp, rc, ["정의형", "아린"], TODAY)
        self.assertIn("아빠", o["제목"])
        self.assertIn("영유아", " ".join(o["서문"]))
        self.assertIn("癸", o["핵심"] + " ".join(o["장"][1]["story"]))

    def test_python39_syntax(self):
        import shutil
        import subprocess
        path = os.path.join(ROOT, "sajunyang", "family.py")
        with open(path, encoding="utf-8") as f:
            ast.parse(f.read(), feature_version=(3, 9))
        # ast feature_version 은 3.12식 f-string(같은 따옴표 재사용)을 못 잡으므로, 옛 인터프리터가 있으면 실제로 컴파일해 본다
        for exe in ("python3.9", "python3.10", "python3.11"):
            found = shutil.which(exe)
            if found:
                r = subprocess.run([found, "-c", "import ast,sys; ast.parse(open(sys.argv[1], encoding='utf-8').read())", path],
                                   capture_output=True, text=True)
                self.assertEqual(r.returncode, 0, r.stderr)
                break

if __name__ == "__main__":
    unittest.main()
