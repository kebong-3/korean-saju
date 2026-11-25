# 사주냥이 웹앱 — 구조와 Vercel 배포

> 2천 년 동안 인간의 사주를 봐 온 고양이, **사주냥이**가 사주를 쉽게 풀어주고 고민을 상담해 주는 모바일 웹앱.

## 무엇이 어디서 계산되나

| 기능 | 계산 | 비용 |
|---|---|---|
| 사주 원국·오행·십성·용신·대운·세운·궁합 | `src/ksaju` 엔진 (천문 계산 만세력) | 무료 |
| 오늘 운세, 2027 신년운세(분야 6개·월별), 평생 총운 그래프, 앞으로 10년 | `sajunyang/fortune.py` (엔진 결과 + 점수 규칙) | 무료 |
| 나에게 맞는 일·연애 스타일·띠·행운 색, 개운 처방전 | `sajunyang/fortune.py` | 무료 |
| 고민 상담 (7개 주제 · 24개 고민, 본인 사주 데이터로 답변) | `sajunyang/counsel.py` | 무료 |
| 쉬운 용어사전(97개), 냥이 옛이야기(8편), 캐릭터 설정 | `sajunyang/persona.py` | 무료 |
| 오늘의 시간대별 운(12시진), 앞으로 5주 운세 달력, 좋은 날 TOP5 | `sajunyang/fortune.py` | 무료 |
| 🐾 냥이 도사 대풀이 13종 — 평생 총평·오늘/내일/특정일·이번 주·이번 달·신년·연애·재물·직업·건강·대운·궁합·꿈해몽 | `sajunyang/readings.py` + Gemini (키 없으면 규칙 기반 서술형 풀이) | Gemini 요금 |
| 1:1 자유 대화 상담 | Gemini(기본) 또는 Claude | Gemini 요금 |

같은 생일을 넣으면 운세 점수는 항상 같습니다. AI는 점수를 만들지 않고, 위 계산 결과만 근거로 말하도록 되어 있습니다.

## 파일

```
app.py              FastAPI 서버 (Vercel 엔트리포인트) — /api/saju, /api/compat, /api/meta, /api/status, /api/ai, /api/readings, /api/reading
sajunyang/          운세 점수·상담 시나리오·사주냥이 페르소나·용어사전·대풀이(readings.py)·AI 연결(llm.py)
public/             화면 (index.html, style.css, app.js, nyang.js=캐릭터 SVG)
src/ksaju/          사주 엔진 (외부 의존성 0개, 기존 그대로)
pyproject.toml      엔진 패키지 정보 + 웹앱 의존성(fastapi, anthropic) + Vercel 엔트리포인트
uv.lock             Vercel이 그대로 설치하는 고정 버전 목록
requirements.txt    로컬 실행용
vercel.json         함수 설정 (최대 60초, 테스트·문서 제외)
```

## 로컬 실행

```bash
pip install -r requirements.txt uvicorn
python -m uvicorn app:app --port 8000
# http://localhost:8000
```

## Vercel 배포

1. 이 브랜치를 GitHub에 push → main에 merge
2. [vercel.com/new](https://vercel.com/new) → GitHub 저장소 `korean-saju` Import
3. Framework Preset은 자동으로 **FastAPI**가 잡힙니다. Root Directory는 저장소 루트 그대로.
4. Deploy

### 의존성은 pyproject.toml에서 읽습니다
Vercel은 저장소 루트에 `pyproject.toml`이 있으면 `requirements.txt`를 읽지 않습니다(`uv.lock` → `pyproject.toml` 순).
그래서 웹앱 의존성(fastapi, anthropic)을 `pyproject.toml`의 `dependencies`에 적고, 버전을 고정한 `uv.lock`을 함께 커밋했습니다.
의존성을 바꾸면 `uv lock`을 다시 실행해 `uv.lock`도 같이 커밋하세요. `requirements.txt`는 로컬 실행용입니다.

### AI(냥이 도사) 켜기 — Gemini
Vercel → Project → Settings → Environment Variables

| 이름 | 값 | 설명 |
|---|---|---|
| `GEMINI_API_KEY` | `AIza...` | Google AI Studio 키. `Api_key`·`GOOGLE_API_KEY`·`API_KEY` 이름도 인식 |
| `GEMINI_MODEL` (선택) | 예: `gemini-3.6-flash` | 없으면 `gemini-flash-latest` → `gemini-3.6-flash` → `gemini-3.5-flash` → `gemini-2.5-flash` 순으로 시도 |
| `ANTHROPIC_API_KEY` (선택) | `sk-ant-...` | Gemini 키가 없을 때만 Claude 사용 (`SAJU_MODEL`로 모델 지정) |

환경변수를 추가·수정한 뒤에는 **반드시 다시 배포(Redeploy)** 해야 적용됩니다. 환경(Production/Preview)에 체크했는지도 확인하세요.
연결 확인: `https://<도메인>/api/status` → `{"ai": true, "provider": "gemini", "key_from": "...", "key_format_ok": true}` (키 값은 노출하지 않음)

키가 없으면 대풀이는 규칙 기반 서술형 풀이로, 상담은 무료 시나리오 상담으로 동작합니다.
결제·사용량 제한은 아직 없으므로, 널리 공개하기 전에 요청 제한(Vercel Firewall Rate Limit 등)을 붙이세요.

## 고지
사주는 성향과 흐름을 읽는 전통 해석 체계입니다. 냥이의 옛이야기는 개념 설명용 창작 설화입니다.
위기 상황 키워드가 입력되면 상담 탭은 풀이를 멈추고 109(자살예방상담전화)·1577-0199를 안내합니다.

## 귀인 지도 공유 저장소 연결 (한 번만)

친구가 공유 링크에서 생일을 넣으면 내 지도에 자동으로 올라오게 하려면 작은 저장소가 필요합니다.

1. Vercel 대시보드 → 이 프로젝트 → **Storage** → **Create Database / Browse Marketplace** → **Upstash for Redis** 선택
2. 무료 플랜으로 만들고 **이 프로젝트에 연결(Connect)** — `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경변수가 자동으로 생깁니다
3. **Redeploy** 한 번

연결 전에는 앱이 자동으로 **'내 폰에만 저장' 모드**로 동작합니다(친구 생일을 직접 넣어 지도를 만들 수 있고, 링크 공유만 꺼짐).
`/api/status`의 `"share": true`로 연결 여부를 확인할 수 있습니다.

저장 원칙: 친구의 생년월일은 저장하지 않고(관계 계산 결과와 별명만), 지도 주인의 생년월일만 지도 재계산용으로 저장합니다.
비밀 토큰은 해시로만 보관하며, 400일 동안 활동이 없으면 자동 삭제됩니다. 주인·본인은 언제든 별을 지울 수 있습니다.
