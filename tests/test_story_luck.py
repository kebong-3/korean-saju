"""sajunyang.story_luck — 운세 이야기(오늘·신년·월별·평생 대운) 형식·찌꺼기·개인화 검사."""
from __future__ import annotations

import os
import re
import sys
import unittest
from datetime import date

ROOT = os.path.join(os.path.dirname(__file__), "..")
sys.path[:0] = [os.path.join(ROOT, "src"), ROOT]

from ksaju import read_saju  # noqa: E402
from sajunyang import fortune as F  # noqa: E402
from sajunyang import story_luck as S  # noqa: E402

TODAY = date(2026, 11, 25)
# (연, 월, 일, 시 또는 None, 분, 성별) — 1950~2010년, 남녀, 시각 미상 포함 32명
BIRTHS = [
    (1950, 1, 3, 4, 10, "남"), (1951, 6, 21, None, 0, "여"), (1953, 9, 9, 23, 30, "남"),
    (1955, 12, 31, 12, 0, "여"), (1958, 2, 4, 6, 45, "남"), (1960, 7, 7, None, 0, "남"),
    (1962, 10, 15, 18, 20, "여"), (1964, 3, 1, 0, 30, "여"), (1966, 5, 5, 9, 0, "남"),
    (1968, 8, 30, None, 0, "여"), (1970, 11, 11, 15, 15, "남"), (1972, 4, 18, 21, 50, "여"),
    (1974, 1, 20, 2, 0, "남"), (1976, 6, 1, 13, 40, "여"), (1978, 9, 28, None, 0, "남"),
    (1980, 12, 24, 7, 5, "여"), (1982, 2, 14, 19, 0, "남"), (1984, 5, 30, 11, 11, "여"),
    (1985, 8, 15, None, 0, "여"), (1987, 3, 25, 19, 30, "남"), (1989, 10, 3, 5, 55, "남"),
    (1991, 7, 19, 16, 30, "여"), (1993, 11, 27, 22, 10, "남"), (1995, 4, 4, None, 0, "여"),
    (1997, 1, 1, 0, 5, "남"), (1999, 6, 15, 8, 0, "여"), (2001, 9, 11, 10, 30, "남"),
    (2003, 12, 5, None, 0, "여"), (2005, 3, 21, 14, 0, "남"), (2007, 8, 8, 20, 20, "여"),
    (2009, 2, 3, 3, 33, "남"), (2010, 10, 10, 10, 10, "여"),
]
JUNK = re.compile(r"\{|\}|None|\[\]|\(\)|  |\.\.|냥냥|이\(가\)|을\(를\)|은\(는\)|undefined|nan\b")
SENT = re.compile(r"[^.!?]+[.!?]")

_cache: dict = {}


def load(i: int):
    if i not in _cache:
        y, m, d, h, mi, g = BIRTHS[i]
        r = read_saju(y, m, d, h, mi, gender=g, longitude=126.98, today=TODAY)
        _cache[i] = (r, F.bundle(r, TODAY))
    return _cache[i]


def texts(obj):
    """결과 안의 모든 문자열을 펼친다."""
    if isinstance(obj, str):
        yield obj
    elif isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(k, str):
                yield k
            yield from texts(v)
    elif isinstance(obj, (list, tuple)):
        for v in obj:
            yield from texts(v)


class Base(unittest.TestCase):
    def clean(self, obj, where=""):
        for t in texts(obj):
            self.assertTrue(t.strip(), f"빈 문자열 {where}")
            m = JUNK.search(t)
            self.assertIsNone(m, f"찌꺼기 {m.group(0) if m else ''!r} in {where}: {t[:160]}")

    def paras(self, ps, lo, hi, where=""):
        self.assertIsInstance(ps, list, where)
        self.assertTrue(lo <= len(ps) <= hi, f"{where} 문단 수 {len(ps)} (기대 {lo}~{hi})")
        for p in ps:
            self.assertIsInstance(p, str)
            n = len(SENT.findall(p))
            self.assertTrue(1 <= n <= 7, f"{where} 문단 문장 수 {n}: {p[:120]}")

    def no_dup_sentences(self, obj, where="", allow=0):
        seen: dict = {}
        for t in texts(obj):
            for s in SENT.findall(t):
                s = s.strip()
                if len(s) > 12:
                    seen[s] = seen.get(s, 0) + 1
        dups = [s for s, c in seen.items() if c > 1]
        self.assertLessEqual(len(dups), allow, f"{where} 반복 문장: {dups[:3]}")


