"""MCP(Model Context Protocol) stdio 서버 — 표준 라이브러리만 사용.

실행: python -m ksaju.mcp_server   (또는 scripts/mcp.py)
"""
from __future__ import annotations

import json
import sys
from datetime import date

from . import __version__
from .calendar import leap_month_of, lunar_to_solar, solar_to_lunar
from .luck import day_ganzi
from .report import read_compatibility, read_saju

BIRTH = {
    "year": {"type": "integer", "description": "출생 연도"},
    "month": {"type": "integer", "description": "출생 월 1~12"},
    "day": {"type": "integer", "description": "출생 일"},
    "hour": {"type": "integer", "description": "출생 시 0~23 (모르면 생략 → 삼주로 풀이)"},
    "minute": {"type": "integer", "description": "출생 분"},
    "gender": {"type": "string", "enum": ["남", "여"], "description": "대운 순역 결정"},
    "calendar": {"type": "string", "enum": ["solar", "lunar"], "description": "양력/음력 (기본 solar)"},
    "leap": {"type": "boolean", "description": "음력 윤달"},
    "longitude": {"type": "number", "description": "출생지 경도 (서울 126.98, 부산 129.08, 광주 126.85, 대구 128.6, 대전 127.38, 제주 126.53)"},
    "apply_lmt": {"type": "boolean", "description": "경도 보정(기본 true)"},
    "true_solar": {"type": "boolean", "description": "균시차 포함 진태양시(기본 false)"},
    "zi_mode": {"type": "string", "enum": ["unified", "split"], "description": "자시 처리: unified=23시 일주 변경 / split=야자시"},
    "name": {"type": "string"},
}
_BIRTH_KEYS = ["calendar", "leap", "longitude", "apply_lmt", "true_solar", "zi_mode", "name"]

TOOLS = [
    {"name": "calculate_saju",
     "description": ("한국 만세력으로 사주팔자를 계산·분석합니다. 원국, 지장간, 십성, 12운성, 오행 비중, 강약, "
                     "격국, 용신(억부+조후), 합충형파해, 신살, 12신살, 공망, 대운·세운·월운, 오늘 일진, 해석 요약을 반환. "
                     "풀이는 반드시 이 결과를 근거로 하세요."),
     "inputSchema": {"type": "object", "properties": {
         **BIRTH, "format": {"type": "string", "enum": ["compact", "markdown", "json"],
                             "description": "compact=LLM용(기본), markdown=사람용 표, json=전체 구조"},
         "today": {"type": "string", "description": "기준일 YYYY-MM-DD (생략 시 오늘)"}},
         "required": ["year", "month", "day"]}},
    {"name": "saju_compatibility",
     "description": "두 사람의 궁합(일간·일지·띠·월지·용신 보완 점수와 해설)과 각자의 원국 요약을 반환합니다.",
     "inputSchema": {"type": "object", "properties": {
         "person1": {"type": "object", "properties": BIRTH, "required": ["year", "month", "day"]},
         "person2": {"type": "object", "properties": BIRTH, "required": ["year", "month", "day"]}},
         "required": ["person1", "person2"]}},
    {"name": "lunar_to_solar", "description": "음력 → 양력 (천문 계산 기반 한국 음력)",
     "inputSchema": {"type": "object", "properties": {
         "year": {"type": "integer"}, "month": {"type": "integer"}, "day": {"type": "integer"},
         "leap": {"type": "boolean"}}, "required": ["year", "month", "day"]}},
    {"name": "solar_to_lunar", "description": "양력 → 음력, 해당 음력 연도 윤달 정보 포함",
     "inputSchema": {"type": "object", "properties": {
         "year": {"type": "integer"}, "month": {"type": "integer"}, "day": {"type": "integer"}},
         "required": ["year", "month", "day"]}},
    {"name": "day_ganzi", "description": "지정일(기본 오늘)의 연·월·일 간지(일진). 택일·일운용. 출생정보를 주면 그 사람 기준 십성·합충도 계산.",
     "inputSchema": {"type": "object", "properties": {
         "date": {"type": "string", "description": "YYYY-MM-DD"},
         "birth": {"type": "object", "properties": BIRTH}}}},
]


