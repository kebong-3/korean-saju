"""서비스 보호: 사용량 제한 · 보안 헤더 · 다른 사이트에서 온 요청 막기.

- 사용량 제한: AI 상담·대풀이처럼 비용이 드는 기능과 저장소에 쓰는 기능을 접속 주소(IP)마다 제한한다.
  Redis(Upstash/KV)가 연결돼 있으면 모든 서버가 같은 숫자를 보고, 없으면 서버마다 메모리로 센다
  (Vercel은 같은 서버를 여러 요청에 재사용하므로 메모리만으로도 연타·자동 호출은 대부분 걸러진다).
- IP는 비교용으로만 쓰고 저장할 때는 해시로 바꾼다(원래 주소를 남기지 않음).
"""
from __future__ import annotations

import hashlib
import os
import threading
import time
from collections import OrderedDict
from urllib.parse import urlparse

# 이름: [(횟수, 초), ...] — 모든 창을 넘지 않아야 통과
LIMITS: dict[str, list[tuple[int, int]]] = {
    # 통신사 공유 IP(여러 사람이 한 주소)를 감안해 '1분 연타'는 빡빡하게, 하루 한도는 넉넉하게
    "ai": [(10, 60), (60, 3600), (300, 86400)],        # AI 상담 한 마디
    "reading": [(6, 60), (40, 3600), (150, 86400)],     # 냥이 도사 대풀이(긴 글)
    "write": [(10, 60), (60, 3600), (300, 86400)],      # 지도 만들기·참여·편지·백업·알림 등록
    "read": [(60, 60), (600, 3600)],                    # 지도·백업 조회(주소 맞히기 막기)
    "calc": [(90, 60), (1500, 3600)],                   # 사주 계산(무료지만 자동 긁기 막기)
}
# 배포(Vercel)에서만 켠다. 로컬 개발·테스트는 RATE_LIMIT=on 일 때만.
ENABLED = bool(os.environ.get("VERCEL")) or os.environ.get("RATE_LIMIT") == "on"
MSG = "냥이가 숨 고르는 중이다냥. 조금 있다가 다시 해 줘! 🐾"
SALT = os.environ.get("RATE_SALT", "nyang")


def client_ip(headers, fallback: str = "") -> str:
    """Vercel이 넣어 주는 헤더를 우선 쓴다(사용자가 바꿀 수 없음)."""
    for h in ("x-vercel-forwarded-for", "x-real-ip", "x-forwarded-for"):
        v = headers.get(h)
        if v:
            return v.split(",")[0].strip()
    return fallback or "?"


def _key(ip: str) -> str:
    return hashlib.sha256(f"{SALT}:{ip}".encode()).hexdigest()[:20]


class _Memory:
    """창 하나마다 (시작 시각, 횟수). 오래된 항목은 크기 한도에서 밀려난다."""

    def __init__(self, cap: int = 20000):
        self.d: OrderedDict[str, list] = OrderedDict()
        self.cap, self.lock = cap, threading.Lock()

    def hit(self, k: str, window: int, now: float) -> int:
        with self.lock:
            e = self.d.get(k)
            if not e or now - e[0] >= window:
                e = [now, 0]
            e[1] += 1
            self.d[k] = e
            self.d.move_to_end(k)
            while len(self.d) > self.cap:
                self.d.popitem(last=False)
            return e[1]


MEM = _Memory()


def _redis_hits(keys: list[tuple[str, int]]) -> list[int] | None:
    try:
        from . import share_store
        if share_store.backend() != "redis":
            return None
        cmds = []
        for k, w in keys:
            cmds += [["INCR", k], ["EXPIRE", k, str(w), "NX"]]
        res = share_store._pipe(cmds)
        return [int(res[i * 2]) for i in range(len(keys))]
    except Exception:  # noqa: BLE001 — 저장소가 느리거나 죽어도 서비스는 계속
        return None


def check(name: str, ip: str, now: float | None = None) -> int | None:
    """통과면 None, 막히면 다시 시도할 때까지 남은 초."""
    rules = LIMITS.get(name)
    if not ENABLED or not rules:
        return None
    now = time.time() if now is None else now
    who = _key(ip)
    keys = [(f"rl:{name}:{w}:{who}:{int(now // w)}", w) for _, w in rules]
    counts = _redis_hits(keys)
    if counts is None:
        counts = [MEM.hit(f"{name}:{w}:{who}", w, now) for _, w in rules]
    for (limit, w), c in zip(rules, counts):
        if c > limit:
            return max(1, int(w - now % w)) if w <= 3600 else 3600
    return None


# ---------------------------------------------------------------- 보안 헤더(정적 파일은 vercel.json, 서버 응답은 미들웨어가 같은 값을 붙인다)
CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com data:",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "worker-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
])
HEADERS = {
    "Content-Security-Policy": CSP,
    "Strict-Transport-Security": "max-age=63072000; includeSubDomains",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",
    "Cross-Origin-Opener-Policy": "same-origin",
}


def same_origin(origin: str | None, host: str | None) -> bool:
    """브라우저가 보낸 Origin이 이 사이트(또는 로컬 개발)일 때만 쓰기 요청을 받는다. Origin이 없으면(앱 밖 호출) 통과."""
    if not origin:
        return True
    if origin == "null":
        return False
    h = (urlparse(origin).netloc or "").lower()
    return h == (host or "").lower() or h.split(":")[0] in ("localhost", "127.0.0.1")
