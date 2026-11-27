"""사주냥이 부가 기능(규칙 기반, 저장 없음).

- 행운 부적: 중요한 날(시험·면접·고백…)에 점수 대신 '그날 나를 지켜 줄 것'만 — 운이 낮은 날은 보호하는 말로.
- 우리 둘 좋은 날: 두 사람 모두 기운이 좋은 날을 앞으로 60일에서 고른다.
- 기분 × 기운 리포트: 폰에 기록한 기분을 그날의 오행·십성으로 묶어 '나만의 패턴'을 찾는다.
- 생일 냥이: 다가오는 생일(음력 생일은 올해 양력으로 바꿔서), 나이·띠·일주 냥이·선물 아이디어.
"""
from __future__ import annotations

import math
from datetime import date, timedelta

from ksaju.calendar import leap_month_of, lunar_to_solar
from ksaju.core import ELEMENTS, STEM_ELEMENT, ZODIAC_LIST, Pillar, day_index

from .fortune import day_fortune, hourly

WEEK = "월화수목금토일"
GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성", "정재": "재성",
         "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}


def _md(d: date) -> str:
    return f"{d.month}월 {d.day}일({WEEK[d.weekday()]})"


# ---------------------------------------------------------------- 행운 부적
PURPOSE = {  # 키: (이름, 이모지, 부적 글자, 한글 뜻, 응원)
    "exam": ("시험·자격증", "📚", "合格祈願", "합격 기원", "아는 만큼 다 써 내는 날이다냥. 첫 문제에서 막히면 넘어갔다 돌아오기!"),
    "interview": ("면접", "💼", "一路順風", "술술 풀리는 길", "준비한 너를 그대로 보여 주면 된다냥. 첫인사는 한 박자 천천히, 눈을 보며."),
    "talk": ("발표", "🎤", "言出如意", "말이 뜻대로", "처음 30초만 넘기면 말이 술술 나온다냥. 물 한 모금 마시고 시작!"),
    "love": ("고백·데이트", "💗", "良緣成就", "좋은 인연 이루기", "마음은 꾸미지 않을 때 제일 잘 닿는다냥. 웃는 얼굴이 최고의 부적."),
    "start": ("첫 출근·새 시작", "🌱", "新出發吉", "새 출발 대길", "첫날은 잘하는 날이 아니라 익히는 날이다냥. 이름 세 개만 외워 와도 성공!"),
    "deal": ("계약·중요한 약속", "✍️", "萬事亨通", "모든 일이 술술", "서명 전 한 번 더 읽기 — 그 한 번이 부적보다 세다냥."),
    "etc": ("그 밖의 중요한 날", "✨", "心想事成", "마음먹은 대로", "오늘 하고 싶은 일 딱 한 가지만 정하고 가 보자냥."),
}
GROUP_TIP = {
    "비겁": "평소 내 페이스를 지키는 게 가장 큰 무기인 날",
    "식상": "말과 표현이 술술 나오는 날 — 준비한 걸 자신 있게",
    "재성": "꼼꼼함이 빛나는 날 — 마지막 확인 한 번이 점수를 올려",
    "관성": "규칙과 예의가 잘 통하는 날 — 단정한 차림이 플러스",
    "인성": "머리가 맑고 도움이 들어오는 날 — 아는 것을 차분히",
}
GUARD = {
    "exam": "부적이 그날 기운을 네 편으로 모아 준다냥. 준비한 만큼 꼭 나온다 — 마지막 확인 한 번이면 충분해.",
    "interview": "부적이 그날 기운을 네 편으로 모아 준다냥. 문을 열고 들어가는 순간부터 너의 시간이야.",
    "talk": "부적이 그날 기운을 네 편으로 모아 준다냥. 듣는 사람은 생각보다 네 편이다.",
    "love": "부적이 그날 기운을 네 편으로 모아 준다냥. 마음은 전하는 것만으로도 이미 용기 있는 일이야.",
    "start": "부적이 그날 기운을 네 편으로 모아 준다냥. 새 시작은 서툴러도 괜찮은 날이다.",
    "deal": "부적이 그날 기운을 네 편으로 모아 준다냥. 차분하게 읽고 또렷하게 묻기.",
    "etc": "부적이 그날 기운을 네 편으로 모아 준다냥. 하고 싶은 한 가지에만 마음을 모아 봐.",
}
PROP = {"목": "초록 펜이나 나무 연필", "화": "빨간 소품이나 따뜻한 차", "토": "노란 손수건이나 고소한 견과", "금": "흰 셔츠나 은색 시계", "수": "검정 펜과 물 한 병"}


