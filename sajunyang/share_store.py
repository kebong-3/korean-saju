"""관계 지도 공유 저장소 — Upstash Redis REST(표준 라이브러리 urllib만 사용).

Vercel → Storage → Upstash(Redis) 를 프로젝트에 연결하면 아래 환경변수가 자동으로 생긴다.
  KV_REST_API_URL / KV_REST_API_TOKEN   (또는 UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN)
연결 전에는 configured()가 False — 앱은 '내 폰에만 저장' 모드로 동작한다.

저장 원칙(개인정보 최소화)
- 지도 주인: 지도를 다시 계산하려고 생년월일을 저장한다(주인이 동의, 언제든 삭제 가능).
- 친구: 생년월일은 저장하지 않는다. 계산이 끝난 관계 결과(별명·유형·점수)만 저장한다.
- 비밀 토큰은 해시로만 저장한다. 지도는 마지막 활동 후 400일이 지나면 자동 삭제.
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import urllib.request

TTL = 400 * 24 * 3600
MAX_MEMBERS = 60


def _env() -> tuple[str, str] | None:
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    tok = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    return (url.rstrip("/"), tok) if url and tok else None


def configured() -> bool:
    return _env() is not None


class StoreError(Exception):
    pass


def _pipe(cmds: list[list]) -> list:
    env = _env()
    if not env:
        raise StoreError("공유 저장소가 아직 연결되지 않았다냥")
    url, tok = env
    req = urllib.request.Request(url + "/pipeline", data=json.dumps(cmds).encode(),
                                 headers={"Authorization": f"Bearer {tok}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=8) as r:
            out = json.loads(r.read())
    except Exception as e:  # noqa: BLE001
        raise StoreError("공유 저장소에 연결하지 못했다냥. 잠시 후 다시 시도해 줘") from e
    res = []
    for item in out:
        if isinstance(item, dict) and item.get("error"):
            raise StoreError("공유 저장소 오류가 났다냥")
        res.append(item.get("result") if isinstance(item, dict) else item)
    return res


def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_id() -> str:
    return secrets.token_urlsafe(6).replace("-", "a").replace("_", "b")


def create_map(owner: dict) -> tuple[str, str]:
    mid, token = new_id(), secrets.token_urlsafe(18)
    rec = {"owner": owner, "token": _h(token)}
    _pipe([["SET", f"map:{mid}", json.dumps(rec, ensure_ascii=False), "EX", TTL]])
    return mid, token


def load(mid: str) -> tuple[dict | None, dict]:
    rec, members = _pipe([["GET", f"map:{mid}"], ["HGETALL", f"map:{mid}:m"]])
    if not rec:
        return None, {}
    flat = members or []
    ms = {flat[i]: json.loads(flat[i + 1]) for i in range(0, len(flat), 2)}
    return json.loads(rec), ms


def add_member(mid: str, view: dict) -> tuple[str, str]:
    rec, ms = load(mid)
    if rec is None:
        raise StoreError("지도를 찾을 수 없다냥 (지워졌거나 기간이 지났어)")
    if len(ms) >= MAX_MEMBERS:
        raise StoreError(f"이 지도는 {MAX_MEMBERS}명이 꽉 찼다냥")
    pid, token = new_id(), secrets.token_urlsafe(12)
    entry = {"view": view, "token": _h(token)}
    _pipe([["HSET", f"map:{mid}:m", pid, json.dumps(entry, ensure_ascii=False)],
           ["EXPIRE", f"map:{mid}", TTL], ["EXPIRE", f"map:{mid}:m", TTL]])
    return pid, token


def owner_ok(rec: dict, token: str) -> bool:
    return bool(token) and secrets.compare_digest(rec.get("token", ""), _h(token))


def remove_member(mid: str, pid: str, token: str) -> bool:
    rec, ms = load(mid)
    if rec is None or pid not in ms:
        return False
    if not (owner_ok(rec, token) or (token and secrets.compare_digest(ms[pid].get("token", ""), _h(token)))):
        raise StoreError("지울 권한이 없다냥")
    _pipe([["HDEL", f"map:{mid}:m", pid]])
    return True


def delete_map(mid: str, token: str) -> bool:
    rec, _ = load(mid)
    if rec is None:
        return False
    if not owner_ok(rec, token):
        raise StoreError("지울 권한이 없다냥")
    _pipe([["DEL", f"map:{mid}", f"map:{mid}:m"]])
    return True
