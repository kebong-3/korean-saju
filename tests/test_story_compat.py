"""사주냥이 궁합 이야기(sajunyang.story_compat) 검사."""
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

from ksaju import read_compatibility, read_saju  # noqa: E402
from sajunyang import story_compat  # noqa: E402

TODAY = date(2026, 11, 25)

# (연, 월, 일, 시 또는 None, 분, 성별) — 1950~2010년, 남남·여여·남녀, 시각 미상 포함
PEOPLE = [
    (1950, 1, 15, 6, 0, "남"), (1951, 7, 3, None, 0, "여"), (1953, 11, 21, 13, 30, "남"),
    (1955, 4, 9, 22, 10, "여"), (1957, 8, 30, None, 0, "남"), (1959, 2, 2, 3, 45, "여"),
    (1961, 12, 25, 11, 0, "남"), (1963, 6, 6, 17, 20, "여"), (1965, 9, 18, None, 0, "여"),
    (1967, 3, 1, 8, 15, "남"), (1969, 10, 10, 20, 0, "여"), (1971, 5, 27, 1, 30, "남"),
    (1973, 1, 31, None, 0, "남"), (1975, 7, 19, 9, 40, "여"), (1977, 11, 2, 15, 5, "남"),
    (1979, 4, 23, 23, 30, "여"), (1981, 8, 8, 12, 0, "남"), (1983, 2, 14, None, 0, "여"),
    (1985, 6, 30, 5, 50, "남"), (1987, 3, 25, 19, 30, "남"), (1988, 10, 25, 10, 0, "여"),
    (1988, 5, 10, 9, 0, "여"), (1990, 12, 12, 14, 20, "남"), (1992, 9, 1, None, 0, "여"),
    (1994, 1, 5, 7, 7, "남"), (1996, 7, 7, 18, 30, "여"), (1998, 3, 3, 0, 30, "남"),
    (2000, 2, 29, 16, 0, "여"), (2002, 6, 13, None, 0, "남"), (2004, 10, 31, 21, 15, "여"),
    (2006, 4, 4, 4, 4, "남"), (2008, 8, 8, 8, 8, "여"), (2010, 12, 31, 23, 50, "남"),
    (1952, 5, 5, 10, 30, "여"), (1966, 2, 20, 2, 0, "남"), (1978, 9, 9, None, 0, "여"),
    (1984, 11, 11, 11, 11, "남"), (1999, 12, 22, 13, 0, "여"), (2003, 3, 21, 6, 30, "여"),
    (1974, 8, 15, 15, 0, "남"), (1991, 4, 1, 12, 30, "남"), (1986, 6, 21, 3, 15, "여"),
]
NAMES = ["민준", "서연", "하늘", "지우", "도윤", "Alex", "", "은", "수빈", "철수", "영희", "나"]

JUNK = ["{", "}", "None", "[]", "1번", "2번", "이(가)", "을(를)", "은(는)", "와(과)", "(으)로", "nan"]
CHAPTER_KEYS = {"id", "icon", "title", "summary", "story", "tip", "핵심", "설화"}
REQUIRED_IDS = ["nature", "attraction", "room", "tonic", "rhythm", "conflict", "date"]

_CACHE: dict = {}


def reading(i: int):
    if i not in _CACHE:
        y, m, d, h, mi, g = PEOPLE[i]
        _CACHE[i] = read_saju(y, m, d, h, mi, gender=g, today=TODAY)
    return _CACHE[i]


def pairs() -> list:
    n = len(PEOPLE)
    out = []
    for k in range(n):
        out.append((k, (k * 7 + 3) % n))
    out += [(0, 1), (19, 20), (19, 21), (5, 5), (12, 30), (2, 6), (4, 13)]
    return [(a, b) for a, b in out if a != b] + [(5, 5)]


def sents(t: str) -> list:
    return [x for x in re.split(r"(?<=[.!?])\s+", t) if x.strip()]