def charm(r, d: date, purpose: str, today: date, wish: str = "") -> dict:
    p = PURPOSE.get(purpose, PURPOSE["etc"])
    f = day_fortune(r, d)
    lk = f["행운"]
    god = f["십성"].split("/")[0]
    hrs = hourly(r, d)["좋은시간"][:2]
    # 점수나 '낮은 날'은 말하지 않는다 — 부적은 언제나 그날 기운을 내 편으로 모아 주는 것
    guard = GUARD[purpose if purpose in GUARD else "etc"]
    return {"목적": {"키": purpose if purpose in PURPOSE else "etc", "이름": p[0], "이모지": p[1]},
            "날짜": d.isoformat(), "날짜말": _md(d), "디데이": (d - today).days,
            "글자": p[2], "뜻": p[3], "응원": p[4], "기운": GROUP_TIP[GROUP[god]], "지킴": guard, "소원": wish,
            "행운": {"색": lk["색"], "음식": lk["음식"], "방향": lk["방위"], "숫자": lk["숫자"], "소품": PROP[lk["오행"]], "시간": hrs, "오행": lk["오행"]}}


# ---------------------------------------------------------------- 우리 둘 좋은 날
TWO_PURPOSE = {"meet": "약속·데이트", "trip": "여행", "talk": "중요한 대화", "work": "같이 하는 일"}
TWO_TIP = {
    "meet": {"식상": "웃음이 많이 나는 날", "재성": "맛집 탐방에 딱", "인성": "편하게 수다 떨기 좋은 날", "비겁": "취향이 척척 맞는 날", "관성": "약속이 잘 지켜지는 날"},
    "trip": {"식상": "즉흥 여행도 즐거운 날", "재성": "알뜰하게 잘 다니는 날", "인성": "힐링 여행에 좋은 날", "비겁": "같이 걷기 좋은 날", "관성": "계획대로 착착 가는 날"},
    "talk": {"식상": "속마음이 술술 나오는 날", "재성": "현실적인 얘기가 잘 통하는 날", "인성": "서로 이해하기 좋은 날", "비겁": "솔직하게 말해도 괜찮은 날", "관성": "약속을 정하기 좋은 날"},
    "work": {"식상": "아이디어가 잘 나오는 날", "재성": "성과가 보이는 날", "인성": "배우며 함께하는 날", "비겁": "손발이 척척 맞는 날", "관성": "역할을 나누기 좋은 날"},
}


FEEL = {"비겁": "내 페이스대로 편한", "식상": "말이 술술 나오는", "재성": "실속을 잘 챙기는", "관성": "책임감이 빛나는", "인성": "마음이 편안한"}
WEEKEND_TIP = {True: "주말이라 느긋하게 오래 함께하기 좋아", False: "평일이라 짧고 굵게 만나기 좋아"}


def _pick_lines(days: list[dict], n: int = 5) -> list[dict]:
    """점수 순서는 지키되, 다섯 날의 이유·한줄이 서로 겹치지 않게 후보 문장 중에서 고른다."""
    used_r, used_t, out = set(), set(), []
    for x in days:
        r = next((c for c in x.pop("_r") if c not in used_r), None)
        t = next((c for c in x.pop("_t") if c not in used_t), None)
        if r is None or t is None:
            continue
        used_r.add(r); used_t.add(t)
        out.append({**x, "이유": r, "한줄": t})
        if len(out) == n:
            break
    return out


