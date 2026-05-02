---
description: 검증 실패를 자동으로 수정하고 재시도하는 루프 (최대 3회)
allowed-tools: Read, Edit, Bash, Grep, Glob, Task
---

# /auto-fix

검증 실패를 자동으로 수정하고 재검증하는 루프를 실행합니다.
정책 출처: `.claude/policies/auto-fix-scope.md`

## 절차

### 0. 사전 가드 (실행 전 필수 체크)

다음 조건이 충족되지 않으면 **즉시 중단**한다:

#### 0-1. Clean working tree 확인

```bash
git status --porcelain
```

결과가 비어있지 않으면 (작업 중 변경사항이 있으면):

- 즉시 중단
- 사람에게 보고: "기존 변경사항이 있습니다. 먼저 커밋하거나 stash 후 재실행하세요."
- **이유:** auto-fix가 만든 변경과 사람의 작업 변경이 섞이면 어떤 변경이 누구 것인지 추적 불가능

#### 0-2. main 브랜치 금지

```bash
current_branch=$(git branch --show-current)
if [ "$current_branch" = "main" ]; then
  echo "❌ /auto-fix는 main 브랜치에서 실행하지 않습니다."
  echo "   feature branch로 전환 후 재실행하세요."
  exit 1
fi
```

main 브랜치에서는 자동 수정을 절대 허용하지 않는다. feature branch에서만 동작.

이 조건이 통과되면 1번부터 시작:

다음을 **최대 3회** 반복:

### 1. 검증 실행

```bash
pnpm verify
```

각 단계의 결과를 분류:

- ✅ 모든 단계 통과 → 종료 (성공 보고)
- ❌ 어느 단계 실패 → 2번으로

### 2. 실패 분석

실패한 명령의 stderr/stdout을 읽고 다음 정보 추출:

- 실패 단계: lint / typecheck / test / build
- 에러 종류: 형식 / 타입 / 로직 / 환경
- 영향 파일: 파일 경로 + 라인 번호

다음 형식으로 분류:

| 분류                      | 예시                                            | 처리                 |
| ------------------------- | ----------------------------------------------- | -------------------- |
| 🔧 기계적 (deterministic) | ESLint, prettier, 미사용 import, 단순 타입 누락 | 3-1로                |
| 🤔 판단 필요 (judgmental) | 테스트 실패의 실제 버그, 로직 오류              | 3-2로                |
| 🚫 환경 (out of scope)    | 의존성 누락, 환경변수 누락, 외부 서비스 다운    | 즉시 중단, 사람 호출 |

### 3-1. 기계적 수정 (auto-fixer 에이전트 위임)

**메인 세션이 직접 수정하지 않음.** auto-fixer sub-agent를 호출하여 격리된 컨텍스트에서 수정:

```
auto-fixer 에이전트에게 다음 정보 전달:
- 실패한 명령
- stderr 전문
- 영향 파일 경로
- 정책: .claude/policies/auto-fix-scope.md
```

auto-fixer가 patch 제안 → 메인 세션이 적용 전 거부 범위 검증:

```bash
pnpm auto-fix:check-scope
```

거부 범위 변경 감지 시 즉시 중단.

### 3-2. 판단 수정 (조건부)

테스트 실패 시:

- **테스트 코드 자체는 수정 금지** (정책 §2-1)
- 코드 버그가 명백한 경우만 수정 시도
- 의심스러우면 즉시 중단하고 사람에게 보고

### 4. 재검증

`pnpm verify` 재실행 → 1번으로 복귀.

### 5. 종료 조건

- ✅ 모든 검사 통과 → "자동 수정 완료, N회 시도" 보고
- ❌ 3회 후에도 실패 → 시도 이력을 `docs/auto-fix-log/{timestamp}.md`에 저장 후 중단
- 🚫 환경 문제 → 즉시 중단하고 사람에게 정확한 원인 보고

## 출력 형식

매 시도 후 다음 정보를 채팅에 출력:

```
[Attempt N/3]
실패 단계: {lint|typecheck|test|build}
분류: {기계적|판단|환경}
영향 파일: {파일 경로 목록}
수정 시도: {수정 내용 요약}
결과: {통과|실패|중단}
```

루프 종료 시 `docs/auto-fix-log/{YYYY-MM-DD-HHmm}.md` 작성:

```markdown
# Auto-fix Log: {timestamp}

## 입력

- 트리거: 사람이 /auto-fix 호출
- 시작 시점 git HEAD: {hash}

## 시도 N/3 (성공/실패)

- 실패 단계: ...
- 분류: ...
- 변경 파일: ...
- diff 요약: ...

## 최종 결과

- 통과 여부: ✅/❌
- 사람 검토 필요 사항: ...
- 다음 액션 제안: ...
```

## 안전 장치

- **사전 가드 (0-1, 0-2)**: clean working tree + main 브랜치 금지 — 실행 전 체크
- 거부 범위(`scripts/auto-fix/check-scope.ts`)에 걸리면 즉시 중단
- `package.json`, `pnpm-lock.yaml` 수정 시 즉시 중단
- 새 npm 패키지 설치 절대 금지
- `.env*`, `supabase/migrations/**` 절대 수정 금지
- 매 시도마다 git status로 의도하지 않은 변경 없는지 확인
