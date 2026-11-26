"""검색으로 들어오는 사람을 위한 안내 페이지(서버에서 완성된 HTML).

앱은 한 페이지짜리라 검색 로봇이 읽을 글이 거의 없다. 사람들이 실제로 찾는 말
— '무료 만세력', '도화살 뜻', '을사일주 성격', '2027 정미년 운세', '24절기' — 에 답하는 페이지를
사주냥이 말투로 만들고, 끝에서 '내 사주로 보기'로 앱에 이어 준다.
"""
from __future__ import annotations

import html
import json
from datetime import datetime, timedelta, timezone
from urllib.parse import quote

from ksaju import sinsal as SS
from ksaju.core import (BRANCHES, BRANCHES_KO, STEMS, STEMS_KO, branch_main_stem, sexagenary_index, term_instants,
                        ten_god, twelve_stage)
from ksaju.texts import DAY_MASTER, STAGE_TEXT, TEN_GOD_TEXT

from . import ilju, season, sinsal_story

SITE = "https://korean-saju-six.vercel.app"
E = html.escape


def _page(path: str, title: str, desc: str, body: str, crumbs: list[tuple[str, str]] | None = None) -> str:
    crumbs = crumbs or []
    ld = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": i + 1, "name": n, "item": SITE + u} for i, (n, u) in enumerate([("사주냥이", "/"), ("명리 안내", "/guide")] + crumbs)]}
    nav = " › ".join(f'<a href="{u}">{E(n)}</a>' for n, u in [("사주냥이", "/"), ("명리 안내", "/guide")] + crumbs[:-1])
    return f"""<!doctype html><html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>{E(title)} | 사주냥이</title><meta name="description" content="{E(desc)}">
<link rel="canonical" href="{SITE}{path}"><meta name="theme-color" content="#fff4f1">
<meta property="og:type" content="article"><meta property="og:site_name" content="사주냥이">
<meta property="og:title" content="{E(title)}"><meta property="og:description" content="{E(desc)}">
<meta property="og:url" content="{SITE}{path}"><meta property="og:image" content="{SITE}/og.png">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/nyang.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Jua&family=Gowun+Dodum&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/style.css?v=25">
<script type="application/ld+json">{json.dumps(ld, ensure_ascii=False)}</script>
<style>.doc{{max-width:720px;margin:0 auto;padding:18px 16px 60px}}.doc h1{{font-size:26px;margin:6px 0 6px}}.doc h2{{font-size:20px;margin:22px 0 8px}}
.doc p,.doc li{{font-size:16px;line-height:1.8}}.crumb{{font-size:13px;color:var(--sub)}}.crumb a{{color:var(--sub)}}
.gl{{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:8px;padding:0;list-style:none}}
.gl a{{display:block;background:#fff;border-radius:16px;padding:10px 12px;text-decoration:none;color:var(--ink);box-shadow:var(--shadow)}}
.gl small{{display:block;color:var(--sub);font-size:13px}}.cta{{display:block;text-align:center;text-decoration:none;margin:22px 0}}
dl.kv{{display:grid;grid-template-columns:auto 1fr;gap:6px 12px}}dl.kv dt{{font-family:var(--title);color:var(--lav-d)}}dl.kv dd{{margin:0}}</style>
</head><body><main class="doc"><p class="crumb">{nav}</p>{body}
<a class="btn primary cta" href="/?from=guide">🐾 생일 넣고 내 사주로 보기 (무료)</a>
<p class="crumb">더 읽기: <a href="/manse">무료 만세력 보는 법</a> · <a href="/sinsal">신살 사전</a> · <a href="/ilju">60일주 성격</a> ·
<a href="/2027">2027 정미년 운세</a> · <a href="/jeolgi">24절기 달력</a></p>
<p class="foot">사주는 정답지가 아니라 지도다냥. · <a href="/privacy.html">개인정보 처리방침</a></p></main></body></html>"""