def two_days(ra, rb, today: date, purpose: str = "meet", days: int = 60) -> dict:
    purpose = purpose if purpose in TWO_PURPOSE else "meet"
    ya = {ra.analysis.yongshin, ra.analysis.huishin}
    yb = {rb.analysis.yongshin, rb.analysis.huishin}
    out = []
    for i in range(1, days + 1):
        d = today + timedelta(days=i)
        fa, fb = day_fortune(ra, d), day_fortune(rb, d)
        sa, sb = fa["점수"], fb["점수"]
        el = ELEMENTS[STEM_ELEMENT[Pillar(day_index(d), "").stem]]
        both = el in ya and el in yb
        score = min(sa, sb) * 0.6 + (sa + sb) / 2 * 0.4 + (4 if both else 0)
        ga, gb = GROUP[fa["십성"].split("/")[0]], GROUP[fb["십성"].split("/")[0]]
        feel = f"둘 다 {FEEL[ga]} 날" if ga == gb else f"나는 {FEEL[ga]} 날, 상대는 {FEEL[gb]} 날"
        reasons = ([f"둘 다 보약인 {el} 기운이 들어오는 날"] if both else []) + [feel]
        if abs(sa - sb) >= 8:
            reasons.append(f"{'내' if sa > sb else '상대'} 기운이 특히 좋아 이끌어 주는 날")
        reasons.append(f"{el} 기운이 둘 사이를 이어 주는 {WEEK[d.weekday()]}요일")
        tips = [TWO_TIP[purpose][ga], TWO_TIP[purpose][gb], WEEKEND_TIP[d.weekday() >= 5]]
        out.append({"날짜": d.isoformat(), "날짜말": _md(d), "주말": d.weekday() >= 5, "점": round(score),
                    "_s": score, "_r": reasons, "_t": list(dict.fromkeys(tips)), "등급": [fa["등급"], fb["등급"]]})
    lo, hi = min(x["_s"] for x in out), max(x["_s"] for x in out)
    for x in out:  # 60일 안에서 견준 별점 — 가장 좋은 날이 별 다섯
        x["별"] = 1 + round(4 * (x.pop("_s") - lo) / ((hi - lo) or 1))
    best = sorted(out, key=lambda x: (-x["점"], x["날짜"]))
    import copy
    return {"목적": TWO_PURPOSE[purpose], "추천": _pick_lines(copy.deepcopy(best)),
            "주말추천": _pick_lines(copy.deepcopy([x for x in best if x["주말"]]))}


# ---------------------------------------------------------------- 기분 × 기운 리포트
MOOD_WORD = ["별로", "보통", "좋음"]
SURE_DAYS = 3      # 기운(오행) 하나에 이만큼 쌓여야 '좋았다/지쳤다'고 말한다
CORR_DAYS = 10     # 점수와 기분이 닮았는지는 이만큼 쌓인 뒤에


def mood_report(r, records: list[tuple[date, int]], today: date) -> dict:
    by_el: dict[str, list[int]] = {e: [] for e in ELEMENTS}
    by_g: dict[str, list[int]] = {g: [] for g in GROUP_TIP}
    xs, ys = [], []
    for d, m in records:
        f = day_fortune(r, d)
        el = ELEMENTS[STEM_ELEMENT[Pillar(day_index(d), "").stem]]
        by_el[el].append(m)
        by_g[GROUP[f["십성"].split("/")[0]]].append(m)
        xs.append(f["점수"])
        ys.append(m)
    avg = lambda v: round(sum(v) / len(v), 2) if v else None  # noqa: E731
    els = {e: {"평균": avg(v), "수": len(v)} for e, v in by_el.items()}
    seen = {e: v for e, v in els.items() if v["수"] >= SURE_DAYS}
    best = max(seen, key=lambda e: seen[e]["평균"]) if len(seen) >= 2 else None
    worst = min(seen, key=lambda e: seen[e]["평균"]) if len(seen) >= 2 else None
    corr = None
    if len(xs) >= CORR_DAYS and len(set(xs)) > 1 and len(set(ys)) > 1:
        mx, my = sum(xs) / len(xs), sum(ys) / len(ys)
        cov = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
        corr = cov / math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    lines = []
    nxt = lambda e: next((today + timedelta(days=i) for i in range(1, 15)  # noqa: E731
                          if ELEMENTS[STEM_ELEMENT[Pillar(day_index(today + timedelta(days=i)), "").stem]] == e), None)
    if best and worst and best != worst and seen[best]["평균"] - seen[worst]["평균"] >= 0.3:
        nb, nw = nxt(best), nxt(worst)
        lines.append(f"{best} 기운 날({seen[best]['수']}일)에 기분이 가장 좋았다냥." + (f" 다음 {best} 기운 날은 {_md(nb)} — 중요한 약속은 그날로!" if nb else ""))
        lines.append(f"{worst} 기운 날({seen[worst]['수']}일)엔 조금 지쳤던 편이야." + (f" 다음 {worst} 기운 날({_md(nw)})엔 일정에 여유를 두자냥." if nw else ""))
    elif best:
        lines.append("기운에 따라 기분이 크게 흔들리지 않는 편이다냥. 마음의 중심이 단단한 거야!")
    else:
        some = {e: v for e, v in els.items() if v["수"]}
        lead = max(some, key=lambda e: (some[e]["평균"], some[e]["수"])) if some else None
        need = sum(max(0, SURE_DAYS - v["수"]) for v in els.values())
        lines.append((f"아직은 단정하기 이르다냥. 지금까지는 {lead} 기운 날({some[lead]['수']}일) 기분이 좋은 편이었어. " if lead else "")
                     + f"기운마다 {SURE_DAYS}일씩 쌓이면(앞으로 약 {need}일) 또렷하게 알려 줄게.")
    if corr is not None:
        lines.append("냥이 점수와 네 기분이 꽤 잘 맞는다냥 — 점수가 좋은 날 기분도 좋았어." if corr >= 0.3 else
                     "냥이 점수보다 네 마음이 더 세다냥 — 점수와 상관없이 하루를 잘 만들어 가고 있어." if corr <= 0.05 else
                     "냥이 점수와 네 기분이 조금은 닮았다냥. 기록이 쌓이면 더 또렷해져.")
    groups = {g: avg(v) for g, v in by_g.items() if len(v) >= SURE_DAYS}
    gbest = max(groups, key=groups.get) if groups else None
    if gbest:
        lines.append(f"십성으로 보면 '{gbest}'의 날에 제일 웃었다냥 — {GROUP_TIP[gbest].split(' — ')[0]}.")
    return {"기록수": len(records), "오행": els, "좋은기운": best, "힘든기운": worst, "상관": None if corr is None else round(corr, 2),
            "말": lines, "기분말": MOOD_WORD, "확신": best is not None, "기준": SURE_DAYS}


