"""관계 지도 공유 저장소 — Vercel Blob(권장) 또는 Upstash Redis.

연결 방법(둘 중 하나)
- Vercel Blob: Vercel → Storage → Blob → Create Blob Store(Private) → 프로젝트에 연결
  → BLOB_READ_WRITE_TOKEN(또는 BLOB_STORE_ID + OIDC)이 자동으로 생긴다.
- Upstash Redis: Integrations → Upstash → 프로젝트 연결 → KV_REST_API_URL / KV_REST_API_TOKEN
연결 전에는 configured()가 False — 앱은 '내 폰에만 저장' 모드로 동작한다.

저장 원칙(개인정보 최소화)
- 지도 주인: 지도를 다시 계산하려고 생년월일을 저장한다(주인이 동의, 언제든 삭제 가능).
- 친구: 생년월일은 저장하지 않는다. 계산이 끝난 관계 결과(별명·유형·점수)만 저장한다.
- 비밀 토큰은 해시로만 저장한다.

Blob 구조: maps/<지도id>/owner.json, maps/<지도id>/m/<멤버id>.json (멤버마다 파일 하나 → 동시 참여해도 덮어쓰지 않음)
"""
from __future__ import annotations

import hashlib
import json
import os
import secrets
import urllib.request
from concurrent.futures import ThreadPoolExecutor

TTL = 400 * 24 * 3600
MAX_MEMBERS = 60


class StoreError(Exception):
    pass


def _redis_env() -> tuple[str, str] | None:
    url = os.environ.get("KV_REST_API_URL") or os.environ.get("UPSTASH_REDIS_REST_URL")
    tok = os.environ.get("KV_REST_API_TOKEN") or os.environ.get("UPSTASH_REDIS_REST_TOKEN")
    return (url.rstrip("/"), tok) if url and tok else None


def _blob_env() -> bool:
    return bool(os.environ.get("BLOB_READ_WRITE_TOKEN") or os.environ.get("BLOB_STORE_ID"))


def backend() -> str | None:
    if _redis_env():
        return "redis"
    if _blob_env():
        return "blob"
    return None


def configured() -> bool:
    return backend() is not None


def _h(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_id() -> str:
    return secrets.token_urlsafe(6).replace("-", "a").replace("_", "b")


def owner_ok(rec: dict, token: str) -> bool:
    return bool(token) and secrets.compare_digest(rec.get("token", ""), _h(token))


# ------------------------------------------------------------------ Redis
def _pipe(cmds: list[list]) -> list:
    env = _redis_env()
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


# ------------------------------------------------------------------ Vercel Blob
ACCESS = os.environ.get("BLOB_ACCESS", "private")


def _blob():
    try:
        from vercel.blob import sync as vb
        return vb
    except Exception as e:  # noqa: BLE001
        raise StoreError("Blob 저장소 라이브러리를 불러오지 못했다냥") from e


def _bput(path: str, obj: dict) -> None:
    vb = _blob()
    try:
        vb.put_blob(path, json.dumps(obj, ensure_ascii=False).encode(), access=ACCESS,
                    content_type="application/json", allow_overwrite=True, cache_control_max_age=60)
    except Exception as e:  # noqa: BLE001
        raise StoreError("공유 저장소에 저장하지 못했다냥. 잠시 후 다시 시도해 줘") from e


def _bget(path: str) -> dict | None:
    vb = _blob()
    import vercel.blob as vbe
    try:
        return json.loads(vb.get_blob(path, access=ACCESS).body)
    except vbe.BlobNotFoundError:
        return None
    except Exception as e:  # noqa: BLE001
        raise StoreError("공유 저장소를 읽지 못했다냥. 잠시 후 다시 시도해 줘") from e


def _blist(prefix: str) -> list[str]:
    vb = _blob()
    try:
        return [it.pathname for it in vb.query_blobs(prefix=prefix)]
    except Exception as e:  # noqa: BLE001
        raise StoreError("공유 저장소 목록을 읽지 못했다냥") from e


def _bdel(paths: list[str]) -> None:
    if not paths:
        return
    vb = _blob()
    try:
        vb.delete_blob(paths if len(paths) > 1 else paths[0])
    except Exception as e:  # noqa: BLE001
        raise StoreError("공유 저장소에서 지우지 못했다냥") from e


def _members_blob(mid: str) -> dict:
    paths = _blist(f"maps/{mid}/m/")
    with ThreadPoolExecutor(max_workers=12) as ex:
        data = list(ex.map(_bget, paths))
    return {p.rsplit("/", 1)[-1].removesuffix(".json"): d for p, d in zip(paths, data) if d}


# ------------------------------------------------------------------ 공통 API
def create_map(owner: dict) -> tuple[str, str]:
    mid, token = new_id(), secrets.token_urlsafe(18)
    rec = {"owner": owner, "token": _h(token)}
    if backend() == "redis":
        _pipe([["SET", f"map:{mid}", json.dumps(rec, ensure_ascii=False), "EX", TTL]])
    elif backend() == "blob":
        _bput(f"maps/{mid}/owner.json", rec)
    else:
        raise StoreError("공유 저장소가 아직 연결되지 않았다냥")
    return mid, token


def load(mid: str) -> tuple[dict | None, dict]:
    if backend() == "redis":
        rec, members = _pipe([["GET", f"map:{mid}"], ["HGETALL", f"map:{mid}:m"]])
        if not rec:
            return None, {}
        flat = members or []
        return json.loads(rec), {flat[i]: json.loads(flat[i + 1]) for i in range(0, len(flat), 2)}
    if backend() == "blob":
        rec = _bget(f"maps/{mid}/owner.json")
        return (rec, _members_blob(mid)) if rec else (None, {})
    raise StoreError("공유 저장소가 아직 연결되지 않았다냥")


def add_member(mid: str, view: dict) -> tuple[str, str]:
    rec, ms = load(mid)
    if rec is None:
        raise StoreError("지도를 찾을 수 없다냥 (지워졌거나 기간이 지났어)")
    if len(ms) >= MAX_MEMBERS:
        raise StoreError(f"이 지도는 {MAX_MEMBERS}명이 꽉 찼다냥")
    pid, token = new_id(), secrets.token_urlsafe(12)
    entry = {"view": view, "token": _h(token)}
    if backend() == "redis":
        _pipe([["HSET", f"map:{mid}:m", pid, json.dumps(entry, ensure_ascii=False)],
               ["EXPIRE", f"map:{mid}", TTL], ["EXPIRE", f"map:{mid}:m", TTL]])
    else:
        _bput(f"maps/{mid}/m/{pid}.json", entry)
    return pid, token


def remove_member(mid: str, pid: str, token: str) -> bool:
    rec, ms = load(mid)
    if rec is None or pid not in ms:
        return False
    if not (owner_ok(rec, token) or (token and secrets.compare_digest(ms[pid].get("token", ""), _h(token)))):
        raise StoreError("지울 권한이 없다냥")
    if backend() == "redis":
        _pipe([["HDEL", f"map:{mid}:m", pid]])
    else:
        _bdel([f"maps/{mid}/m/{pid}.json"])
    return True


def delete_map(mid: str, token: str) -> bool:
    rec, ms = load(mid)
    if rec is None:
        return False
    if not owner_ok(rec, token):
        raise StoreError("지울 권한이 없다냥")
    if backend() == "redis":
        _pipe([["DEL", f"map:{mid}", f"map:{mid}:m"]])
    else:
        _bdel([f"maps/{mid}/owner.json"] + [f"maps/{mid}/m/{p}.json" for p in ms])
    return True