def guide() -> str:
    items = [("/manse", "무료 만세력", "천문 계산으로 뽑는 사주팔자, 읽는 법"), ("/sinsal", "신살 사전", "도화살·역마살·천을귀인 등 32가지 뜻"),
             ("/ilju", "60일주 성격", "을사일주·계유일주… 내 일주 냥이는?"), ("/2027", "2027 정미년 운세", "일간별로 보는 내년 흐름"),
             ("/jeolgi", "24절기 달력", "올해 절기 날짜와 냥이의 절기 일기")]
    body = "<h1>사주냥이 명리 안내</h1><p>2천 년 동안 사주를 봐 온 냥이가 어려운 명리 말을 쉽게 풀어 둔 곳이다냥.</p><ul class=\"gl\">" + \
        "".join(f'<li><a href="{u}"><b>{E(t)}</b><small>{E(s)}</small></a></li>' for u, t, s in items) + "</ul>"
    return _page("/guide", "명리 안내 — 만세력·신살·일주·절기", "만세력 보는 법, 신살 뜻, 60일주 성격, 2027 정미년 운세, 24절기를 사주냥이가 쉽게 풀어 줍니다.", body)


def manse() -> str:
    body = """<h1>무료 만세력 — 사주팔자 여덟 글자 뽑는 법</h1>
<p>만세력은 태어난 해·달·날·시를 <b>간지(干支)</b> 여덟 글자로 바꿔 주는 달력이다냥. 사주냥이는 외워 둔 표가 아니라 <b>태양의 위치를 천문 계산</b>해서 뽑는다냥.</p>
<h2>정확하게 뽑으려면 확인할 네 가지</h2><ul>
<li><b>절기 시각</b> — 달이 바뀌는 기준은 음력 1일이 아니라 입춘·경칩 같은 절기다냥. 절기 바로 앞뒤에 태어났으면 분 단위가 중요하다냥.</li>
<li><b>태어난 곳(지방시)</b> — 한국 표준시는 동경 135도 기준이라, 서울은 실제 해시계보다 약 30분 빠르다냥. 태어난 곳 경도로 보정한다냥.</li>
<li><b>서머타임</b> — 1948~1960년, 1987~1988년 등 서머타임 기간에 태어났으면 1시간을 빼서 본다냥.</li>
<li><b>야자시</b> — 밤 11~12시 출생은 다음 날로 볼지(기본), 그날로 볼지(야자시) 학파마다 다르다냥.</li></ul>
<h2>만세력 표 읽는 5단계</h2><ol>
<li>오른쪽부터 연주·월주·일주·시주 — 태어난 해·달·날·시다냥.</li>
<li>일주의 윗글자가 나 자신, '일간'이다냥.</li>
<li>윗줄 천간은 겉모습, 아랫줄 지지는 속마음과 생활 무대다냥.</li>
<li>색은 오행 — 목(초록)·화(빨강)·토(노랑)·금(회색)·수(파랑).</li>
<li>십성은 나와 그 글자의 관계, 12운성은 그 자리 기운의 세기, 12신살은 그 자리의 분위기다냥.</li></ol>
<h2>사주냥이 만세력에서 볼 수 있는 것</h2>
<p>원국 표(십성·지장간·12운성·12신살), 궁성, 합·충·형·파·해·원진·귀문, 용신, 대운·연운·월운, <a href="/sinsal">신살과 길성 32종</a>까지 — 모든 칸을 누르면 냥이가 설명해 준다냥.</p>"""
    return _page("/manse", "무료 만세력 — 천문 계산으로 보는 사주팔자", "태어난 곳·서머타임·야자시까지 보정하는 무료 만세력. 원국 표, 대운, 신살 32종을 누르면 냥이가 쉽게 설명해 줍니다.", body, [("무료 만세력", "/manse")])


def sinsal_index() -> str:
    info = sinsal_story.INFO
    groups = {"귀인": "도와주는 별", "길성": "복을 주는 별", "살": "양날의 칼", "특수": "성향 별"}
    body = "<h1>신살 사전 — 32가지 뜻과 쓰는 법</h1><p>신살은 사주의 '양념'이다냥. 겁낼 게 아니라 잘 쓰면 무기가 된다냥. 이름을 누르면 옛 해석과 요즘 해석, 쓰는 법이 나온다냥.</p>"
    for k, label in groups.items():
        names = [n for n, v in SS.CATALOG.items() if v[1] == k]
        body += f"<h2>{label}</h2><ul class=\"gl\">" + "".join(
            f'<li><a href="/sinsal/{quote(n)}"><b>{E(n)}</b> <span class="sub">{E(SS.CATALOG[n][0])}</span><small>{E(info[n]["한줄"])}</small></a></li>' for n in names) + "</ul>"
    return _page("/sinsal", "신살 사전 — 도화살·역마살·천을귀인 뜻", "도화살, 역마살, 화개살, 천을귀인, 문창귀인, 현침살, 귀문관살 등 신살 32가지의 뜻과 요즘 해석, 쓰는 법.", body, [("신살 사전", "/sinsal")])


