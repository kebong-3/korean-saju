"""오고(五古) 정밀 감명 — 명리 5대 고전의 다섯 렌즈로 한 사주를 입체적으로 읽는다.

  연해자평(淵海子平)  뼈대     일간 중심 체용·십신·궁위·육친
  삼명통회(三命通會)  백과사전 납음·신살·12신살·공망 (고법 포함)
  적천수(滴天髓)      기세     왕상휴수·통근·유통·청탁·진가·억부
  자평진전(子平眞詮)  격국     월령 사령·격·순용/역용·성패·상신
  궁통보감(窮通寶鑑)  계절     한난조습·조후 글자·조후 충족도

모든 판단은 ksaju 엔진 계산값에 규칙을 적용해 만든다(AI 없음). 고전 원문은 널리 알려진 구절만 인용하고,
나머지는 '요지'로 풀어 쓴다. 유파마다 다른 부분은 그렇다고 밝힌다.
[[용어]] 표기는 화면에서 용어 설명 칩이 된다.
"""
from __future__ import annotations

import re
from datetime import timedelta

from ksaju.core import (BRANCH_ELEMENT, BRANCHES, BRANCHES_KO, ELEMENTS, HIDDEN, STEM_ELEMENT, STEMS,
                        STEMS_KO, Pillar, branch_main_stem, ten_god, twelve_stage, year_index)
from ksaju.analysis import find_relations, twelve_sinsal
from ksaju.texts import DAY_MASTER

EH = {"목": "木", "화": "火", "토": "土", "금": "金", "수": "水"}
GOD_HANJA = {"비견": "比肩", "겁재": "劫財", "식신": "食神", "상관": "傷官", "편재": "偏財", "정재": "正財",
             "편관": "偏官", "정관": "正官", "편인": "偏印", "정인": "正印", "일간(나)": "日干"}
GROUP = {"비견": "비겁", "겁재": "비겁", "식신": "식상", "상관": "식상", "편재": "재성", "정재": "재성",
         "편관": "관성", "정관": "관성", "편인": "인성", "정인": "인성"}
GROUP_HANJA = {"비겁": "比劫", "식상": "食傷", "재성": "財星", "관성": "官星", "인성": "印星"}
POS = ["연주", "월주", "일주", "시주"]
POS_HANJA = {"연주": "年柱", "월주": "月柱", "일주": "日柱", "시주": "時柱"}
PALACE = {
    "연주": ("조상·가문, 유년기(대략 1~15세)", "집안 분위기·어린 시절 환경·사회적 첫인상"),
    "월주": ("부모·형제, 청년기(15~30세)", "직장·사회 무대·성장 환경, 사주에서 힘이 가장 센 자리"),
    "일주": ("나 자신과 배우자, 장년기(30~45세)", "나의 본모습과 가장 가까운 파트너·생활 공간"),
    "시주": ("자녀·제자, 말년(45세~)", "결실·후배/팀원·노후, 마음속 꿈과 미래 계획"),
}
NAEUM = ["해중금(海中金)", "노중화(爐中火)", "대림목(大林木)", "노방토(路傍土)", "검봉금(劍鋒金)", "산두화(山頭火)",
         "간하수(澗下水)", "성두토(城頭土)", "백랍금(白蠟金)", "양류목(楊柳木)", "천중수(泉中水)", "옥상토(屋上土)",
         "벽력화(霹靂火)", "송백목(松柏木)", "장류수(長流水)", "사중금(沙中金)", "산하화(山下火)", "평지목(平地木)",
         "벽상토(壁上土)", "금박금(金箔金)", "복등화(覆燈火)", "천하수(天河水)", "대역토(大驛土)", "차천금(釵釧金)",
         "상자목(桑柘木)", "대계수(大溪水)", "사중토(沙中土)", "천상화(天上火)", "석류목(石榴木)", "대해수(大海水)"]
NAEUM_IMAGE = {
    "해중금": "바닷속 깊이 잠긴 금 — 드러나지 않은 잠재력", "노중화": "화로 속 불 — 무언가를 단련하는 열정",
    "대림목": "큰 숲의 나무 — 많은 사람을 품는 그늘", "노방토": "길가의 흙 — 누구에게나 길을 내주는 너그러움",
    "검봉금": "칼끝의 금 — 날카로운 결단", "산두화": "산꼭대기 불 — 멀리서도 보이는 존재감",
    "간하수": "골짜기 시냇물 — 맑고 섬세한 흐름", "성두토": "성벽의 흙 — 지키고 방어하는 힘",
    "백랍금": "백랍(주석)처럼 녹여 다듬는 금 — 다듬을수록 빛남", "양류목": "버드나무 — 부드럽게 휘지만 꺾이지 않음",
    "천중수": "우물물 — 마르지 않는 깊은 샘", "옥상토": "지붕의 흙(기와) — 사람을 덮어 보호함",
    "벽력화": "벼락불 — 순간 폭발하는 에너지", "송백목": "소나무·잣나무 — 사계절 푸른 절개",
    "장류수": "길게 흐르는 강 — 꾸준함과 지구력", "사중금": "모래 속 금 — 골라내야 보이는 가치",
    "산하화": "산 아래 불 — 은근히 오래 타는 불", "평지목": "들판의 나무 — 사람 곁에서 자라는 친근함",
    "벽상토": "벽의 흙 — 틀을 세우고 구조를 만듦", "금박금": "금박 — 겉을 빛내는 장식과 품위",
    "복등화": "등잔불 — 어둠 속 한 사람을 비추는 불", "천하수": "하늘의 물(비·이슬) — 위에서 적셔 주는 은혜",
    "대역토": "큰 역참의 흙 — 오가는 길, 교류와 이동", "차천금": "비녀·팔찌의 금 — 섬세한 아름다움",
    "상자목": "뽕나무 — 쓸모 있고 생산적인 나무", "대계수": "큰 시냇물 — 힘차게 흐르는 추진력",
    "사중토": "모래흙 — 쌓이고 흩어지는 유연함", "천상화": "하늘의 불(태양) — 크게 밝히는 힘",
    "석류목": "석류나무 — 열매(결실)가 많은 나무", "대해수": "큰 바다 — 모든 것을 받아들이는 포용",
}
SEASON = {2: "봄", 3: "봄", 4: "봄", 5: "여름", 6: "여름", 7: "여름", 8: "가을", 9: "가을", 10: "가을",
          11: "겨울", 0: "겨울", 1: "겨울"}
