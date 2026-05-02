# Auto-fix 허용 범위 정책

이 문서는 자동 교정 시스템(L1/L2/L3)이 따르는 단일 출처입니다.
변경 시 다음 시스템 모두에 영향을 줍니다:

- `.claude/commands/auto-fix.md` (L1)
- `.claude/agents/auto-fixer.md` (L2)
- `.github/workflows/auto-fix-bot.yml` (L3, 8-2에서 추가)
- `scripts/auto-fix/check-scope.ts` (가드 스크립트)

룰 충돌이 의심되면 이 파일을 정답으로 본다.

## 0. 적용 범위

**이 정책의 거부 범위는 자동 교정 시스템(`/auto-fix`, `auto-fixer`, 향후 CI 봇)에만 적용된다.**

사람이 명시적으로 수행하는 스펙 구현 작업에는 적용하지 않는다. 즉:

- 8-1 구현 과정에서 사람이 `package.json`, `.husky/`, `.github/workflows/` 등을 수정하는 것은 정상 작업
- 9단계에서 사람이 `supabase/migrations/` 마이그레이션을 추가하는 것도 정상 작업
- 정책의 거부 범위는 **LLM/봇이 자동으로 손대는 것**만 차단

---

## 1. 허용되는 수정 종류

### 1-1. 자동 수정 OK (deterministic)

다음은 ESLint/Prettier/TypeScript 컴파일러가 정답을 알려주는 영역입니다:

- ESLint --fix가 자동으로 고치는 위반
- Prettier --write로 포맷 정렬
- 미사용 import/변수 제거
- TypeScript 단순 에러:
  - 누락된 import 추가 (자동 import 후보가 명확한 경우)
  - 명시적 타입 어노테이션 추가 (단, `any` 추가는 금지)
  - readonly 키워드 추가
  - `as const` 추가
- 단순 오타 수정 (LSP가 정확한 후보 1개만 제안하는 경우)

### 1-2. 시도해도 됨 (judgmental, 결과 사람 검토 필수)

다음은 수정 시도는 하되, 사람의 명시적 승인 없이는 머지 금지:

- 단위 테스트 실패의 원인이 명백히 코드 버그인 경우의 코드 수정
- 임포트 경로 변경(파일 이동에 따른)

---

## 2. 거부되는 수정 종류 (절대 금지)

### 2-1. 경로 기반 차단 (gitignore-style 패턴)

다음 경로는 자동 수정 대상에서 즉시 제외됩니다:

```
# 테스트 코드 (LLM auto-fixer가 의미적 수정 금지)
# 단, pre-commit의 deterministic 포맷팅(prettier --write, eslint --fix)은 허용
# expect 제거, .skip/.todo/.only 추가, assertion 약화는 §2-2에서 추가 차단
**/*.test.ts
**/*.test.tsx
**/*.spec.ts
**/*.spec.tsx
**/__tests__/**
**/tests/**

# DB / 백엔드 핵심
supabase/migrations/**
supabase/functions/**

# 인증 / 보안 (8-2에서 추가될 인증 코드 미리 차단)
packages/shared/src/services/auth/**
**/auth/**

# 환경변수
.env
.env.*
!.env.example

# 의존성 / 빌드 설정
package.json
pnpm-lock.yaml
**/next.config.*
**/vite.config.*
tsconfig.json
tsconfig.*.json
**/tailwind.config.*

# CI 자체
.github/workflows/**
.husky/**

# 정책 자체 (자기 자신 수정 금지)
.claude/policies/**
```

### 2-2. 패턴 기반 차단 (휴리스틱)

위 경로 외 파일이라도 patch에 다음 패턴이 포함되면 거부:

- `expect(` 호출을 제거하는 변경
- `.skip(`, `.todo(`, `.only(` 추가
- `as any`, `as unknown as` 추가
- `// @ts-ignore`, `// @ts-expect-error` 추가
- `eslint-disable` 주석 추가 (라인/블록/파일 단위 모두)
- `console.error`, `logger.error` 호출 제거
- `dangerouslySetInnerHTML` 추가
- `eval(`, `new Function(` 사용

---

## 3. 통과 기준

수정 시도 후 다음이 **모두 통과**해야 "수정 성공"으로 간주한다:

1. `pnpm lint` 통과
2. `pnpm typecheck` 통과 (모노레포 전체)
3. `pnpm test` 통과 (변경 영향 범위)
4. `pnpm build` 통과

위 4개 중 하나라도 실패 시 → 시도 횟수 차감 후 재시도, 최대 3회.
3회 후에도 실패 → 사람에게 보고하고 중단.

---

## 4. 시도 한도

- 한 번의 자동 교정 세션당 최대 3회 반복
- 매 시도마다 git diff를 `docs/auto-fix-log/{timestamp}.md`에 누적
- 3회 후에도 실패 → "사람 개입 필요" 마커 추가하고 중단

---

## 5. 자동 머지 정책

- 봇/스크립트가 만든 PR은 **절대 자동 머지 금지**
- 모든 봇 PR에 `bot`, `auto-fix`, `needs-human-review` 라벨 자동 부착
- main 브랜치 보호 룰:
  - PR 경유 + CI 통과 필수 (1인 운영에서도 적용)
  - "Required approvals: 1+"는 협업자 합류 또는 외부 리뷰어 도입 시 활성화 (1인 운영 시 본인 PR self-approve 불가 회피)

---

## 6. 변경 이력

이 정책 자체의 변경은 별도 PR로 처리하고, 본인 외 1인 검토 권장.
1인 개발 환경에서는 변경 후 24시간 숙려 권장.