class TodayStory(Base):
    def test_format_all_births(self):
        for i in range(len(BIRTHS)):
            r, fx = load(i)
            for key, hk in (("오늘운세", "시간대"),):
                out = S.today(r, fx[key], fx[hk], "")
                self.assertEqual(set(out), {"제목", "story", "tip"})
                self.assertIsInstance(out["제목"], str)
                self.assertIsInstance(out["tip"], str)
                self.paras(out["story"], 4, 6, f"today#{i}")
                self.clean(out, f"today#{i}")
                self.no_dup_sentences(out, f"today#{i}")
                self.assertIn(fx[key]["일진"], out["story"][0])
                self.assertIn(str(fx[key]["점수"]), out["story"][0])

    def test_calendar_dates(self):
        for i in (0, 7, 19, 27, 31):
            r, fx = load(i)
            for c in fx["달력"]:
                d = date.fromisoformat(c["date"])
                df, hr = F.day_fortune(r, d), F.hourly(r, d)
                out = S.today(r, df, hr, "냥집사")
                self.paras(out["story"], 4, 6, f"cal#{i} {d}")
                self.clean(out, f"cal#{i} {d}")
                self.assertIn(c["간지"], out["story"][0])
                for a in df["작용"][:4]:
                    self.assertIn(a, out["story"][2])

    def test_tomorrow_word(self):
        r, fx = load(19)
        out = S.today(r, fx["내일운세"], F.hourly(r, date(2026, 11, 26)), "")
        self.assertIn("내일", out["story"][0])

    def test_people_differ(self):
        (r1, f1), (r2, f2) = load(19), load(3)
        a = S.today(r1, f1["오늘운세"], f1["시간대"], "")
        b = S.today(r2, f2["오늘운세"], f2["시간대"], "")
        self.assertNotEqual(a["story"], b["story"])
        self.assertNotEqual(a["story"][1], b["story"][1])

    def test_name_and_default(self):
        r, fx = load(19)
        named = S.today(r, fx["오늘운세"], fx["시간대"], "정의형")
        anon = S.today(r, fx["오늘운세"], fx["시간대"], "")
        self.assertIn("정의형", " ".join(named["story"]))
        self.assertIn("네 ", " ".join(anon["story"]) + " ".join(S.life(r, fx["평생운"], fx["앞으로10년"], "")["서문"]))
        self.assertNotIn("정의형", " ".join(anon["story"]))


class YearStory(Base):
    def test_format_all_births(self):
        for i in range(len(BIRTHS)):
            r, fx = load(i)
            yf = fx["신년운세"]
            out = S.year(r, yf, "")
            self.assertEqual(set(out), {"서문", "분야", "월", "맺음"})
            self.paras(out["서문"], 2, 3, f"year서문#{i}")
            self.assertEqual(list(out["분야"]), ["재물운", "직업운", "연애운", "건강운", "학업운", "인간관계"])
            for k, v in out["분야"].items():
                self.paras(v, 2, 3, f"year{k}#{i}")
                self.assertIn(f"{k} {yf['분야'][k]}점", v[0])
            self.assertEqual(len(out["월"]), 12)
            self.assertEqual(set(out["월"]), {m["월"] for m in yf["월별"]})
            for m in yf["월별"]:
                txt = out["월"][m["월"]]
                self.assertIsInstance(m["월"], int)
                self.assertIn(m["간지"], txt)
                self.assertIn(f"{m['점수']}점", txt)
                n = len(SENT.findall(txt))
                self.assertTrue(2 <= n <= 4, f"월 이야기 문장 수 {n}: {txt}")
                self.assertEqual(S.month(r, m, ""), txt)
            self.assertTrue(out["맺음"])
            self.clean(out, f"year#{i}")
            self.no_dup_sentences(out, f"year#{i}", allow=1)

    def test_people_differ(self):
        (r1, f1), (r2, f2) = load(19), load(10)
        a, b = S.year(r1, f1["신년운세"]), S.year(r2, f2["신년운세"])
        self.assertNotEqual(a["서문"], b["서문"])
        self.assertNotEqual(a["분야"]["재물운"], b["분야"]["재물운"])

    def test_low_score_never_called_great(self):
        for i in range(len(BIRTHS)):
            r, fx = load(i)
            yf = fx["신년운세"]
            out = S.year(r, yf)
            for k, v in out["분야"].items():
                if yf["분야"][k] < 58:
                    self.assertNotIn("대길", v[0])
                    self.assertNotIn("활짝", v[0])