# ---------------------------------------------------------------- 생일 냥이
GIFT = {"목": "작은 화분이나 향긋한 차", "화": "맛있는 케이크나 따뜻한 조명", "토": "든든한 밥 한 끼나 쿠션", "금": "깔끔한 액세서리나 좋은 펜", "수": "향초나 조용한 카페 쿠폰"}


def next_birthday(b, today: date) -> tuple[date, int] | None:
    """(다음 생일 양력 날짜, 그 생일이 속한 해). 음력 생일은 그해 음력 날짜를 양력으로 — 윤달생은 그해 윤달이 없으면 평달로.
    음력 12월생은 생일이 이듬해 1월(양력)에 오기도 하므로 나이는 '속한 해'로 센다."""
    for y in (today.year, today.year + 1):
        try:
            if b.calendar == "lunar":
                leap = bool(b.leap) and leap_month_of(y) == b.month
                d = lunar_to_solar(y, b.month, b.day, leap)
            else:
                d = date(y, b.month, min(b.day, 28) if (b.month == 2 and b.day == 29 and not _leap(y)) else b.day)
        except Exception:  # noqa: BLE001 — 음력 30일이 없는 달 등은 29일로
            try:
                d = lunar_to_solar(y, b.month, b.day - 1, False)
            except Exception:  # noqa: BLE001
                continue
        if d >= today:
            return d, y
    return None


def _leap(y: int) -> bool:
    return y % 4 == 0 and (y % 100 != 0 or y % 400 == 0)


def birthday_info(name: str, b, r, today: date, ilju_card: dict | None) -> dict | None:
    nb = next_birthday(b, today)
    if not nb:
        return None
    d, y = nb
    age = y - b.year
    yong = r.analysis.yongshin
    return {"이름": name, "날짜": d.isoformat(), "날짜말": _md(d), "디데이": (d - today).days, "나이": age,
            "띠": ZODIAC_LIST[r.chart.year.branch], "음력": b.calendar == "lunar",
            "냥이": ilju_card and {"이름": ilju_card["이름"], "일주": ilju_card["일주"], "색": ilju_card["색"], "옷": ilju_card.get("옷")},
            "선물": f"보약이 {yong} 기운이라 {GIFT[yong]} 선물이 딱이다냥.",
            "축하": f"{age}번째 생일 축하해! 올해도 보약 {yong} 기운이 가득하길 🐾"}