SEASON_HANJA = {"봄": "春", "여름": "夏", "가을": "秋", "겨울": "冬"}
# 월지가 대표하는 계절 오행(사계 토월 辰未戌丑은 토)
MONTH_ELEMENT = {2: 0, 3: 0, 5: 1, 6: 1, 8: 3, 9: 3, 11: 4, 0: 4, 4: 2, 7: 2, 10: 2, 1: 2}
# 궁통보감 조후용신 통용 요약표 — 일간 × 월지(寅卯辰巳午未申酉戌亥子丑). 주석본·유파마다 세부 차이가 있다.
_JOHU_ROWS = {
    "甲": "丙癸 庚丙丁戊己 庚丁壬 癸丁庚 癸丁庚 癸丁庚 庚丁壬 庚丁丙 庚甲丁壬癸 庚丁丙戊 丁庚丙 丁庚丙",
    "乙": "丙癸 丙癸 癸丙戊 癸 癸丙 癸丙 丙癸己 癸丙丁 癸辛 丙戊 丙 丙",
    "丙": "壬庚 壬己 壬甲 壬庚癸 壬庚 壬庚 壬戊 壬癸 甲壬 甲戊庚壬 壬戊己 壬甲",
    "丁": "甲庚 庚甲 甲庚 甲庚 壬庚癸 甲壬庚 甲庚丙戊 甲庚丙戊 甲庚戊 甲庚 甲庚 甲庚",
    "戊": "丙甲癸 丙甲癸 甲丙癸 甲丙癸 壬甲丙 癸丙甲 丙癸甲 丙癸 甲丙癸 甲丙 丙甲 丙甲",
    "己": "丙庚甲 甲癸丙 丙癸甲 癸丙 癸丙 癸丙 丙癸 丙癸 甲丙癸 丙甲戊 丙甲戊 丙甲戊",
    "庚": "戊甲壬丙丁 丁甲庚丙 甲丁壬癸 壬戊丙丁 壬癸 丁甲 丁甲 丁甲丙 甲壬 丁丙 丁甲丙 丙丁甲",
    "辛": "己壬庚 壬甲 壬甲 壬甲癸 壬己癸 壬庚甲 壬甲戊 壬甲 壬甲 壬丙 丙戊壬甲 丙壬戊己",
    "壬": "庚丙戊 戊辛庚 甲庚 壬辛庚癸 癸庚辛 辛甲 戊丁 甲庚 甲丙 戊丙庚 戊丙 丙丁甲",
    "癸": "辛丙 庚辛 丙辛甲 辛 庚辛壬癸 庚辛壬癸 丁 辛丙 辛甲壬癸 庚辛戊丁 丙辛 丙丁",
}
_MONTH_ORDER = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1]
JOHU_KEYS = {stem: {b: cell for b, cell in zip(_MONTH_ORDER, row.split())} for stem, row in _JOHU_ROWS.items()}
JOHU_WHY = {
    "목": {"봄": "이른 봄 나무는 아직 춥다 — 햇볕(丙)으로 데우고 빗물(癸)로 적셔야 싹이 튼다",
          "여름": "한여름 나무는 말라 간다 — 무엇보다 물(癸)이 급하다",
          "가을": "가을 나무는 잎이 지고 기운이 거둬진다 — 큰 나무는 다듬고 불로 다스려 재목이 되고, 풀꽃 같은 나무는 물과 햇볕으로 버틴다",
          "겨울": "얼어붙은 나무 — 햇볕(丙)이 있어야 살아난다"},
    "화": {"봄": "봄 불은 기운이 오르는 중 — 물(壬)로 빛을 비추고 나무(甲)로 땔감을 댄다",
          "여름": "한여름 불은 너무 뜨겁다 — 큰물(壬)로 열을 식혀야 오히려 빛난다",
          "가을": "가을 불은 기운이 꺼져 간다 — 나무(甲)로 다시 지펴야 한다",
          "겨울": "겨울 불은 약하다 — 초겨울엔 땔감(나무)을 대고, 한겨울엔 큰물에 비친 햇빛처럼 물과 짝을 이뤄 빛을 낸다"},
    "토": {"봄": "봄 흙은 차갑고 나무에 눌린다 — 햇볕(丙)으로 데우고 물(癸)로 적셔야 농사가 된다",
          "여름": "여름 흙은 바짝 마른다 — 물(壬癸)이 없으면 갈라진 땅이 된다",
          "가을": "가을 흙은 기운이 빠져 서늘하다 — 햇볕(丙)과 물(癸)로 기름지게",
          "겨울": "얼어붙은 땅 — 햇볕(丙)이 먼저다"},
    "금": {"봄": "봄 쇠는 아직 무르다 — 흙(戊己)으로 길러 주고 불(丁)로 다듬는다",
          "여름": "여름 쇠는 열에 녹는다 — 물(壬)로 식히고 흙으로 받쳐야 한다",
          "가을": "가을은 쇠의 계절 — 강한 쇠를 불(丁)로 제련해야 그릇이 된다(辛은 물로 씻어 빛냄)",
          "겨울": "차가운 쇠는 얼어붙는다 — 불(丙丁)로 데워야 한다"},
    "수": {"봄": "봄물은 흩어지기 쉽다 — 쇠(庚辛)로 근원을 대고 흙(戊)으로 둑을 쌓는다",
          "여름": "여름물은 마른다 — 쇠(庚辛)로 물줄기를 이어 줘야 한다",
          "가을": "가을물은 맑고 차다 — 나무(甲)로 흘려보내거나 둑(戊)으로 다스린다",
          "겨울": "겨울물은 얼고 넘친다 — 둑(戊)과 햇볕(丙)이 필요하다"},
}
GYEOK_INFO = {  # 격의 십신 → (순용/역용, 고전 요지, 현대 그릇)
    "정관": ("순용(順用)", "정관(正官)은 선(善)한 신이라 재(財)로 생하고 인(印)으로 보호한다. 상관(傷官)이 관을 치거나 칠살이 섞이면 격이 탁해진다.",
           "조직·제도 안에서 신뢰로 성장하는 그릇 — 공직, 대기업, 법·행정, 관리자, 인증·감사 업무"),
    "편관": ("역용(逆用)", "칠살(七殺)은 사나운 신이라 식신(食神)으로 제어하거나(식신제살) 인(印)으로 순화한다(살인상생). 제화(制化)가 없으면 몸을 친다.",
           "압박 속에서 빛나는 위기관리형 그릇 — 리더, 군·경·소방, 의료, 법조, 스타트업 대표, 협상가"),
    "정재": ("순용(順用)", "재(財)는 선한 신이라 몸이 강해야 감당한다. 관(官)을 생하면 재왕생관으로 귀해지고, 식신이 재를 생하면 부(富)가 오래간다. 비겁이 재를 빼앗으면 패한다.",
           "꾸준히 쌓아 가는 관리형 그릇 — 재무·회계, 운영, 유통, 안정적 사업, 자산관리"),
    "편재": ("순용(順用)", "편재(偏財)도 재로서 순용한다. 몸이 강하고 식상·관이 함께하면 크게 쓰이나, 비겁이 많으면 재를 다툰다.",
           "판을 키우는 사업가형 그릇 — 영업, 무역, 투자, 플랫폼·커머스, 프로젝트 사업"),
    "정인": ("순용(順用)", "인수(印綬)는 선한 신이라 관살(官殺)이 생해 주면 귀하다(관인상생). 재(財)가 인을 깨면(탐재괴인) 패하고, 인이 너무 무거우면 재로 덜어낸다.",
           "배움과 자격으로 서는 그릇 — 교육, 연구, 의료·약학, 상담, 공공기관, 출판"),
    "편인": ("순용(順用)", "《자평진전》은 인수(印綬)를 정·편 모두 좋은 격으로 본다. 다만 편인이 식신을 만나면 효신(梟神)이 되어 식신을 빼앗으므로(도식倒食) 재(財)로 제어해야 한다.",
           "남다른 전문성의 그릇 — 기술·연구개발, 디자인, 심리·종교·철학, 데이터·보안, 니치 전문가"),
    "식신": ("순용(順用)", "식신(食神)은 선한 신이라 재(財)를 생하면 부(식신생재), 칠살을 만나면 제어하여 귀(식신제살)가 된다. 편인(효신)이 식신을 치면 패한다.",
           "재능을 꾸준히 생산하는 그릇 — 전문 기술, 콘텐츠·요리·교육, 크리에이터, 서비스업"),
    "상관": ("역용(逆用)", "상관(傷官)은 재주가 넘쳐 관(官)을 다친다. 재(財)로 흘려보내거나(상관생재) 인(印)으로 다스리면(상관패인) 쓰이고, 정관을 보면(상관견관) 화가 생긴다.",
           "틀을 깨는 혁신가형 그릇 — 기획, 예술, 마케팅, 변호·논객, 창업, 프리랜서"),
    "건록": ("별도 취용", "월령이 일간의 녹(祿)이면 몸이 이미 강하므로 녹 자체를 쓰지 않고 관(官)·재(財)·식상(食傷)을 찾아 쓴다.",
           "스스로 서는 자수성가형 그릇 — 독립 전문직, 1인 사업, 운동·기술직, 현장 리더"),
    "양인": ("역용(逆用)", "양인(陽刃)은 칼날 같은 강함이라 관살로 제어해야 귀하다(양인가살). 관살이 없으면 흉폭해지기 쉽다.",
           "칼을 다루는 결단형 그릇 — 외과의, 군·경, 법조, 위기관리, 경쟁이 센 분야의 승부사"),
    "월겁": ("별도 취용", "월령이 비겁이면 녹겁격으로 보고 관·재·식상을 찾아 쓴다.",
           "독립심 강한 그릇 — 동업보다 단독 운영, 경쟁 분야, 영업 일선"),
}


def jo(word: str, pair: str) -> str:
    """받침에 맞는 조사: jo('토', '을를') → '토를'. 괄호 속 한자는 건너뛴다."""
    base = re.sub(r"\([^)]*\)", "", str(word)).strip("* ")
    ch = next((c for c in reversed(base) if "가" <= c <= "힣"), None)
    bat = ch is not None and (ord(ch) - 0xAC00) % 28 != 0
    return f"{word}{pair[0] if bat else pair[1]}"


def _e(i: int) -> str:
    return f"{ELEMENTS[i]}({EH[ELEMENTS[i]]})"


def _god(g: str) -> str:
    return f"[[{g}]]({GOD_HANJA.get(g, '')})" if g in GOD_HANJA and g != "일간(나)" else g


def _stem(s: int) -> str:
    return f"{STEMS[s]}({STEMS_KO[s]})"


def _plain(t: str) -> str:
    """계절 설명에서 특정 천간 표기를 지운다(일간 음양에 따라 조후 글자가 달라서)."""
    return re.sub(r"\([甲乙丙丁戊己庚辛壬癸]+\)", "", t)


def _wangsang(el: int, month_branch: int) -> str:
    """왕상휴수사(旺相休囚死): 월령(계절) 오행에 대한 어떤 오행의 상태."""
    m = MONTH_ELEMENT[month_branch]
    if el == m:
        return "왕(旺)"
    if (m + 1) % 5 == el:
        return "상(相)"
    if (el + 1) % 5 == m:
        return "휴(休)"
    if (el + 2) % 5 == m:
        return "수(囚)"
    return "사(死)"


WS_TEXT = {"왕(旺)": "계절이 바로 내 기운 — 가장 힘이 넘친다", "상(相)": "계절이 나를 낳아 준다 — 힘이 붙는 중",
           "휴(休)": "내가 계절을 낳느라 쉬는 중 — 힘이 빠져 있다", "수(囚)": "내가 계절을 이기려다 갇힌 꼴 — 힘이 묶였다",
           "사(死)": "계절이 나를 누른다 — 가장 힘이 약하다"}