def sinsal_page(name: str) -> str | None:
    if name not in SS.CATALOG:
        return None
    d = sinsal_story.detail(name)
    body = f"""<h1>{E(name)} <span class="sub">{E(d['한자'])}</span> 뜻</h1>
<p class="bubble">{E(d['한줄'])}</p>
<dl class="kv"><dt>종류</dt><dd>{E(d['종류뜻'])}</dd><dt>보는 기준</dt><dd>{E(d['기준'])}</dd></dl>
<h2>옛 해석</h2><p>{E(d['옛뜻'])}</p><h2>요즘 해석</h2><p>{E(d['요즘'])}</p>
<h2>강점과 조심할 점</h2><ul><li><b>강점</b> — {E(d['강점'])}</li><li><b>조심</b> — {E(d['조심'])}</li></ul>
<h2>이렇게 쓰라냥</h2><p>{E(d['쓰는법'])}</p>
<h2>대운·세운에서 {E(name)}이 들어오면</h2><p>{E(d['운'])} 준비: {E(d['준비'])}</p>
<p class="sub">내 사주에 {E(name)}이 어느 자리(연·월·일·시)에 있는지에 따라 뜻이 달라진다냥. 아래에서 생일을 넣으면 자리까지 짚어 준다냥.</p>"""
    return _page(f"/sinsal/{quote(name)}", f"{name} 뜻 — 옛 해석과 요즘 해석", f"{name}({d['한자']}): {d['한줄']} {d['요즘']}"[:150], body,
                 [("신살 사전", "/sinsal"), (name, f"/sinsal/{quote(name)}")])


def _ilju_list():
    for i in range(60):
        yield ilju.card(i % 10, i % 12)


def ilju_index() -> str:
    body = "<h1>60일주 성격 — 나는 무슨 냥이일까?</h1><p>일주는 태어난 날의 간지다냥. 윗글자는 나의 본체(자연물), 아랫글자는 그 위에 깔린 기운(띠 동물)이다냥.</p><ul class=\"gl\">" + \
        "".join(f'<li><a href="/ilju/{quote(c["한글"])}"><b>{E(c["한글"])}일주</b> <span class="sub">{E(c["일주"])}</span><small>{E(c["이름"])}</small></a></li>' for c in _ilju_list()) + "</ul>"
    return _page("/ilju", "60일주 성격 총정리 — 갑자일주부터 계해일주까지", "60일주별 성격과 키워드를 사주냥이의 '일주 냥이 카드'로 쉽게 정리했습니다.", body, [("60일주 성격", "/ilju")])


def ilju_page(ko: str) -> str | None:
    if len(ko) != 2 or ko[0] not in STEMS_KO or ko[1] not in BRANCHES_KO:
        return None
    s, b = STEMS_KO.index(ko[0]), BRANCHES_KO.index(ko[1])
    if s % 2 != b % 2:
        return None
    c = ilju.card(s, b)
    stem_name, stem_desc = DAY_MASTER[STEMS[s]]
    stage = twelve_stage(s, b)
    god = ten_god(s, branch_main_stem(b))
    pillar_names = []
    hj = STEMS[s] + BRANCHES[b]
    for name, table in (("괴강살", SS.GOEGANG), ("백호살", SS.BAEKHO), ("고란살", SS.GORAN), ("음양차착살", SS.EUMYANG), ("효신살", SS.HYOSIN)):
        if hj in table:
            pillar_names.append(name)
    body = f"""<h1>{E(ko)}일주 성격 <span class="sub">{E(hj)}</span></h1>
<p class="bubble"><b>{E(c['이름'])}</b> — {E(c['한줄'])}</p>
<p>키워드: {' · '.join('#' + E(k) for k in c['키워드'])}</p>
<h2>일간 {E(STEMS_KO[s])}{E(STEMS[s])} — {E(stem_name)}</h2><p>{E(stem_desc)}</p>
<h2>일지 {E(BRANCHES_KO[b])}{E(BRANCHES[b])} — {E(c['동물'])}의 자리</h2>
<p>일지는 나 자신의 속마음이자 배우자·가장 가까운 사람의 자리다냥. {E(ko)}일주의 일지는 일간에게 <b>{E(god)}</b>이다냥 — {E(TEN_GOD_TEXT[god])}</p>
<p>12운성은 <b>{E(stage)}</b> — {E(STAGE_TEXT[stage])}.</p>
{('<h2>일주에 붙는 신살</h2><ul>' + ''.join(f'<li><a href="/sinsal/{quote(n)}"><b>{E(n)}</b></a> — {E(sinsal_story.INFO[n]["한줄"])}</li>' for n in pillar_names) + '</ul>') if pillar_names else ''}
<p class="sub">같은 {E(ko)}일주라도 태어난 달과 시에 따라 성격의 결이 꽤 달라진다냥. 생일을 넣으면 내 사주 전체로 풀어 준다냥.</p>"""
    return _page(f"/ilju/{quote(ko)}", f"{ko}일주 성격 — {c['이름']}", f"{ko}일주({hj}) 성격: {c['한줄']} 키워드 {', '.join(c['키워드'])}."[:150], body,
                 [("60일주 성격", "/ilju"), (f"{ko}일주", f"/ilju/{quote(ko)}")])


