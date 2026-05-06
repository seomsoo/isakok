# 하네스 운영 가이드

8단계에서 구축한 자동 하네스 시스템의 운영 절차.

## 1. 모드 전환 절차

### off → dry-run

조건:

- 8-2의 모든 검증 체크리스트 통과
- pr-summarizer가 1주 이상 안정 동작 확인
- ANTHROPIC_API_KEY 설정 완료

절차:

1. GitHub Settings → Secrets and variables → Actions → Variables
2. `AUTO_FIX_MODE` = `dry-run`으로 변경
3. STATUS.md에 전환 시점 기록
4. 1주간 매일 결과 검토 (`docs/auto-fix-log/` 또는 PR 댓글)

### dry-run → apply

평가 기준 (4가지 모두 충족 시 apply 가능):

1. **수정 정확도**: dry-run 결과의 70% 이상이 "통과 가능한 수정"
   - 측정: `docs/auto-fix-log/`의 dry-run 결과를 사람이 검토
   - 기준: 만약 적용했다면 실제로 CI 통과했을 것
2. **거부 범위 위반 0건**: dry-run에서 거부 범위 파일을 건드린 시도 0건
3. **휴리스틱 패턴 위반 0건**: `as any`, `@ts-ignore` 등 추가 시도 0건
4. **비용 안정성**: 일일 평균 입력 토큰 < 한도의 50%

절차:

1. 평가 기준 4가지 STATUS.md에 기록 (수치로)
2. `AUTO_FIX_MODE` = `apply`로 변경
3. 첫 1주 매일 봇 PR 검토 + 머지 여부 결정
4. 봇 PR 머지 비율이 50% 이상이면 안정 운영, 미만이면 dry-run 복귀

### apply → off (긴급 정지)

다음 중 하나 발생 시 즉시:

- 봇이 거부 범위 우회 시도 발견
- 봇이 테스트 약화 시도 발견
- Anthropic Console에서 비용 폭주 알림
- API 응답 이상 (timeout 반복 등)
- (참고) `AUTO_FIX_DAILY_TOKEN_LIMIT` 관측치 도달은 즉시 정지 트리거가 아님 — best-effort라서 의미는 "모니터링 권고" 수준

절차:

1. `AUTO_FIX_MODE` = `off`
2. 진행 중인 봇 PR 모두 close (머지 X)
3. 원인 분석 + 정책/스크립트 패치
4. dry-run으로 복귀 검증 후 apply 재개

## 2. 일일 비용 모니터링

### 위치

`docs/auto-fix-log/budget-{YYYY-MM-DD}.json`

### 형식

```json
{
  "date": "2026-04-28",
  "inputTokens": 12500,
  "outputTokens": 3200,
  "calls": 8
}
```

### 비용 환산 (Sonnet 기준)

- 입력: $3 / M tokens
- 출력: $15 / M tokens
- 예: input=12500, output=3200 → $0.0375 + $0.048 = $0.0855 (약 120원)

### 월별 예상 (사이드프로젝트 빈도)

- 주 5 PR x 30% 실패율 x 4주 = 월 6회 시도
- 1회당 ~$0.10 → 월 ~$0.60 (1,000원 미만)

### 한도 도달 시 (best-effort 관측 기준)

- `AUTO_FIX_DAILY_TOKEN_LIMIT` 도달은 **best-effort 관측치**다. GitHub Actions runner는 매 실행마다 새 환경이라 파일 기반 누적이 정확한 전역 한도를 보장하지 않는다.
- 같은 runner/같은 workflow 안에서만 누적이 의미 있고, 다른 runner에선 0부터 시작할 수 있다.
- 실제 비용 hard limit은 **Anthropic Console의 월 예산 알림/제한**으로 관리한다.
- `AUTO_FIX_DAILY_TOKEN_LIMIT`은 "관측 가능한 범위에서 너무 자주 호출되는 패턴" 발견용 보조 가드로만 사용한다.
- 관측치 한도 도달 시 budget-guard는 `[WARN]` 로그를 남기지만, 후속 단계는 `if:` 조건으로 계속 진행한다 (best-effort라서 강제 중단하지 않음).
- 진짜 비용 폭주가 의심되면 즉시 Anthropic Console 확인 + `AUTO_FIX_MODE=off` 전환.