# ============================================================================================
def build(r, fx: dict) -> dict:
    c, a = r.chart, r.analysis
    ds = c.day_stem
    de = STEM_ELEMENT[ds]
    female = c.birth.gender == "여"
    ps = {p.label: p for p in c.pillars}
    has_hour = "시주" in ps
    mb = c.month.branch
    season = SEASON[mb]
    stems_other = [(p.label, p.stem) for p in c.pillars if p.label != "일주"]
    stem_gods = {lbl: ten_god(ds, s) for lbl, s in stems_other}
    all_stems = [p.stem for p in c.pillars]

    def grp_el(g: str) -> int:
        return {"비겁": de, "식상": (de + 1) % 5, "재성": (de + 2) % 5, "관성": (de + 3) % 5, "인성": (de + 4) % 5}[g]

    def visible(god: str) -> list[str]:
        return [lbl for lbl, gname in stem_gods.items() if gname == god]

    def present_group(g: str) -> bool:  # 천간 투출 또는 지지 정기
        return any(GROUP[x] == g for x in stem_gods.values()) or any(
            GROUP.get(ten_god(ds, branch_main_stem(p.branch)), "") == g for p in c.pillars)

    def strong_group(g: str, th: float = 18) -> bool:
        return a.group_weight.get(g, 0) >= th

    # ---------------------------------------------------------------- 공통 계산
    ws = _wangsang(de, mb)
    # 통근(通根): 지지 지장간에 일간과 같은 오행
    roots = []
    for p in c.pillars:
        for i, (s, days) in enumerate(HIDDEN[p.branch]):
            if STEM_ELEMENT[s] == de:
                kind = "정기" if i == len(HIDDEN[p.branch]) - 1 else ("중기" if len(HIDDEN[p.branch]) == 3 and i == 1 else "여기")
                roots.append((p.label, BRANCHES[p.branch], STEMS[s], kind))
    root_power = sum({"정기": 3, "중기": 1.5, "여기": 1}[k] * (2 if lbl == "월주" else 1) for lbl, _, _, k in roots)
    # 사령(司令): 절입 후 경과일로 월지 지장간 중 당령한 글자
    days_in = (c.utc - c.prev_jie[0]).total_seconds() / 86400
    acc, sallyeong = 0.0, HIDDEN[mb][-1][0]
    for s, d in HIDDEN[mb]:
        acc += d
        if days_in < acc:
            sallyeong = s
            break
    # 투출(透出): 지장간 중 천간에 드러난 것
    tuchul = []
    for p in c.pillars:
        for s, _ in HIDDEN[p.branch]:
            if s in [st for lbl2, st in stems_other]:
                tuchul.append((p.label, BRANCHES[p.branch], STEMS[s]))
    # 원국 관계
    rel = a.relations
    rel_txt = [str(x) for x in rel]

    # ============================================================ 1. 연해자평 — 뼈대
    dmh = f"{STEMS[ds]}({STEMS_KO[ds]})"
    yy = "양(陽)" if ds % 2 == 0 else "음(陰)"
    palace_lines = []
    for lbl in POS:
        if lbl not in ps:
            palace_lines.append(f"**{lbl}({POS_HANJA[lbl]})** — 출생 시각을 몰라 비워 둔다. {PALACE[lbl][0]}의 판단은 참고만 한다.")
            continue
        p = ps[lbl]
        sg = "나(日干)" if lbl == "일주" else _god(ten_god(ds, p.stem))
        bg = _god(ten_god(ds, branch_main_stem(p.branch)))
        palace_lines.append(f"**{lbl}({POS_HANJA[lbl]}) {p.hanja}** — {PALACE[lbl][0]}. 천간 {sg}, 지지 {bg}. "
                            f"→ {PALACE[lbl][1]}에 {GROUP.get(ten_god(ds, branch_main_stem(p.branch)), '')} 기운이 자리한다.")
    if female:
        six = [("정관·편관([[관성]])", "남편·연인", "직장·사회적 책임"), ("식신·상관([[식상]])", "자녀", "작품·표현·제자"),
               ("정인·편인([[인성]])", "어머니", "스승·후원자·자격"), ("정재·편재([[재성]])", "아버지·시어머니", "재물·현실 감각"),
               ("비견·겁재([[비겁]])", "형제·친구", "동료·경쟁자")]
    else:
        six = [("정재·편재([[재성]])", "아내·연인(편재는 아버지)", "재물·현실 감각"), ("정관·편관([[관성]])", "자녀", "직장·명예"),
               ("정인·편인([[인성]])", "어머니", "스승·후원자·자격"), ("식신·상관([[식상]])", "할머니·장모(고법)", "표현·재능·부하"),
               ("비견·겁재([[비겁]])", "형제·친구", "동료·경쟁자")]
    six_lines = [f"{n}: 고전 육친(六親)은 **{k}**, 현대적으로는 {m}. 원국 비중 {a.group_weight[GROUP_KEY]}%"
                 for (n, k, m), GROUP_KEY in zip(six, [("관성" if female else "재성"), ("식상" if female else "관성"),
                                                     "인성", ("재성" if female else "식상"), "비겁"])]
    tc_list = ", ".join(f"{lbl[0]}지 {b} 속 {s}" for lbl, b, s in tuchul) or "없음"
    lens1 = {
        "id": "japyeong", "book": "연해자평(淵海子平)", "era": "송(宋) 서자평(徐子平) 학설 → 서대승(徐大升) 《연해》·《연원》 → 명(明) 당금지(唐錦池) 합편",
        "lens": "뼈대", "icon": "🦴",
        "q": "이 사람의 '나'는 누구이고, 주변 기운은 나와 어떤 관계로 짜여 있는가?",
        "easy": f"사주를 사람 몸에 비유하면 이 책은 '뼈대'를 본다냥. 태어난 날의 천간 {dmh}을 '나'로 세우고, 나머지 일곱 글자가 나에게 무엇(돈·일·사람·배움)인지 관계도를 그린다냥.",
        "classic": [
            f"《연해자평》은 연주(年柱) 중심이던 옛 법(古法)을 바꿔 **일간(日干)을 주인(以日為主)**으로 세운 신법(新法)의 출발점이다. 이 사주의 주인은 {yy} {_e(de)}인 **{dmh}**이다.",
            f"일간 {jo(dmh, '은는')} 월령 {BRANCHES[mb]}({BRANCHES_KO[mb]})월, 즉 {season}({SEASON_HANJA[season]})에 태어나 계절 기운에 대해 **{ws}** 상태다 — {WS_TEXT[ws]}. "
            f"이를 [[왕상휴수사]](旺相休囚死)로 본다.",
            f"일간의 뿌리([[통근]], 通根)는 " + (", ".join(f"{lbl[0]}지 {b}의 {s}({k})" for lbl, b, s, k in roots) or "지지에 없다") +
            f" — 뿌리 점수 {root_power:.1f}" + (" (튼튼함)" if root_power >= 4 else " (약함)" if root_power < 2 else " (보통)") + ".",
            "궁위(宮位)로 본 여덟 글자의 배치:", *palace_lines,
            f"[[지장간]](支藏干) 중 천간으로 드러난 것([[투출]], 透出): {tc_list}. 고전은 드러난 글자를 '쓸 수 있는 힘', 숨은 글자를 '때를 기다리는 힘'으로 본다.",
            "원국 안의 합충(合沖): " + (" / ".join(rel_txt) if rel_txt else "큰 합충이 없어 궁위끼리 비교적 안정되어 있다."),
            f"대운(大運)은 {fx['평생운']['대운'][0]['나이']}세에 시작해 {r.daewoon_info['direction']}한다 — 《연해자평》 이래의 법: 양남음녀(陽男陰女)는 순행, 음남양녀는 역행, 절기까지의 날수를 3으로 나눠 대운수를 정한다.",
        ],
        "modern": [
            f"일간은 **정체성(identity)**이다. {jo(dmh, '은는')} '{DAY_MASTER[STEMS[ds]][0]}' — {DAY_MASTER[STEMS[ds]][1]}",
            "십신(十神)은 고전에서 가족 관계(육친)였지만, 현대에는 **사회적 역할 관계도**로 읽는다:", *six_lines,
            "궁위는 '시기'와 '관계 영역'의 지도다. 예컨대 월주는 부모 자리이면서 동시에 20대의 사회 첫 무대, 일주는 배우자 자리이면서 30~40대의 생활 공간이다.",
            "고전의 남녀 육친 배정(여명에 관성=남편 등)은 가부장 시대의 틀이다. 현대에는 성별과 무관하게 관성=조직·책임, 재성=자원·현실, 식상=표현, 인성=배움, 비겁=동료로 읽는 것이 자연스럽다.",
        ],
        "basis": [f"일간 {dmh}", f"월령 {BRANCHES[mb]} → {ws}", f"통근 {len(roots)}곳", f"투출 {len(tuchul)}개"],
    }

    # ============================================================ 2. 삼명통회 — 백과사전
    naeum = {}
    for lbl in POS:
        if lbl in ps:
            n = NAEUM[ps[lbl].index // 2]
            naeum[lbl] = n
    yn = naeum["연주"]; dn = naeum["일주"]
    yn_el = "목화토금수".index(yn.split("(")[0][-1]) if yn.split("(")[0][-1] in "목화토금수" else None
    dn_el = "목화토금수".index(dn.split("(")[0][-1]) if dn.split("(")[0][-1] in "목화토금수" else None

    def rel_el(x: int, y: int) -> str:
        if x == y:
            return "같은 오행 — 본명과 나의 결이 같다"
        if (x + 1) % 5 == y:
            return "연주 납음이 일주 납음을 생(生) — 집안·뿌리가 나를 길러 준다"
        if (y + 1) % 5 == x:
            return "일주 납음이 연주 납음을 생(生) — 내가 집안·뿌리를 돌보는 쪽"
        if (x + 2) % 5 == y:
            return "연주 납음이 일주 납음을 극(剋) — 집안의 기대·틀이 나를 누르기 쉽다"
        return "일주 납음이 연주 납음을 극(剋) — 내가 집안의 틀을 깨고 나오는 쪽"

    sins = {s.name: s.where for s in a.sinsal}
    sin_classic = {
        "천을귀인": ("천을귀인(天乙貴人) — 제신(諸神) 중 으뜸 길신, 흉을 만나도 도움을 받는다", "위기 때 나타나는 조력자·멘토 운. 네트워크와 평판이 자산"),
        "문창귀인": ("문창귀인(文昌貴人) — 총명하고 글재주가 있다", "시험·글쓰기·발표·기획서에 강함"),
        "양인살": ("양인(陽刃) — 칼날, 과강하면 흉하나 관살로 제어하면 위엄", "결단력·승부욕. 외과·군경·법조·스포츠에서 강점"),
        "홍염살": ("홍염(紅艶) — 이성의 정이 많다", "분위기 있는 매력, 대중 호감도. 연애·연예·뷰티·서비스업"),
        "금여록": ("금여(金輿) — 황금 수레, 배우자 덕과 품위", "생활 수준·배우자 복, 품위 있는 라이프스타일"),
        "백호대살": ("백호(白虎) — 옛날엔 혈광(血光)을 경계한 '센 기운'으로 보았다", "강한 에너지. 의료·위험관리·전문직에서 쓰면 길, 안전·건강 관리 필요"),
        "천덕귀인": ("천덕(天德) — 하늘의 덕으로 흉을 줄인다", "타고난 보호막, 큰 사고를 비껴가는 운"),
        "월덕귀인": ("월덕(月德) — 달의 덕, 온화하고 인덕이 있다", "인복·온화한 평판"),
        "괴강살": ("괴강(魁罡) — 총명하고 강하나 극단으로 흐르기 쉽다", "카리스마형 리더십. 고집만 다스리면 큰 그릇"),
        "공망": ("공망(空亡) — 비어 있어 그 자리의 힘이 헛되기 쉽다", "그 영역은 물질보다 정신적 가치로 쓰거나, 늦게 채워진다"),
        "역마살": ("역마(驛馬) — 분주히 움직이고 타향에서 일한다", "해외·출장·이직·디지털 노마드, 이동이 곧 기회"),
        "도화살": ("도화(桃花) — 주색(酒色)을 경계했다", "인기·매력·SNS 영향력. 현대에는 브랜딩 자산"),
        "화개살": ("화개(華蓋) — 예술·종교·고독의 별", "깊이 파고드는 연구자·예술가 기질, 혼자 충전하는 시간 필요"),
    }
    sin_lines_c = [f"{sin_classic[k][0]} — 위치: {'·'.join(v)}주" for k, v in sins.items() if k in sin_classic]
    sin_lines_m = [f"[[{k}]]: {sin_classic[k][1]}" for k in sins if k in sin_classic]
    gm_pos = sins.get("공망", [])
    gm_mean = {"연": "일찍 자기 길을 내는 독립형", "월": "부모·첫 직장에 기대기보다 스스로 길을 내는 타입",
               "시": "자녀·말년 계획이 늦게 채워짐, 정신적 결실을 중시"}
    t12y = a.twelve_sinsal["연지기준"]; t12d = a.twelve_sinsal["일지기준"]
    target = fx["신년운세"]["연도"]
    yb = year_index(target) % 12
    lens2 = {
        "id": "samyeong", "book": "삼명통회(三命通會)", "era": "명(明) · 만민영(萬民英) 편찬",
        "lens": "백과사전", "icon": "📚",
        "q": "옛 법과 새 법, 수많은 신살과 납음까지 — 이 사주에 찍힌 '특별 도장'은 무엇인가?",
        "easy": "이 책은 명리학의 '백과사전'이다냥. 일간 중심 신법뿐 아니라, 태어난 해를 중심으로 보던 옛 법, 60갑자마다 붙은 자연 이미지(납음), 수많은 신살을 모두 모아 놨다냥. 주인공이 아니라 '보조 자료'로 쓰는 게 요령이다냥.",
        "classic": [
            "《삼명통회》의 '삼명(三命)'은 고법에서 연주를 **녹(祿, 연간)·명(命, 연지)·신(身, 연주 납음)**으로 나눠 본 데서 왔다고 풀이한다.",
            "**[[납음]](納音) 오행** — 60갑자를 두 개씩 묶어 자연물에 빗댄 것:",
            *[f"{lbl}({POS_HANJA[lbl]}) {ps[lbl].hanja} → **{naeum[lbl]}**: {NAEUM_IMAGE[naeum[lbl].split('(')[0]]}" for lbl in POS if lbl in naeum],
            f"본명(本命, 연주) 납음 {yn}과 일주 납음 {dn}의 관계: " + (rel_el(yn_el, dn_el) if yn_el is not None and dn_el is not None else "판단 생략") + ".",
            "**신살(神煞)**:" if sin_lines_c else "원국에 두드러진 신살이 없다 — 고법에서도 '평순한 명'으로 본다.",
            *sin_lines_c,
            f"**[[12신살]](十二神煞)** 연지 기준: " + " · ".join(f"{k}주 {v}" for k, v in t12y.items())
            + f" / 일지 기준: " + " · ".join(f"{k}주 {v}" for k, v in t12d.items()),
            f"[[공망]](空亡) 글자: {''.join(a.gongmang)}" + (f" — 원국 {', '.join(p + '주' for p in gm_pos)}에 걸림: " + "; ".join(gm_mean.get(p, '') for p in gm_pos) if gm_pos else " — 원국에 걸린 자리는 없다."),
        ],
        "modern": [
            "현대 명리에서 신살은 **보조 지표**다. 같은 도화라도 격국과 기세가 좋으면 '인기', 나쁘면 '구설'이 되므로 신살만으로 길흉을 단정하지 않는다.",
            *sin_lines_m,
            "납음은 성격 이미지·브랜딩 스토리로 쓰기 좋다(예: '나는 장류수, 길게 흐르는 강 같은 사람'). 다만 운의 판단 근거로는 거의 쓰지 않는다.",
            f"{target}년 세운 지지 {BRANCHES[yb]}({BRANCHES_KO[yb]})는 연지 기준 **{twelve_sinsal(c.year.branch, yb)}**, 일지 기준 **{twelve_sinsal(c.day.branch, yb)}**에 해당한다 — 올해 생활의 분위기를 보조적으로 알려 준다.",
        ],
        "basis": [f"연주 납음 {yn}", f"일주 납음 {dn}", f"신살 {len(sins)}종", f"공망 {''.join(a.gongmang)}"],
    }

    # ============================================================ 3. 적천수 — 기세
    w = a.element_weight
    order = sorted(ELEMENTS, key=lambda e: -w[e])
    top_el, low_el = order[0], order[-1]
    # 유통: 상생 고리 끊김, 상전(相戰) → 통관
    wars = []
    for i in range(5):
        x, y = ELEMENTS[i], ELEMENTS[(i + 2) % 5]
        if w[x] >= 22 and w[y] >= 22:
            mid = ELEMENTS[(i + 1) % 5]
            wars.append((x, y, mid))
    breaks = [ELEMENTS[i] for i in range(5) if w[ELEMENTS[i]] < 6]
    # 청탁: 관살혼잡, 식상혼잡, 기신 비중
    gwansal_mix = bool(visible("정관")) and bool(visible("편관"))
    sik_mix = bool(visible("식신")) and bool(visible("상관"))
    gi_w = w[a.gishin] + w[a.gushin]
    if gi_w < 30 and not gwansal_mix:
        cheong = "청(淸)한 편"
        cheong_why = f"부담 오행(기신 {a.gishin}·구신 {a.gushin}) 합계 {gi_w:.0f}%로 가볍고 기운이 섞이지 않았다"
    elif gi_w >= 45 or (gwansal_mix and sik_mix):
        cheong = "탁(濁)한 편"
        cheong_why = f"부담 오행 합계 {gi_w:.0f}%" + (", 정관·편관이 함께 드러난 관살혼잡(官殺混雜)" if gwansal_mix else "") + (", 식신·상관 혼재" if sik_mix else "")
    else:
        cheong = "청탁이 섞인 중간"
        cheong_why = f"부담 오행 합계 {gi_w:.0f}%" + (" · 관살혼잡 있음" if gwansal_mix else "")
    # 진가: 용신이 천간에 있고 지지에 뿌리가 있나
    y_idx = ELEMENTS.index(a.yongshin)
    y_in_stem = [p.label for p in c.pillars if STEM_ELEMENT[p.stem] == y_idx and p.label != "일주"]
    y_root = [p.label for p in c.pillars if any(STEM_ELEMENT[s] == y_idx for s, _ in HIDDEN[p.branch])]
    y_ws = _wangsang(y_idx, mb)
    y_sl = STEM_ELEMENT[sallyeong] == y_idx
    jin = y_ws in ("왕(旺)", "상(相)") or y_sl
    power = ("유력(有力) — 천간에 드러나고 지지에 뿌리도 있다" if y_in_stem and y_root else
             "반유력 — " + ("천간에만 떠 있고 뿌리가 없다" if y_in_stem else "지지 속에만 숨어 있다(운에서 드러날 때 힘을 쓴다)") if (y_in_stem or y_root)
             else "무력(無力) — 원국에 거의 없어 운(運)에서 와야 쓴다")
    jinga = (f"{'진(眞)' if jin else '가(假)'} — 월령에서 {y_ws}" + (" · 사령한 기운" if y_sl else "")
             + (" 이라 계절이 용신을 밀어준다" if jin else " 이라 계절의 도움은 약하다") + f" / {power}")
    strength_word = a.strength
    shun = ("왕한 기운을 덜어 주는 방향(설기·극제)" if a.strength_score >= 55 else
            "약한 일간을 돕는 방향(생조·방조)" if a.strength_score <= 45 else "균형을 지키는 방향(치우친 쪽을 살짝 덜기)")
    jong = [n for n in a.notes if "종" in n]
    cur = fx["평생운"]["현재"]
    yf = fx["신년운세"]

    def el_tag(e: str) -> str:
        return ("용신" if e == a.yongshin else "희신" if e == a.huishin else "기신" if e == a.gishin
                else "구신" if e == a.gushin else "한신")

    lens3 = {
        "id": "jeokcheon", "book": "적천수(滴天髓)", "era": "원문 경도(京圖)·주석 명(明) 유기(劉基)로 전함(가탁설 있음) · 청(淸) 임철초(任鐵樵) 《적천수천미》",
        "lens": "기세", "icon": "🌊",
        "q": "여덟 글자의 힘은 어디로 쏠리고, 막힌 데 없이 흐르는가? 무엇으로 균형을 잡는가?",
        "easy": "이 책은 사주를 '강물의 흐름'처럼 본다냥. 어느 기운이 세고 어디가 막혔는지, 물길(기세)을 거스르지 않고 균형(중화)을 잡는 법을 알려 준다냥.",
        "classic": [
            "《적천수》의 요지: **\"능지쇠왕지진기(能知衰旺之眞機), 기어삼명지오(其於三命之奧), 사과반의(思過半矣)\"** — 쇠하고 왕한 진짜 기틀을 알면 명리의 오묘함은 절반을 안 것이다.",
            f"**왕쇠(旺衰)**: 일간 {jo(dmh, '은는')} 지지 세력 {a.strength_score}%로 **{strength_word}**이다. 득령(得令) {'○' if a.deukryeong else '×'}, 득지(得地) {'○' if a.deukji else '×'}, 득세(得勢) {'○' if a.deukse else '×'}. 월령 상태는 {ws}, 통근 점수 {root_power:.1f}.",
            "**오행 세력**: " + " > ".join(f"{_e(ELEMENTS.index(e))} {w[e]}%" for e in order) + f". 가장 왕한 신(旺神)은 {_e(ELEMENTS.index(top_el))}이다.",
            "**유통(流通)**: " + ("상생의 고리가 끊긴 데 없이 흐른다." if not breaks and not wars else
                              ("거의 없는 오행 " + ", ".join(_e(ELEMENTS.index(b)) for b in breaks) + "에서 흐름이 끊긴다. " if breaks else "")
                              + "".join(f"{jo(_e(ELEMENTS.index(x)), '과와')} {jo(_e(ELEMENTS.index(y)), '이가')} 맞서 싸우니(상전, 相戰) 사이를 잇는 {jo(_e(ELEMENTS.index(m)), '이가')} [[통관]](通關) 신이다. " for x, y, m in wars)),
            f"**청탁(淸濁)**: {cheong} — {cheong_why}.",
            f"**진가(眞假)**: 《적천수》는 \"영상심진(令上尋眞)\" — 월령 위에서 진짜를 찾으라 했다. 억부 용신 {jo(_e(y_idx), '은는')} {jinga}.",
            f"**억부(抑扶)**: {a.yong_note.split(' 조후:')[0].replace('억부: ', '')} → 용신 {a.yongshin}, 희신 {a.huishin}, 기신 {a.gishin}, 구신 {a.gushin}, 한신 {a.hanshin}. 기세의 방향은 {shun}이다.",
            *([f"**종화(從化)**: {n}. 《적천수》는 '종(從)'을 함부로 정하지 말라 하니, 실제 삶의 흐름과 대조해 판단한다." for n in jong]),
        ],
        "modern": [
            f"기세는 오늘날 말로 **에너지 밸런스**다. 가장 센 {top_el} 기운은 너의 기본 엔진이고, 가장 약한 {low_el} 기운({w[low_el]}%)은 의식해서 채워야 할 영역이다.",
            ("일간이 강한 사람은 '쏟아낼 곳'이 있어야 건강하다 — 일·운동·창작으로 에너지를 내보내지 않으면 고집·과열로 번진다."
             if a.strength_score >= 55 else
             "일간이 약한 사람은 '받쳐 줄 것'이 있어야 빛난다 — 배움·자격·좋은 팀이 곧 체력이다. 혼자 다 떠안으면 번아웃이 온다."
             if a.strength_score <= 45 else
             "일간이 균형을 이룬 사람은 환경 변화에 덜 흔들린다. 다만 한쪽으로 크게 몰리는 운에서는 균형을 다시 잡는 습관이 중요하다."),
            "막힌 곳(유통·통관)은 실제 삶에서 **연결이 필요한 지점**이다. " + (f"예컨대 {jo(wars[0][0], '과와')} {wars[0][1]}의 충돌은 {wars[0][2]} 성격의 사람·활동이 중재해 준다." if wars else "지금 원국은 큰 충돌이 없어 에너지가 비교적 자연스럽게 돈다."),
            f"청탁은 '깔끔함'의 문제다. {cheong} 사주는 " + ("목표가 선명할 때 크게 성과를 낸다." if "청" in cheong and "탁" not in cheong else "관심사가 넓은 대신 우선순위를 정해 줘야 힘이 모인다."),
        ],
        "basis": [f"{strength_word} {a.strength_score}%", f"왕신 {top_el}", f"청탁: {cheong}", f"용신 {a.yongshin}({'진' if jin else '가'})"],
    }

    # ============================================================ 4. 자평진전 — 격국
    g_name = a.gyeokguk
    key = ("편관" if "편관" in g_name else "건록" if "건록" in g_name else "양인" if "양인" in g_name
           else "월겁" if "월겁" in g_name else g_name.replace("격", ""))
    info = GYEOK_INFO.get(key, ("—", "", ""))
    sal_name = HIDDEN[mb]
    sl_god = ten_god(ds, sallyeong)
    vis = set(stem_gods.values())
    has = lambda *gods: any(g in vis for g in gods)  # noqa: E731
    seong, pae, sang, gu = [], [], [], []
    if key == "정관":
        if has("정재", "편재"): seong.append("재(財)가 관을 생함 — 재왕생관(財旺生官)"); sang.append("재성")
        if has("정인", "편인"): seong.append("인(印)이 관을 보호함 — 관인상생(官印相生)"); sang.append("인성")
        if has("상관"): pae.append("상관(傷官)이 드러나 관을 침 — 상관견관(傷官見官)")
        if has("편관"): pae.append("칠살이 섞임 — 관살혼잡(官殺混雜)")
        if has("상관") and has("정인", "편인"): gu.append("인성이 상관을 제어해 관을 지킴(구응 救應)")
    elif key == "편관":
        if has("식신"): seong.append("식신이 칠살을 제어 — 식신제살(食神制殺)"); sang.append("식신")
        if has("상관"): seong.append("상관이 칠살을 다스림 — 상관가살(傷官駕殺)"); sang.append("상관")
        if has("정인", "편인"): seong.append("인이 칠살을 순화 — 살인상생(殺印相生)"); sang.append("인성")
        if has("정재", "편재") and a.strength_score >= 55 and a.group_weight["관성"] < 20:
            seong.append("신강하고 살이 약해 재로 살을 돕는다 — 재자약살(財滋弱殺)"); sang.append("재성")
        elif has("정재", "편재") and not (has("식신", "상관") or has("정인", "편인")):
            pae.append("재가 칠살 편에 서는데 제화가 없음 — 재당살(財黨殺)")
        if not (has("식신", "상관") or has("정인", "편인")): pae.append("칠살을 다스리는 신(식신·인성)이 천간에 없음")
        if has("정관"): pae.append("정관이 섞임 — 관살혼잡")
    elif key in ("정재", "편재"):
        if has("정관"): seong.append("재가 정관을 생 — 재왕생관(財旺生官)"); sang.append("정관")
        if has("식신", "상관"): seong.append("식상이 재를 생 — 식신생재"); sang.append("식상")
        if has("편관"):
            if has("식신") or has("정인", "편인"):
                gu.append("칠살이 드러났으나 식신(제살)이나 인성(화살)이 있어 재투칠살의 해를 줄임(구응)")
            pae.append("재격에 칠살이 드러남 — 재투칠살(財透七殺)")
        if a.strength_score <= 40: pae.append("일간이 약해 재를 감당하기 버거움 — 재다신약(財多身弱)")
        if has("겁재", "비견") and not has("정관", "편관"): pae.append("비겁이 재를 다툼 — 군겁쟁재(群劫爭財)")
        if has("비견", "겁재") and has("정관", "편관"): gu.append("관성이 비겁을 눌러 재를 지킴(구응)")
    elif key in ("정인", "편인"):
        if has("정관", "편관"): seong.append("관살이 인을 생 — 관인상생/살인상생"); sang.append("관성")
        if a.strength_score >= 60 and has("정재", "편재"): seong.append("인이 무거워 재로 덜어냄 — 인중용재(印重用財)"); sang.append("재성")
        if has("정재", "편재") and a.strength_score < 50: pae.append("재가 인을 깸 — 탐재괴인(貪財壞印)")
        if has("식신", "상관") and a.strength_score >= 55:
            seong.append("신강하고 인이 왕해 식상으로 빼냄 — 인수용식상(印綬用食傷)"); sang.append("식상")
        elif key == "편인" and has("식신"):
            pae.append("편인이 식신을 침 — 효신탈식(梟神奪食, 도식)")
    elif key == "식신":
        if has("정재", "편재") and has("편관"):
            pae.append("재와 칠살이 함께 드러남 — 생재로살(生財露殺)")
        elif has("정재", "편재"):
            seong.append("식신이 재를 생 — 식신생재(食神生財)"); sang.append("재성")
        elif has("편관"):
            seong.append("식신이 칠살을 데리고 다스림 — 식신대살(食神帶殺)"); sang.append("편관")
        if has("편인"): pae.append("편인(효신)이 식신을 침 — 효신탈식(梟神奪食)")
        if has("편인") and has("정재", "편재"): gu.append("재가 편인을 눌러 식신을 지킴(구응)")
    elif key == "상관":
        if has("정재", "편재"): seong.append("상관이 재를 생 — 상관생재(傷官生財)"); sang.append("재성")
        if has("정인", "편인") and a.strength_score < 50: seong.append("인으로 상관을 다스림 — 상관패인(傷官佩印)"); sang.append("인성")
        if has("편관"): seong.append("상관이 칠살과 짝 — 상관가살(傷官駕殺)"); sang.append("편관")
        geumsu = STEMS[ds] in "庚辛" and mb in (11, 0)
        if has("정관") and geumsu:
            seong.append("금수상관(金水傷官)은 추워서 관(火)을 반긴다 — 상관견관이 오히려 길")
            sang.append("정관")
        elif has("정관"):
            pae.append("정관을 봄 — 상관견관(傷官見官)")
        if has("정관") and has("정인", "편인"): gu.append("인성이 상관을 다스려 관을 지킴(구응)")
    elif key in ("건록", "월겁"):
        if has("정관"): seong.append("녹겁격에 정관이 드러남 — 녹겁용관(祿劫用官)"); sang.append("정관")
        if has("정재", "편재"): seong.append("재를 씀 — 녹겁용재(祿劫用財)"); sang.append("재성")
        if has("식신", "상관"): seong.append("식상을 씀 — 녹겁용식상"); sang.append("식상")
        if has("편관") and (has("식신") or has("정인", "편인")):
            seong.append("칠살을 식신이나 인성으로 다스려 씀 — 녹겁용살(祿劫用殺)"); sang.append("편관")
        if not (has("정관", "편관") or has("정재", "편재") or has("식신", "상관")): pae.append("쓸 신(관·재·식상)이 천간에 없음 — 비겁만 왕함")
    elif key == "양인":
        if has("정관", "편관"): seong.append("관살이 양인을 제어 — 양인가살(陽刃駕殺)"); sang.append("관성")
        else: pae.append("양인을 다스릴 관살이 천간에 없음")
    if seong and not pae:
        verdict = "성격(成格) — 격이 제대로 섰다"
    elif seong and pae:
        verdict = "성중유패(成中有敗) — 격은 섰으나 흠이 있다" + (" / 구응(救應)이 있어 흠을 메운다" if gu else "")
    elif pae:
        verdict = "패격(敗格) 요소가 앞선다" + (" — 그러나 구응이 있다" if gu else " — 운(運)에서 상신이 올 때 격이 선다")
    else:
        verdict = "미정(未定) — 성패를 가를 글자가 천간에 드러나지 않아 지장간과 운에서 판가름"
    verdict_short = verdict.split(" — ")[0]
    # 운이 격을 돕는/깨는 십신
    BREAKER = {"정관": {"상관": "상관견관", "편관": "관살혼잡"}, "편관": {"정재": "재자살", "편재": "재자살"},
               "정재": {"겁재": "겁재탈재", "비견": "비겁쟁재", "편관": "재투칠살"}, "편재": {"겁재": "겁재탈재", "비견": "비겁쟁재", "편관": "재투칠살"},
               "정인": {"정재": "탐재괴인", "편재": "탐재괴인"}, "편인": {"정재": "탐재괴인", "편재": "탐재괴인"},
               "식신": {"편인": "효신탈식"}, "상관": {"정관": "상관견관"},
               "건록": {"겁재": "비겁 과다"}, "월겁": {"겁재": "비겁 과다"}, "양인": {"식신": "식상이 관살을 제압", "상관": "식상이 관살을 제압"}}
    HELPER = {"정관": {"정재", "편재", "정인", "편인"}, "편관": {"식신", "정인", "편인"}, "정재": {"정관", "식신", "상관"},
              "편재": {"정관", "식신", "상관"}, "정인": {"정관", "편관"}, "편인": {"편관", "정재", "편재"},
              "식신": {"정재", "편재"}, "상관": {"정재", "편재", "정인", "편인"}, "건록": {"정관", "정재", "편재", "식신"},
              "월겁": {"정관", "정재", "편재", "식신"}, "양인": {"정관", "편관", "정재", "편재"}}

    def luck_on_gyeok(sg: str, bg: str) -> str:
        br = BREAKER.get(key, {})
        hp = HELPER.get(key, set())
        bad = [br[x] for x in (sg, bg) if x in br]
        good = [x for x in (sg, bg) if x in hp]
        if bad and not good:
            return "격을 흔듦(" + "·".join(dict.fromkeys(bad)) + ")"
        if good and not bad:
            return "격을 도움(" + "·".join(dict.fromkeys(good)) + ")"
        if good and bad:
            return "돕고 흔들기가 함께"
        return "격에 큰 영향 없음"

    lens4 = {
        "id": "japyeongjinjeon", "book": "자평진전(子平眞詮)", "era": "청(淸) 건륭 연간 · 심효첨(沈孝瞻) 저, 서낙오(徐樂吾) 평주",
        "lens": "격국", "icon": "🏺",
        "q": "이 사람은 사회에서 어떤 '그릇(格)'으로 쓰이며, 그 그릇은 온전한가?",
        "easy": "이 책은 '태어난 달'이 정해 준 사회적 그릇을 본다냥. 그릇의 종류(격)를 정하고, 그 그릇을 받쳐 주는 글자(상신)가 있는지, 깨는 글자는 없는지 따진다냥.",
        "classic": [
            "《자평진전》의 첫 원칙: **\"팔자용신(八字用神), 전구월령(專求月令)\"** — 사주의 용신(=격의 기준)은 오로지 월령에서 구한다. 이 책에서 '용신'은 억부의 보약이 아니라 **월령에서 나온 격의 중심 십신**을 뜻한다는 점이 다른 책과 다르다.",
            f"월령 {BRANCHES[mb]}({BRANCHES_KO[mb]})의 지장간은 " + " · ".join(f"{STEMS[s]}{d}일" for s, d in sal_name)
            + f"이다. 절입({c.prev_jie[1]}) 후 약 {days_in:.1f}일째에 태어나 **{jo(STEMS[sallyeong] + '(' + STEMS_KO[sallyeong] + ')', '이가')} [[사령]](司令)**한다({_god(sl_god)}) — 출생 무렵 당번을 서던 기운이다.",
            f"격국(格局): **{g_name}** — {a.gyeok_note}. " + ("(사령한 글자와 격의 기준 글자가 같아 격의 힘이 순수하다.)" if STEMS[sallyeong] in a.gyeok_note else "(사령 글자와 격의 기준 글자가 달라, 두 기운을 함께 참작한다.)"),
            f"**{info[0]}**: {info[1]}",
            "**성격(成格) 요소**: " + ("; ".join(seong) if seong else "천간에 뚜렷하지 않다"),
            "**패격(敗格) 요소**: " + ("; ".join(pae) if pae else "없다"),
            *(["**구응(救應)**: " + "; ".join(gu)] if gu else []),
            f"**상신(相神)**: " + (", ".join(dict.fromkeys(sang)) + " — 격을 받쳐 주는 재상 같은 글자" if sang else "원국에서 뚜렷하지 않아 운에서 와야 한다") + ".",
            f"**판정**: {verdict}.",
        ],
        "modern": [
            f"격은 현대의 **커리어 아키타입(사회적 그릇)**이다: {info[2]}.",
            "순용격(정관·재·인·식신)은 '키우고 지키는' 방식으로, 역용격(칠살·상관·양인·편인)은 '다스리고 활용하는' 방식으로 성공한다. "
            + ("너는 순용형 — 좋은 기운을 꾸준히 쌓아 신뢰로 올라가는 길이 맞다." if info[0].startswith("순용") else
               "너는 역용형 — 거친 에너지를 기술·전문성으로 다스릴 때 남들이 못 가는 자리에 선다." if info[0].startswith("역용") else
               "너는 녹겁형 — 이미 강한 몸이니 무엇을 '쓸지'(관·재·식상)를 고르는 게 관건이다."),
            ("성격이 잘 섰다는 건 '역할과 재능이 맞물렸다'는 뜻이다. 맞는 조직·분야를 만나면 성장 속도가 빠르다." if seong and not pae else
             "흠(패격 요소)은 실패의 예언이 아니라 **커리어의 리스크 포인트**다: " + "; ".join(pae) + " — 이를 보완하는 상신(사람·제도·기술)을 곁에 두면 된다." if pae else
             "그릇의 성패를 가를 글자가 아직 드러나지 않았다 — 어떤 운(사람·환경)을 만나느냐에 따라 그릇의 쓰임이 정해지는, 가능성이 열린 구조다."),
            f"상신은 현대적으로 **나를 받쳐 주는 조력 구조**다(예: 재성=예산·고객, 인성=자격·멘토, 식신=기술·결과물, 관성=조직·직함).",
        ],
        "basis": [g_name, f"사령 {STEMS[sallyeong]}({sl_god})", info[0], verdict_short],
        "_luck": luck_on_gyeok,
    }

    # ============================================================ 5. 궁통보감 — 계절·조후
    fire = w["화"] + (6 if season == "여름" else 0) + sum(3 for p in c.pillars if p.branch in (7, 10))   # 未戌 조토
    water = w["수"] + (6 if season == "겨울" else 0) + sum(3 for p in c.pillars if p.branch in (4, 1))   # 辰丑 습토
    temp = round(fire - water, 1)
    dry = round((w["화"] + w["목"] * .3 + sum(4 for p in c.pillars if p.branch in (7, 10))) - (w["수"] + w["금"] * .3 + sum(4 for p in c.pillars if p.branch in (4, 1))), 1)
    temp_word = "조열(燥熱) — 덥고 건조" if temp >= 15 and dry >= 5 else "한습(寒濕) — 차고 습함" if temp <= -15 and dry <= -5 else \
        "난(暖) — 따뜻한 편" if temp >= 8 else "한(寒) — 서늘한 편" if temp <= -8 else "온화(溫和) — 온도가 고르다"
    keys = JOHU_KEYS[STEMS[ds]][mb]
    have = []
    for k in keys:
        s = STEMS.index(k)
        at_stem = [p.label[0] for p in c.pillars if p.stem == s and p.label != "일주"]
        at_hidden = [p.label[0] for p in c.pillars if any(h == s for h, _ in HIDDEN[p.branch])]
        have.append((k, at_stem, at_hidden))
    sat = sum(2 if st else 1 if hd else 0 for _, st, hd in have)
    sat_word = "충족(充足)" if sat >= len(keys) * 1.5 else "부분 충족" if sat >= 1 else "부족(不足)"
    johu_els = sorted({ELEMENTS[STEM_ELEMENT[STEMS.index(k)]] for k in keys}, key=ELEMENTS.index)
    temp_el = "수" if temp > 0 else "화"
    warm_dw = [p for p in r.daewoon if temp_el in (ELEMENTS[STEM_ELEMENT[p.pillar.stem]], ELEMENTS[BRANCH_ELEMENT[p.pillar.branch]])]
    lens5 = {
        "id": "gungtong", "book": "궁통보감(窮通寶鑑)", "era": "원명 《난강망(欄江網)》 · 청(淸) 여춘태(余春台) 편 · 서낙오 평주 《조화원약》",
        "lens": "계절", "icon": "🌡️",
        "q": "이 사람은 어떤 계절의 어떤 온도·습도로 태어났고, 무엇으로 온도를 맞춰야 하는가?",
        "easy": "이 책은 사주의 '온도계'다냥. 같은 나무라도 한겨울 나무와 한여름 나무는 필요한 게 다르다냥 — 겨울엔 햇볕, 여름엔 물! 태어난 계절에 맞춰 꼭 필요한 글자를 찾는다냥.",
        "classic": [
            f"《궁통보감》은 **일간 10개 × 월령 12개 = 120가지** 경우마다 조후(調候) 용신을 따로 정한 책이다. 이 사주는 **{dmh} 일간, {BRANCHES[mb]}({BRANCHES_KO[mb]})월({season})** 생이다.",
            f"요지: {_plain(JOHU_WHY['목화토금수'[de]][season])}.",
            f"{STEMS[ds]}일간 {BRANCHES[mb]}월에 통용 조후표가 꼽는 글자: **{' · '.join(k + '(' + STEMS_KO[STEMS.index(k)] + ')' for k in keys)}** — 앞 글자일수록 우선이다(주석본·유파마다 세부 차이가 있다). "
            f"이 중 온도를 직접 맞추는 글자는 물(壬癸)과 불(丙丁)이고, 나머지는 뿌리·제방·땔감처럼 조후를 돕는 글자다.",
            "원국의 조후 글자 보유: " + "; ".join(f"{k} — " + ("천간 " + "·".join(st) + "주에 투출" if st else "") + (" / " if st and hd else "") + ("지장간 " + "·".join(hd) + "지에 암장" if hd else "") if (st or hd) else f"{k} — 없음" for k, st, hd in have)
            + f" → 조후 **{sat_word}**.",
            f"[[한난조습]](寒暖燥濕): 온도 지수 {temp:+}, 건습 지수 {dry:+} → **{temp_word}**.",
            ("조후가 급하면 억부보다 조후를 먼저 쓴다는 것이 이 책의 태도다. 이 사주는 온도의 치우침이 커서 조후 비중이 높다."
             if abs(temp) >= 15 else "온도의 치우침이 크지 않아 조후는 보조로, 격국·억부를 주로 쓴다."),
        ],
        "modern": [
            f"조후는 현대적으로 **몸과 마음의 온도 관리**다. {temp_word.split(' — ')[0]} 체질은 " + (
                "열이 많고 급해지기 쉽다 — 휴식·수분·차분한 환경(수 기운)이 성과를 지켜 준다." if temp >= 8 else
                "기운이 가라앉기 쉽다 — 햇볕·운동·따뜻한 관계(화 기운)가 동력을 만든다." if temp <= -8 else
                "환경 적응력이 좋다 — 계절 변화에 맞춰 생활 리듬만 조정하면 된다."),
            f"필요한 조후 오행은 **{', '.join(johu_els)}**. 직업 환경·색·활동·사람으로 이 기운을 가까이 두는 것이 '현대식 조후'다.",
            ("조후 글자가 원국에 있다 — 스스로 온도를 맞출 줄 아는 사람이다." if sat_word == "충족(充足)" else
             "조후 글자가 부족하다 — 그 기운이 들어오는 대운에 컨디션과 일이 함께 풀리는 경향이 있다."),
            ("열을 식혀 주는 물 기운" if temp > 0 else "몸을 데워 주는 불 기운") + "이 들어오는 대운: " + (", ".join(f"{p.start_age}세({p.pillar.hanja})" for p in warm_dw[:6]) or "뚜렷하지 않음") + ".",
        ],
        "basis": [f"{season}생 {BRANCHES[mb]}월", temp_word.split(' — ')[0], f"조후 {''.join(keys)}", sat_word],
    }

    # ============================================================ 입체 종합 — 그릇·온도·균형
    yong_ab = a.yongshin
    sang_groups = {GROUP.get(x, x) for x in sang}
    yong_gk = sorted({ELEMENTS[grp_el(g)] for g in sang_groups if g in ("비겁", "식상", "재성", "관성", "인성")}, key=ELEMENTS.index)
    agree = [e for e in johu_els if e == yong_ab or e in yong_gk]
    # 온도를 직접 바로잡는 글자: 더우면 수(壬癸), 추우면 화(丙丁). 계절 처방은 기본 용신(억부)을 덮어쓰지 않는다.
    want = "수" if temp >= 15 else "화" if temp <= -15 else None
    fix = next((k for k in keys if want and ELEMENTS[STEM_ELEMENT[STEMS.index(k)]] == want), None)
    season_rx = want if fix else None
    final = yong_ab
    role = {a.yongshin: "용신", a.huishin: "희신", a.gishin: "기신", a.gushin: "구신", a.hanshin: "한신"}
    if season_rx is None:
        final_why = (f"온도 치우침(지수 {temp:+})이 크지 않아 기본 용신 {jo(yong_ab, '을를')} 그대로 쓴다. "
                     f"조후 글자({''.join(keys)})는 생활 리듬을 다듬는 보조로 참고한다.")
    elif season_rx == yong_ab:
        final_why = f"기본 용신(억부)과 계절 처방(조후)이 모두 {jo(yong_ab, '을를')} 가리킨다 — 확신도가 높다."
    else:
        final_why = (f"기본 보약은 **{yong_ab}**(몸의 균형), 계절 처방은 **{season_rx}**(온도 조절, {fix})다. "
                     f"일상 개운은 {jo(yong_ab, '을를')} 중심으로 하고, "
                     + ("여름·더운 환경에서는" if season_rx == "수" else "겨울·추운 환경에서는")
                     + f" {season_rx} 기운을 더하라냥.")
        if role.get(season_rx) in ("기신", "구신"):
            final_why += (f" 다만 억부로 보면 {jo(season_rx, '은는')} 부담 쪽({role[season_rx]})이라, "
                          "많이가 아니라 '온도를 맞출 만큼만' 쓰는 게 요령이다 — 두 책이 서로 견제하는 지점이다.")
    if yong_gk:
        final_why += f" 격국(자평진전)의 상신 오행은 {', '.join(yong_gk)}" + (" — 일치하는 부분이 있다." if final in yong_gk else " — 사회적 성공은 이 오행으로, 몸과 마음의 균형은 위 용신으로 잡는다.")
    # 대운·세운 3렌즈 표
    def lens_luck(p: Pillar, sg: str, bg: str) -> dict:
        se_, be_ = ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]
        bal = [el_tag(se_), el_tag(be_)]
        bal_s = (2 if "용신" in bal else 0) + (1 if "희신" in bal else 0) - (2 if "기신" in bal else 0) - (1 if "구신" in bal else 0)
        els = {se_, be_}
        if "수" in els and temp > 0:
            th = "식혀 줌"
        elif "화" in els and temp < 0:
            th = "데워 줌"
        elif els & set(johu_els):
            th = "조후 보조"
        elif temp >= 8 and "화" in els:
            th = "열 가중"
        elif temp <= -8 and "수" in els:
            th = "냉기 가중"
        else:
            th = "변화 적음"
        return {"그릇": luck_on_gyeok(sg, bg), "온도": th, "균형": f"{se_}({bal[0]})·{be_}({bal[1]})",
                "균형점수": bal_s, "작용": [str(x) for x in find_relations(c.pillars, [p])][:4]}
    dw_rows = []
    for d in r.daewoon:
        row = {"나이": d.start_age, "시작": d.start_year, "간지": d.pillar.hanja, "한글": d.pillar.hangul,
               "십신": f"{d.stem_god}/{d.branch_god}", "현재": bool(d.current)}
        row.update(lens_luck(Pillar(d.pillar.index, "대운"), d.stem_god, d.branch_god))
        dw_rows.append(row)
    yp = Pillar(year_index(target), "세운")
    ysg, ybg = ten_god(ds, yp.stem), ten_god(ds, branch_main_stem(yp.branch))
    year_row = {"연도": target, "간지": yp.hanja, "십신": f"{ysg}/{ybg}", **lens_luck(yp, ysg, ybg)}
    cur_row = next((x for x in dw_rows if x["현재"]), None)

    def axis(score: float) -> str:
        return "★★★" if score >= 2 else "★★☆" if score >= 1 else "★☆☆"
    vessel_score = 2 if (seong and not pae) else 1 if seong or gu else 0
    temp_score = 2 if sat_word == "충족(充足)" or abs(temp) < 8 else 1 if sat_word == "부분 충족" else 0
    bal_score = 2 if 45 < a.strength_score < 55 or "청" in cheong and "탁" not in cheong else 1 if 32 < a.strength_score < 68 else 0
    synth = {
        "세축": [
            {"축": "그릇(器)", "책": "자평진전", "평가": axis(vessel_score), "요지": f"{g_name} · {verdict_short}" + (f" · 상신 {', '.join(dict.fromkeys(sang))}" if sang else "")},
            {"축": "온도(溫)", "책": "궁통보감", "평가": axis(temp_score), "요지": f"{season}생 · {temp_word.split(' — ')[0]} · 조후 {''.join(keys)} {sat_word}"},
            {"축": "균형(衡)", "책": "적천수", "평가": axis(bal_score), "요지": f"{a.strength} {a.strength_score}% · {cheong} · 억부 용신 {a.yongshin}"},
        ],
        "용신비교": [
            {"관점": "억부(抑扶) — 적천수", "오행": a.yongshin, "뜻": "몸의 균형을 잡는 보약"},
            {"관점": "조후(調候) — 궁통보감", "오행": (season_rx + f" ({fix})") if season_rx else ", ".join(johu_els) + " (보조)", "뜻": "계절 온도를 맞추는 처방"},
            {"관점": "격국 상신(相神) — 자평진전", "오행": ", ".join(yong_gk) or "운에서 옴", "뜻": "사회적 그릇을 받치는 기둥"},
        ],
        "최종용신": final, "계절처방": season_rx, "최종근거": final_why,
        "입체해석": [
            f"**그릇**: 이 사람은 《자평진전》으로 보면 **{g_name}**의 그릇이다. {info[2].split(' — ')[0]}. {verdict}.",
            f"**온도**: 《궁통보감》으로 보면 {season}에 태어난 {dmh}으로 **{temp_word}**의 사주다. {_plain(JOHU_WHY['목화토금수'[de]][season])}. 조후는 {sat_word}.",
            f"**균형**: 《적천수》로 보면 일간은 **{a.strength}**이고 기세는 {top_el} 쪽으로 쏠렸으며 {cheong}이다. 균형의 열쇠는 {a.yongshin}.",
            f"**세 렌즈를 겹치면**: 그릇({g_name})은 사회에서 무엇으로 쓰일지를, 온도({temp_word.split(' — ')[0]})는 그 그릇이 굳거나 갈라지지 않게 할 조건을, 균형({a.strength})은 얼마나 오래 버틸지를 알려 준다. "
            f"최종적으로 가장 먼저 챙길 기운은 **{final}({EH[final]})**이다.",
            f"**뼈대와 백과사전**: 《연해자평》의 궁위로는 월주({ps['월주'].hanja})가 사회 무대, 일주({ps['일주'].hanja})가 나와 배우자다. "
            f"《삼명통회》의 신살({', '.join(sins) or '없음'})은 위 세 판단을 꾸며 주는 보조 색깔로만 쓴다.",
        ],
        "대운": dw_rows, "현재대운": cur_row, "세운": year_row,
        "운해석": _luck_story(cur_row, year_row, final, g_name),
    }
    for L in (lens1, lens2, lens3, lens4, lens5):
        L.pop("_luck", None)
    return {
        "intro": [
            "명리학의 흐름을 관통하는 다섯 고전(五古)은 같은 사주를 서로 다른 렌즈로 본다냥.",
            "《연해자평》은 뼈대(일간 중심 구조), 《삼명통회》는 백과사전(납음·신살), 《적천수》는 기세(힘의 흐름과 균형), 《자평진전》은 격국(사회적 그릇), 《궁통보감》은 계절(온도와 습도)이다냥.",
            "하나만 고집하지 않고 **《자평진전》으로 그릇을 보고, 《궁통보감》으로 온도를 맞추고, 《적천수》로 균형을 잡아** 입체적으로 읽는 게 냥이의 방식이다냥. 각 렌즈마다 '고전의 원래 해석'과 '현대적 풀이'를 나란히 보여 줄게.",
        ],
        "lenses": [lens1, lens2, lens3, lens4, lens5],
        "synth": synth,
        "note": "고전 원문은 널리 알려진 구절만 인용했고, 나머지는 요지로 풀었습니다. 조후 글자·신살 표·지장간 일수는 주석본과 학파마다 조금씩 다릅니다.",
    }


