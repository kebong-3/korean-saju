"""아침 운세 알림(웹 푸시).

개인정보 최소화: 생년월일은 받지 않는다. 구독할 때 브라우저가 보내는 건
- 푸시 주소(endpoint·keys) — 브라우저 회사(구글·애플·모질라 등)가 발급한 익명 주소
- 일간 천간(10개 중 하나)과 용신·희신 오행(5개 중 1~2개)
뿐이고, 이것만으로 '오늘 일진이 나에게 어떤 날인지' 한 줄을 만든다.

필요한 환경 변수: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY (+ 선택 VAPID_SUBJECT), 크론 보호용 CRON_SECRET
"""
from __future__ import annotations

import hashlib
import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta
from urllib.parse import urlparse

from ksaju.core import BRANCH_ELEMENT, ELEMENTS, STEM_ELEMENT, STEMS, Pillar, day_index, ten_god

from .fortune import DAY_TIP

INDEX = "push"
# 브라우저 푸시 서비스만 허용(임의 주소로 서버가 요청을 보내지 않게)
ALLOWED_HOSTS = ("fcm.googleapis.com", "updates.push.services.mozilla.com", "push.services.mozilla.com",
                 "web.push.apple.com", "notify.windows.com", "push.apple.com")


def public_key() -> str | None:
    pub, priv = os.environ.get("VAPID_PUBLIC_KEY"), os.environ.get("VAPID_PRIVATE_KEY")
    return pub.strip() if pub and priv else None


def endpoint_ok(url: str) -> bool:
    u = urlparse(url)
    h = (u.hostname or "").lower()
    return u.scheme == "https" and any(h == a or h.endswith("." + a) for a in ALLOWED_HOSTS)


def key_of(endpoint: str) -> str:
    return f"{INDEX}/" + hashlib.sha256(endpoint.encode()).hexdigest()[:32]


WEEKDAY = "월화수목금토일"


def _day_els(d: date) -> set[str]:
    p = Pillar(day_index(d), "일진")
    return {ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]}


def best_day(yong: list[str], start: date) -> date:
    """앞으로 7일 중 보약 기운(용신 2점·희신 1점)이 가장 많이 드는 날."""
    def score(d):
        els = _day_els(d)
        return sum((2 if i == 0 else 1) for i, e in enumerate(yong[:2]) if e in els)
    days = [start + timedelta(days=i) for i in range(7)]
    return max(days, key=lambda d: (score(d), -days.index(d)))


def message(ilgan: int, yong: list[str], d: date, kind: str = "morning") -> dict:
    tag = f"nyang-{kind}-{d.isoformat()}"
    if kind == "sunday":
        return {"title": "🪞 이번 주도 수고했다냥", "body": "이번 주 기분을 기록하고, 다음 주 힘 실을 날을 미리 보러 오라냥 →",
                "url": "/?from=push&now=week", "tag": tag}
    try:
        from . import season as _season
        s = _season.current(datetime(d.year, d.month, d.day, 12))
        if s["시작"] == d.isoformat():
            return {"title": f"{s['이모지']} 오늘부터 {s['이름']}이다냥", "body": f"{s['일기']} 이번 절기 개운: {s['개운']} →",
                    "url": "/?from=push&now=season", "tag": tag}
    except Exception:  # noqa: BLE001
        pass
    if d.weekday() == 0 and yong:
        b = best_day(yong, d)
        return {"title": "📅 이번 주 냥이 미리보기", "body": f"이번 주 힘 실을 날은 {WEEKDAY[b.weekday()]}요일({b.month}/{b.day})! 보약 기운이 드는 날이니 중요한 약속은 그날로 잡으라냥 →",
                "url": "/?from=push", "tag": tag}
    p = Pillar(day_index(d), "일진")
    sg = ten_god(ilgan, p.stem)
    els = {ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]}
    good = [e for e in yong if e in els]
    title = f"🐾 오늘은 {sg}의 날 · {p.hanja}일"
    body = DAY_TIP.get(sg, "오늘도 냥이가 기다린다냥.")
    if good:
        body = f"보약 기운({'·'.join(good)})이 드는 날! " + body
    return {"title": title, "body": body + " 오늘 운세 보러 오라냥 →", "url": "/?from=push", "tag": tag}


def send_all(store, today: date, kind: str = "morning") -> dict:
    """크론이 부른다. 만료된 구독(404·410)은 지운다."""
    from pywebpush import WebPushException, webpush

    priv = os.environ["VAPID_PRIVATE_KEY"].strip()
    claims = {"sub": os.environ.get("VAPID_SUBJECT", "https://korean-saju-six.vercel.app")}
    subs = store.list_docs(INDEX)

    def one(item):
        key, rec = item
        last = "last" if kind == "morning" else f"last_{kind}"
        if rec.get(last) == today.isoformat():
            return "skip"
        try:
            webpush(subscription_info=rec["sub"], data=json.dumps(message(rec["ilgan"], rec.get("yong", []), today, kind), ensure_ascii=False),
                    vapid_private_key=priv, vapid_claims=dict(claims), ttl=6 * 3600, timeout=8)
            rec[last] = today.isoformat()
            store.put_doc(key, rec, index=INDEX)
            return "sent"
        except WebPushException as e:
            code = getattr(e.response, "status_code", None)
            if code in (404, 410):
                store.del_doc(key, index=INDEX)
                return "gone"
            return "fail"
        except Exception:  # noqa: BLE001
            return "fail"

    with ThreadPoolExecutor(max_workers=16) as ex:
        res = list(ex.map(one, subs))
    return {k: res.count(k) for k in ("sent", "skip", "gone", "fail")} | {"total": len(subs)}