def all_strings(obj):
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            yield from all_strings(k)
            yield from all_strings(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from all_strings(v)


class StoryCompat(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.results = []
        for idx, (a, b) in enumerate(pairs()):
            r1, r2 = reading(a), reading(b)
            res = read_compatibility(r1, r2)
            names = [NAMES[idx % len(NAMES)], NAMES[(idx * 5 + 1) % len(NAMES)]]
            out = story_compat.build(r1, r2, res, names)
            cls.results.append(((a, b), res, names, out))

    def test_enough_pairs(self):
        self.assertGreaterEqual(len(self.results), 40)
        genders = {(PEOPLE[a][5], PEOPLE[b][5]) for (a, b), *_ in self.results}
        self.assertTrue({("남", "남"), ("여", "여")} <= genders)
        self.assertTrue(("남", "여") in genders or ("여", "남") in genders)
        self.assertTrue(any(PEOPLE[a][3] is None or PEOPLE[b][3] is None for (a, b), *_ in self.results))

    def test_shape(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                self.assertEqual(set(out), {"핵심", "한줄", "제목", "서문", "장", "항목", "맺음"})
                self.assertIsInstance(out["제목"], str)
                self.assertTrue(out["제목"].strip())
                self.assertTrue(2 <= len(out["서문"]) <= 3)
                self.assertTrue(1 <= len(out["맺음"]) <= 2)
                self.assertTrue(6 <= len(out["장"]) <= 8)
                ids = [c["id"] for c in out["장"]]
                for rid in REQUIRED_IDS:
                    self.assertIn(rid, ids)
                self.assertEqual(len(ids), len(set(ids)))
                for ch in out["장"]:
                    self.assertEqual(set(ch), CHAPTER_KEYS)
                    for k in ("id", "icon", "title", "summary", "tip"):
                        self.assertIsInstance(ch[k], str)
                        self.assertTrue(ch[k].strip(), (ch["id"], k))
                    self.assertIsInstance(ch["story"], list)
                    self.assertGreaterEqual(len(ch["story"]), 2)
                    for para in ch["story"]:
                        self.assertIsInstance(para, str)
                        self.assertTrue(para.strip())

    def test_items_follow_engine(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                self.assertEqual(len(out["항목"]), len(res["items"]))
                for got, src in zip(out["항목"], res["items"]):
                    self.assertEqual(set(got), {"항목", "점수", "이야기", "한줄"})
                    self.assertEqual(got["점수"], src["점수"])
                    self.assertIsInstance(got["점수"], int)
                    self.assertTrue(got["이야기"].strip())
                    n = got["이야기"].count("냥")
                    self.assertGreaterEqual(n, 1)
                    sents = [s for s in re.split(r"(?<=[.!?])\s+", got["이야기"]) if s.strip()]
                    self.assertTrue(2 <= len(sents) <= 5, got["이야기"])

    def test_no_junk(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                for ch in out["장"]:
                    self.assertTrue(ch["설화"].strip())  # 모든 장에 설화가 있어 빈 값이면 안 됨
                for s in all_strings(out):
                    self.assertTrue(s.strip(), "빈 문자열")
                    for j in JUNK:
                        self.assertNotIn(j, s, f"{j!r} in {s[:80]!r}")
                    self.assertIsNone(re.search(r"\d점다냥", s), s)
                    self.assertIsNone(re.search(r"(이다|다)냥냥", s), s)
                    self.assertIsNone(re.search(r"\.\.(?!\.)", s), s)
                    self.assertIsNone(re.search(r"^\s*([-•*|#]|\d+\.)\s", s, re.M), s)

    def test_names_used(self):
        for pair, res, names, out in self.results:
            n1 = names[0] or "너"
            n2 = names[1] or "상대"
            text = json.dumps(out, ensure_ascii=False)
            with self.subTest(pair=pair):
                self.assertIn(n1, text)
                self.assertIn(n2, text)

    def test_real_data_quoted(self):
        for (a, b), res, names, out in self.results:
            r1, r2 = reading(a), reading(b)
            text = json.dumps(out, ensure_ascii=False)
            with self.subTest(pair=(a, b)):
                self.assertIn(r1.chart.day.hanja[0], text)
                self.assertIn(r2.chart.day.hanja[1], text)
                self.assertIn(str(res["score"]), " ".join(out["서문"]))
                room = next(c for c in out["장"] if c["id"] == "room")
                rtext = " ".join(room["story"])
                self.assertIn(r1.chart.day.hanja[1], rtext)
                self.assertIn(r2.chart.day.hanja[1], rtext)
                tonic = " ".join(next(c for c in out["장"] if c["id"] == "tonic")["story"])
                self.assertIn("%", tonic)
                if r1.chart.hour is None or r2.chart.hour is None:
                    self.assertIn("시주", " ".join(out["서문"]))

    def test_nyang_voice(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                for para in out["서문"] + out["맺음"]:
                    self.assertIn("냥", para)
                for ch in out["장"]:
                    for para in ch["story"]:
                        self.assertIn("냥", para)

    def test_couples_differ(self):
        texts = [json.dumps(out["장"], ensure_ascii=False) for *_, out in self.results]
        self.assertEqual(len(texts), len(set(texts)))
        titles = {out["제목"] for *_, out in self.results}
        self.assertGreaterEqual(len(titles), 15)
        rooms = {" ".join(c["story"][2] for c in out["장"] if c["id"] == "room") for *_, out in self.results}
        self.assertGreaterEqual(len(rooms), 20)

    def test_empty_names_fallback(self):
        r1, r2 = reading(19), reading(20)
        res = read_compatibility(r1, r2)
        out = story_compat.build(r1, r2, res, ["", ""])
        text = json.dumps(out, ensure_ascii=False)
        self.assertIn("너", text)
        self.assertIn("상대", text)
        self.assertNotIn("너가", text)
        out2 = story_compat.build(r1, r2, res, [])
        self.assertEqual(set(out2), {"핵심", "한줄", "제목", "서문", "장", "항목", "맺음"})

    def test_josa(self):
        jo = story_compat.jo
        self.assertEqual(jo("정의형", "은는"), "정의형은")
        self.assertEqual(jo("유선", "이가"), "유선이")
        self.assertEqual(jo("지우", "이가"), "지우가")
        self.assertEqual(jo("서연", "와과"), "서연과")
        self.assertEqual(jo("하늘", "으로"), "하늘로")
        self.assertEqual(jo("철수", "을를"), "철수를")
        self.assertEqual(jo("癸酉(계유)", "은는"), "癸酉(계유)는")
        self.assertEqual(jo("癸", "이가"), "癸가")
        self.assertEqual(jo("丑", "은는"), "丑은")
        self.assertEqual(jo("너", "이가"), "네가")
        self.assertEqual(jo("목", "이다"), "목이다")
        self.assertEqual(jo("수", "이다"), "수다")
        self.assertEqual(jo("+8점", "이가"), "+8점이")

    def test_example_couple_reads_specific(self):
        r1 = read_saju(1987, 3, 25, 19, 30, gender="남", longitude=126.85, today=TODAY)
        r2 = read_saju(1988, 10, 25, 10, 0, gender="여", today=TODAY)
        res = read_compatibility(r1, r2)
        out = story_compat.build(r1, r2, res, ["정의형", "유선"])
        room = " ".join(next(c for c in out["장"] if c["id"] == "room")["story"])
        self.assertIn("酉", room)
        self.assertIn("丑", room)
        self.assertIn("삼합", room)
        self.assertIn("癸", " ".join(out["장"][0]["story"]))

    # ---------------------------------------------------------------- 짧은 핵심 (기본 화면)
    def test_short_layer_lengths(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                core = out["핵심"]
                self.assertLessEqual(len(core), 120, core)
                self.assertEqual(len(sents(core)), 2, core)
                self.assertIn("냥", core)
                self.assertIn(str(res["score"]), core)
                self.assertEqual(set(out["한줄"]), {"찰떡", "삐걱", "비결"})
                for k, v in out["한줄"].items():
                    self.assertIsInstance(v, str)
                    self.assertTrue(v.strip())
                    self.assertLessEqual(len(v), 35, (k, v))
                    self.assertIn("냥", v)
                for ch in out["장"]:
                    c = ch["핵심"]
                    self.assertTrue(50 <= len(c) <= 110, (ch["id"], len(c), c))
                    self.assertTrue(1 <= len(sents(c)) <= 2, c)
                    self.assertIn("냥", c)
                    self.assertLessEqual(len(ch["tip"]), 60, ch["tip"])
                    self.assertIn("냥", ch["tip"])
                for it in out["항목"]:
                    self.assertLessEqual(len(it["한줄"]), 60, it["한줄"])
                    self.assertIn("냥", it["한줄"])

    def test_tale_moved_out_of_story(self):
        for pair, res, names, out in self.results:
            with self.subTest(pair=pair):
                tales = [ch["설화"] for ch in out["장"] if ch["설화"]]
                self.assertEqual(len(tales), len(set(tales)))
                for ch in out["장"]:
                    self.assertNotIn(ch["설화"], ch["story"])
                    for other in out["장"]:
                        if other["설화"]:
                            self.assertNotIn(other["설화"], ch["story"])
                    self.assertGreaterEqual(len(ch["story"]), 2)
                    self.assertNotIn(ch["핵심"], ch["story"])

    def test_short_layer_quotes_data_and_differs(self):
        cores, chaps = set(), set()
        for (a, b), res, names, out in self.results:
            r1, r2 = reading(a), reading(b)
            cores.add(out["핵심"])
            chaps.add(json.dumps([c["핵심"] for c in out["장"]], ensure_ascii=False))
            with self.subTest(pair=(a, b)):
                room = next(c for c in out["장"] if c["id"] == "room")["핵심"]
                self.assertIn(r1.chart.day.hanja[1], room)
                self.assertIn(r2.chart.day.hanja[1], room)
                nature = next(c for c in out["장"] if c["id"] == "nature")["핵심"]
                self.assertIn(r1.chart.day.hanja[0], nature)
                self.assertIn(r1.chart.day.hanja[0], out["핵심"])
        self.assertGreaterEqual(len(cores), 30)
        self.assertEqual(len(chaps), len(self.results))

    def test_python39_syntax(self):
        import shutil
        import subprocess
        path = os.path.join(ROOT, "sajunyang", "story_compat.py")
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
