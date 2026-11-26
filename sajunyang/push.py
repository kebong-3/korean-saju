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
from datetime import date
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


def message(ilgan: int, yong: list[str], d: date) -> dict:
    p = Pillar(day_index(d), "일진")
    sg = ten_god(ilgan, p.stem)
    els = {ELEMENTS[STEM_ELEMENT[p.stem]], ELEMENTS[BRANCH_ELEMENT[p.branch]]}
    good = [e for e in yong if e in els]
    title = f"🐾 오늘은 {sg}의 날 · {p.hanja}일"
    body = DAY_TIP.get(sg, "오늘도 냥이가 기다린다냥.")
    if good:
        body = f"보약 기운({'·'.join(good)})이 드는 날! " + body
    return {"title": title, "body": body + " 오늘 운세 보러 오라냥 →", "url": "/?from=push", "tag": f"nyang-{d.isoformat()}"}


def send_all(store, today: date) -> dict:
    """크론이 부른다. 만료된 구독(404·410)은 지운다."""
    from pywebpush import WebPushException, webpush

    priv = os.environ["VAPID_PRIVATE_KEY"].strip()
    claims = {"sub": os.environ.get("VAPID_SUBJECT", "https://korean-saju-six.vercel.app")}
    subs = store.list_docs(INDEX)

    def one(item):
        key, rec = item
        if rec.get("last") == today.isoformat():
            return "skip"
        try:
            webpush(subscription_info=rec["sub"], data=json.dumps(message(rec["ilgan"], rec.get("yong", []), today), ensure_ascii=False),
                    vapid_private_key=priv, vapid_claims=dict(claims), ttl=6 * 3600, timeout=8)
            rec["last"] = today.isoformat()
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