class LifeStory(Base):
    def test_format_all_births(self):
        for i in range(len(BIRTHS)):
            r, fx = load(i)
            lf, ah = fx["평생운"], fx["앞으로10년"]
            out = S.life(r, lf, ah, "")
            self.assertEqual(set(out), {"서문", "대운", "지금", "전성기"})
            self.paras(out["서문"], 2, 3, f"life서문#{i}")
            self.assertEqual(len(out["대운"]), len(lf["대운"]))
            cur = next((k for k, p in enumerate(lf["대운"]) if p["현재"]), None)
            for k, (d, p) in enumerate(zip(out["대운"], lf["대운"])):
                self.assertEqual(set(d), {"나이", "간지", "제목", "story"})
                self.assertEqual(d["나이"], p["나이"])
                self.assertEqual(d["간지"], p["간지"])
                self.assertIsInstance(d["나이"], int)
                self.assertTrue(d["제목"])
                if cur is not None and k < cur:
                    self.paras(d["story"], 1, 1, f"past#{i}")
                elif k == cur:
                    self.paras(d["story"], 3, 4, f"cur#{i}")
                elif cur is not None and k == cur + 1:
                    self.paras(d["story"], 2, 3, f"next#{i}")
                else:
                    self.paras(d["story"], 1, 2, f"later#{i}")
                self.assertIn(p["간지"], d["story"][0])
                self.assertIn(f"{p['점수']}점", " ".join(d["story"]))
            self.paras(out["지금"], 2, 3, f"지금#{i}")
            self.paras(out["전성기"], 1, 2, f"전성기#{i}")
            self.assertIn(lf["전성기"]["간지"], out["전성기"][0])
            for x in sorted(ah, key=lambda x: -x["점수"])[:1]:
                self.assertIn(str(x["연도"]), out["지금"][1])
            self.clean(out, f"life#{i}")
            self.no_dup_sentences(out, f"life#{i}", allow=1)

    def test_people_differ(self):
        (r1, f1), (r2, f2) = load(19), load(22)
        a = S.life(r1, f1["평생운"], f1["앞으로10년"])
        b = S.life(r2, f2["평생운"], f2["앞으로10년"])
        self.assertNotEqual(a["서문"], b["서문"])
        self.assertNotEqual([d["story"] for d in a["대운"]], [d["story"] for d in b["대운"]])

    def test_deterministic(self):
        r, fx = load(5)
        self.assertEqual(S.life(r, fx["평생운"], fx["앞으로10년"], "가나"),
                         S.life(r, fx["평생운"], fx["앞으로10년"], "가나"))


class Josa(unittest.TestCase):
    def test_particles(self):
        j = S._j
        self.assertEqual(j("편관", "은"), "편관은")
        self.assertEqual(j("편재", "은"), "편재는")
        self.assertEqual(j("癸卯(계묘)", "이다"), "癸卯(계묘)다")
        self.assertEqual(j("丁未", "이"), "丁未가")
        self.assertEqual(j("甲辰", "을"), "甲辰을")
        self.assertEqual(j("한낮(11~17시)", "이"), "한낮(11~17시)이")
        self.assertEqual(j("46세", "이"), "46세가")
        self.assertEqual(j("2027년", "은"), "2027년은")
        self.assertEqual(j("서울", "으로"), "서울로")
        self.assertEqual(j("집", "으로"), "집으로")
        self.assertEqual(j("'보통'", "이다"), "'보통'이다")
        self.assertEqual(j("3", "이"), "3이")
        self.assertEqual(j("2", "이"), "2가")


if __name__ == "__main__":
    unittest.main()