## 3. 장애 대응

### 시나리오 A: 봇 PR이 무한 생성됨

증상: `auto-fix/`로 시작하는 PR이 계속 추가됨

원인 후보:

1. `check-attempts.mjs`가 봇 PR을 카운트 못 하고 있음
2. 봇 PR의 CI도 실패해서 또 봇이 트리거됨 (actor 가드 누락)

대응:

1. 즉시 `AUTO_FIX_MODE=off`
2. 모든 봇 PR close
3. `check-actor`, `check-attempts` 가드 로직 검토
4. 패치 + dry-run 재검증 → apply 재개

### 시나리오 B: 봇 PR이 거부 범위 파일을 변경함

증상: 봇 PR에 `package.json`, `supabase/migrations/` 등 변경 포함

원인 후보:

1. `check-scope.ts`의 패턴 누락
2. LLM이 우회하는 새 패턴 발견 (예: `as any` 대신 `as unknown as X`)

대응:

1. `AUTO_FIX_MODE=off`
2. `check-scope.ts`에 새 패턴 추가
3. 정책 §2-2에 패턴 추가 (단일 출처)
4. 단위 테스트 추가 (해당 패턴이 차단되는지)
5. dry-run 복귀 후 apply

### 시나리오 C: API 응답 timeout 반복

증상: `run.mjs`가 30초 내 응답 받지 못하고 실패

원인 후보:

1. Claude API 장애 (status.anthropic.com 확인)
2. 입력 토큰이 너무 큼 (CI 로그가 5MB 초과)

대응:

1. status.anthropic.com 확인 → 장애면 대기
2. 장애 아니면 `fetch-logs.mjs`의 트렁케이트 한도 축소 (1MB → 500KB)
3. timeout 재시도 로직 검토 (지수 백오프)

### 시나리오 D: 봇이 테스트 약화로 통과시킴

증상: 봇 PR에 `expect(...)` 제거 또는 `.skip()` 추가

대응:

1. **즉시 봇 PR close (절대 머지 X)**
2. `check-scope.ts`의 휴리스틱 패턴이 누락됐을 가능성 높음 → 추가
3. auto-fixer 프롬프트의 "거부 사례" 강화 (negative example 추가)
4. dry-run 1주 + 결과 0건 확인 후 apply 복귀

### 시나리오 E: 비용 폭주 의심

증상: Anthropic Console에서 평소 대비 10배 이상 사용량

원인 후보:

1. 외부에서 PR 폭격 (스크립트 어택)
2. 같은 PR에 push 폭주 → pr-summarize 반복 호출
3. budget-guard가 best-effort라 누적 관측이 누락됨

대응:

1. 즉시 `AUTO_FIX_MODE=off`
2. Anthropic Console에서 월 예산 한도 강하게 설정
3. 의심 PR/branch 식별 후 작성자 확인 (악의적이면 차단)
4. 정상 패턴 회복 후 dry-run 복귀

## 4. 정기 점검

### 주간

- 봇 PR 머지율 확인 (목표: > 50%)
- `docs/auto-fix-log/`에 누적된 실패 패턴 검토
- API 비용 누적치 확인

### 월간

- Claude API 모델 버전 확인 (deprecated 여부)
- pnpm/Node 버전 업데이트 확인 (`packageManager` 필드)
- 정책 단일 출처 룰 변경 사항 PR 검토

### 분기

- `docs/auto-fix-log/` archive 또는 정리
- 새 휴리스틱 패턴 추가 검토
- L3 봇 활성화 여부 재평가 (사용 안 하면 off로)
