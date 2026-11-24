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
| 1:1 자유 대화 상담 (프리미엄 후보) | Claude API, `ANTHROPIC_API_KEY`가 있을 때만 켜짐 | 유료 |

같은 생일을 넣으면 운세 점수는 항상 같습니다. AI는 점수를 만들지 않고, 위 계산 결과만 근거로 말하도록 되어 있습니다.

## 파일

```
app.py              FastAPI 서버 (Vercel 엔트리포인트) — /api/saju, /api/compat, /api/meta, /api/status, /api/ai
sajunyang/          운세 점수·상담 시나리오·사주냥이 페르소나·용어사전
public/             화면 (index.html, style.css, app.js, nyang.js=캐릭터 SVG)
src/ksaju/          사주 엔진 (외부 의존성 0개, 기존 그대로)
requirements.txt    웹앱 의존성 (fastapi, anthropic)
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

### 첫 배포 때 꼭 확인할 것
- 빌드 로그에 `fastapi` 설치가 보이는지. 저장소 루트에 엔진용 `pyproject.toml`(의존성 없음)과 `requirements.txt`가 함께 있어서,
  만약 Vercel이 `pyproject.toml`만 읽고 fastapi를 설치하지 않으면 함수가 `ModuleNotFoundError: fastapi`로 실패합니다.
  그때는 `pyproject.toml`의 `[project]`에 `dependencies = ["fastapi>=0.117", "anthropic>=1.0"]`를 넣으면 해결됩니다
  (단, 그러면 엔진을 `pip install`할 때도 두 패키지가 같이 설치됩니다).

### AI 상담 켜기 (선택)
Vercel → Project → Settings → Environment Variables

| 이름 | 값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | `sk-ant-...` | 있으면 상담 탭 자유 입력이 AI 상담으로 바뀜 |
| `SAJU_MODEL` | `claude-haiku-5-5` (선택) | 기본값은 `claude-opus-5-5`. Haiku로 바꾸면 비용이 약 1/30 |

키가 없으면 AI 관련 버튼은 숨겨지고 무료 시나리오 상담으로 동작합니다.
결제·사용량 제한은 아직 없으므로, 키를 넣고 공개하기 전에 결제 연동이나 요청 제한(Vercel Firewall Rate Limit 등)을 먼저 붙이세요.

## 고지
사주는 성향과 흐름을 읽는 전통 해석 체계입니다. 냥이의 옛이야기는 개념 설명용 창작 설화입니다.
위기 상황 키워드가 입력되면 상담 탭은 풀이를 멈추고 109(자살예방상담전화)·1577-0199를 안내합니다.