def _reading(a: dict, today: date | None = None):
    kw = {k: a[k] for k in _BIRTH_KEYS if a.get(k) is not None}
    return read_saju(a["year"], a["month"], a["day"], a.get("hour"), a.get("minute") or 0,
                     gender=a.get("gender", "남"), today=today, **kw)


def _parse_date(s: str | None) -> date | None:
    return date.fromisoformat(s) if s else None


def call_tool(name: str, a: dict) -> str:
    if name == "calculate_saju":
        r = _reading(a, _parse_date(a.get("today")))
        fmt = a.get("format", "compact")
        if fmt == "markdown":
            return r.to_markdown()
        if fmt == "json":
            return json.dumps(r.to_dict(), ensure_ascii=False, default=str)
        return r.to_compact()
    if name == "saju_compatibility":
        r1, r2 = _reading(a["person1"]), _reading(a["person2"])
        res = read_compatibility(r1, r2)
        return (json.dumps(res, ensure_ascii=False, indent=1)
                + "\n\n# 1번 원국\n" + r1.to_compact() + "\n\n# 2번 원국\n" + r2.to_compact())
    if name == "lunar_to_solar":
        d = lunar_to_solar(a["year"], a["month"], a["day"], bool(a.get("leap")))
        return f"음력 {a['year']}.{a['month']}.{a['day']}{'(윤)' if a.get('leap') else ''} → 양력 {d.isoformat()}"
    if name == "solar_to_lunar":
        ld = solar_to_lunar(a["year"], a["month"], a["day"])
        lm = leap_month_of(ld.year)
        return f"양력 {a['year']}.{a['month']}.{a['day']} → {ld} (음력 {ld.year}년 윤달: {f'윤{lm}월' if lm else '없음'})"
    if name == "day_ganzi":
        d = _parse_date(a.get("date")) or date.today()
        if a.get("birth"):
            r = _reading(a["birth"], d)
            return json.dumps(r.today_luck, ensure_ascii=False)
        return json.dumps(day_ganzi(d), ensure_ascii=False)
    raise ValueError(f"알 수 없는 도구: {name}")


def _send(msg: dict):
    sys.stdout.write(json.dumps(msg, ensure_ascii=False) + "\n")
    sys.stdout.flush()


def handle(msg: dict):
    mid, method, params = msg.get("id"), msg.get("method"), msg.get("params") or {}
    if mid is None:
        return
    try:
        if method == "initialize":
            return _send({"jsonrpc": "2.0", "id": mid, "result": {
                "protocolVersion": params.get("protocolVersion", "2025-06-18"),
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "korean-saju", "version": __version__},
                "instructions": "한국 사주 계산 서버. 사주 질문에는 calculate_saju 결과를 근거로 해석하고 간지를 추측하지 마세요."}})
        if method == "ping":
            return _send({"jsonrpc": "2.0", "id": mid, "result": {}})
        if method == "tools/list":
            return _send({"jsonrpc": "2.0", "id": mid, "result": {"tools": TOOLS}})
        if method == "tools/call":
            try:
                text = call_tool(params["name"], params.get("arguments") or {})
                return _send({"jsonrpc": "2.0", "id": mid, "result": {"content": [{"type": "text", "text": text}]}})
            except Exception as e:  # 도구 오류는 결과로 돌려준다
                return _send({"jsonrpc": "2.0", "id": mid, "result": {
                    "content": [{"type": "text", "text": f"오류: {e}"}], "isError": True}})
        if method in ("resources/list", "prompts/list"):
            key = method.split("/")[0]
            return _send({"jsonrpc": "2.0", "id": mid, "result": {key: []}})
        _send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32601, "message": f"Method not found: {method}"}})
    except Exception as e:
        _send({"jsonrpc": "2.0", "id": mid, "error": {"code": -32603, "message": str(e)}})


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stdin.reconfigure(encoding="utf-8")
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            msg = json.loads(line)
        except json.JSONDecodeError:
            _send({"jsonrpc": "2.0", "id": None, "error": {"code": -32700, "message": "Parse error"}})
            continue
        for m in (msg if isinstance(msg, list) else [msg]):
            handle(m)


if __name__ == "__main__":
    main()