def _luck_story(cur: dict | None, year: dict, final: str, g_name: str) -> list[str]:
    out = []
    if cur:
        out.append(f"**지금의 대운 {cur['나이']}세 {cur['간지']}({cur['한글']})** — 그릇: {cur['그릇']} / 온도: {cur['온도']} / 균형: {cur['균형']}. "
                   + ("10년 전체가 순풍에 가깝다." if cur["균형점수"] >= 2 else "부담 기운이 섞여 속도 조절이 필요한 10년이다." if cur["균형점수"] < 0 else "무난한 흐름 속에 해마다의 세운이 성패를 가른다."))
        if cur["작용"]:
            out.append("대운이 원국과 만드는 작용: " + " / ".join(cur["작용"]))
    out.append(f"**{year['연도']}년 세운 {year['간지']}** ({year['십신']}) — 그릇: {year['그릇']} / 온도: {year['온도']} / 균형: {year['균형']}."
               + (f" 원국과의 작용: {' / '.join(year['작용'])}" if year["작용"] else ""))
    out.append(f"정리: 대운은 10년의 계절, 세운은 그해의 날씨다. {g_name}의 그릇을 돕는 해에는 일을 벌이고, 흔드는 해에는 지키며, 언제나 {final} 기운으로 균형을 잡아라냥.")
    return out