def year2027() -> str:
    yi = sexagenary_index(3, 7)  # 丁未
    ys, yb = yi % 10, yi % 12
    rows = ""
    for s in range(10):
        g1, g2 = ten_god(s, ys), ten_god(s, branch_main_stem(yb))
        rows += (f"<h2>{STEMS_KO[s]}{STEMS[s]} 일간 — {E(DAY_MASTER[STEMS[s]][0])}</h2>"
                 f"<p>2027년 천간 丁은 <b>{g1}</b>, 지지 未는 <b>{g2}</b>으로 들어온다냥. {E(TEN_GOD_TEXT[g1])} 생활 바탕에는 {E(TEN_GOD_TEXT[g2])}</p>")
    body = f"""<h1>2027년 정미년(丁未年) 운세 — 일간별 흐름</h1>
<p>2027년은 <b>정미(丁未)년, 붉은 양의 해</b>다냥. 천간 丁은 촛불 같은 불(火), 지지 未는 늦여름의 흙(土)이다냥. 따뜻하고 섬세한 불이 마른 흙 위에서 오래 타는 해라, 꾸준히 데우는 일·돌보는 일이 빛나는 흐름이다냥.</p>
<p class="sub">새해의 기준은 1월 1일이 아니라 입춘(2027년 2월 4일 무렵)이다냥. 내 일간은 생일을 넣으면 바로 알 수 있다냥.</p>{rows}"""
    return _page("/2027", "2027 정미년 운세 — 일간별 흐름", "2027년 정미년(丁未年) 붉은 양의 해, 갑을병정무기경신임계 일간별로 들어오는 십성과 흐름을 사주냥이가 풀어 줍니다.", body, [("2027 정미년 운세", "/2027")])


def jeolgi() -> str:
    now = datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=9)
    rows = []
    for t, name, _ in sorted(term_instants(now.year)):
        if name in season.DIARY:
            emo, diary, tip = season.DIARY[name]
            kst = t + timedelta(hours=9)
            rows.append(f"<li><b>{emo} {name}</b> <span class=\"sub\">{kst.month}월 {kst.day}일 {kst:%H:%M}</span><br>{E(diary)}<br><small>개운: {E(tip)}</small></li>")
    body = f"""<h1>{now.year}년 24절기 날짜와 냥이의 절기 일기</h1>
<p>사주의 달은 음력 1일이 아니라 절기로 바뀐다냥. 그래서 만세력에서 절기 시각이 제일 중요하다냥. 시각은 태양 위치를 천문 계산한 한국 시간이다냥.</p>
<ul>{''.join(rows)}</ul>"""
    return _page("/jeolgi", f"{now.year}년 24절기 날짜·시각", f"{now.year}년 입춘부터 동지까지 24절기 날짜와 시각(한국 시간), 절기마다 냥이의 일기와 개운법.", body, [("24절기 달력", "/jeolgi")])


def urls() -> list[str]:
    out = ["/", "/guide", "/manse", "/sinsal", "/ilju", "/2027", "/jeolgi"]
    out += [f"/sinsal/{quote(n)}" for n in SS.CATALOG]
    out += [f"/ilju/{quote(c['한글'])}" for c in _ilju_list()]
    return out


def sitemap() -> str:
    day = (datetime.now(timezone.utc).replace(tzinfo=None) + timedelta(hours=9)).date().isoformat()
    return ('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "".join(f"<url><loc>{SITE}{u}</loc><lastmod>{day}</lastmod></url>\n" for u in urls()) + "</urlset>\n")


ROBOTS = f"User-agent: *\nAllow: /\nDisallow: /api/\nSitemap: {SITE}/sitemap.xml\n"
