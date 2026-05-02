# 8단계-1: 하네스 코어 (SDD) v2

> 목표: 수동 하네스(`/verify`, `/handoff`, `spec-reviewer`) 위에 자동 하네스의 **로컬 + 기본 CI 레이어**를 얹어, 사람이 명령어를 까먹어도 main이 깨지지 않게 한다.
> 이 단계가 끝나면: ① PR마다 GitHub Actions가 lint/typecheck/test/build를 강제 검증하고, ② git commit/push 시점에 커밋훅이 1차 검증을 자동 실행하며, ③ Claude Code에서 `/auto-fix` 명령으로 검증 실패를 자동 교정하는 루프가 작동하고, ④ 자동 교정의 허용/거부 범위를 정의한 정책 파일이 단일 출처로 존재하는 상태.

> **v2 변경 사항 (v1 → v2, GPT 외부 리뷰 1차 + 2차 반영):**
>
> **1차 리뷰 반영:**
>
> - Husky hook 문법을 v9 권장 방식(shebang/sourcing 라인 없음)으로 수정. v8 이하 스타일은 deprecated
> - 1인 개발자 현실 반영: 브랜치 보호 룰에서 approval 1명 강제를 선택사항으로 (본인 PR self-approve 불가 회피)
> - PR CI 설명 "병렬 실행" → "순차 실행" (실제 YAML과 일치)
> - pre-push 설명을 `verify:fast`(lint+typecheck) 실제 동작과 일치
> - `tsx`를 devDependency 설치 목록에 명시 (check-scope.ts 실행용)
> - `check-scope.ts`에서 unused import 제거, console.error/logger.error/eslint-disable 패턴 보강 (정책 §2-2 일치)
> - 정책 파일에 §0 적용 범위 신설: 거부 범위는 자동 교정 시스템에만 적용, 사람의 스펙 구현 작업에는 미적용
> - 테스트 파일 자동 수정 정책 명확화: pre-commit deterministic 포맷팅은 허용, LLM 의미적 수정만 차단
> - `/auto-fix` §0 사전 가드 추가: clean working tree + main 브랜치 금지
> - `package.json`에 `packageManager` 필드 명시 (로컬-CI pnpm 버전 동기화)
> - Vitest watch mode 회피 명시
> - auto-fix log 저장 정책: 8-1에선 git 커밋, MVP 후 archive/.gitignore 검토
> - 브랜치 보호 룰 enforcement 제한 시 STATUS.md 기록 정책 추가
>
> **2차 리뷰 반영 (일관성 / 명확화 보강):**
>
> - §0 도입부의 브랜치 보호 / pre-push 설명을 §3-4 / §4-5 본문과 일관되게 수정 (1+ approval 필수 → 1인 운영 시 선택)
> - 정책 §5 자동 머지 정책에서 "1+ approval 필수"를 "협업자 합류 시 활성화"로 수정
> - `packageManager` 값을 placeholder `pnpm@9.x.x`가 아닌 실제 patch 버전(`pnpm@9.15.4` 형태)으로 고정 강조 (Corepack은 와일드카드 의도 다름)
> - Vitest watch mode 차단 전략을 "방법 A 단일 채택"으로 확정 — 각 패키지에서 `vitest run` 직접 명시
> - Husky v9 설명을 "권장 작성 방식" 중심으로 재서술, deprecated 표현 명확화
> - `check-scope.ts`의 테스트 파일 차단 주석을 "LLM 자동 수정 차단 전용, 포맷팅은 다른 경로로 허용"으로 명확화

> **이 문서의 위치:**
>
> - 선행: 0~7단계 완료, STATUS.md = "8단계 진입"
> - 후속: `08-2-harness-ci-bot.md` (L3 자율 봇 + 추가 에이전트 6종 + 운영 가이드)
> - 검증: `08-1-verify.md`

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- **정책 단일 출처**: `.claude/policies/auto-fix-scope.md` — L1/L2/L3가 모두 참조하는 허용/거부 범위
- **PR CI**: `.github/workflows/ci.yml` — install/lint/typecheck/test/build를 단일 job에서 순차 실행 (병렬 job 분할은 추후 필요시)
- **브랜치 보호**: main 직푸시 금지 + PR 경유 + CI 통과 필수 (1인 운영에선 approval 1명은 선택, MVP 후 활성)
- **커밋훅 3종**:
  - `pre-commit`: lint-staged로 변경 파일에 prettier/eslint --fix
  - `commit-msg`: commitlint로 Conventional Commits 강제
  - `pre-push`: `pnpm verify:fast`로 lint + typecheck (test/build는 CI에서 실행)
- **L1 로컬 자동 교정 루프**: `.claude/commands/auto-fix.md` — 검증 → 분류 → 수정 → 재검증을 최대 3회 반복
- **L2 핵심 sub-agent 2종**:
  - `spec-reviewer.md` 보강 (컴포넌트 설계 검토 흡수)
  - `auto-fixer.md` 신규 (격리된 컨텍스트에서 최소 변경 수정)
- **거부 범위 가드 스크립트**: `scripts/auto-fix/check-scope.ts` — patch가 거부 범위를 건드는지 결정적 검증
- **자동수정 이력 디렉토리**: `docs/auto-fix-log/` — 시도/결과 누적 기록
- **테스트용 npm 스크립트**: `pnpm verify`, `pnpm verify:fast` (커밋훅에서도 사용)

### 안 하는 것

- **L3 CI 자율 봇** — 8-2
- **추가 sub-agent 6종**(security-auditor, pr-summarizer, ux-state-reviewer, web-a11y-reviewer, native-a11y-reviewer, perf-budget-reviewer) — 8-2
- **Dependabot, Gitleaks, eslint-plugin-jsx-a11y** — 8-2
- **Claude API 직접 호출 / GitHub Actions에서 LLM 호출** — 8-2
- **Vercel Preview 배포 자동화** — 이미 GitHub 연동 시 자동 작동. 명시적 정의는 9단계
- **PR 미리보기 환경 분리(staging Supabase)** — 9단계
- **테스트 작성 자체** (커버리지 룰만 정의, 신규 테스트 추가는 각 단계에서 처리)
- **Renovate** (Dependabot으로 시작, 향후 마이그레이션 가능)
- **Lighthouse CI, Bundlewatch** — MVP 출시 후
- **Playwright E2E** — MVP 출시 후
- **Visual Regression(Chromatic 등)** — MVP 출시 후
- **commitlint scope 강제** (subject 형식만 강제, scope 누락은 허용)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
.claude/
├── commands/
│   ├── verify.md                       ← 기존 (변경 없음)
│   ├── handoff.md                      ← 기존 (변경 없음)
│   └── auto-fix.md                     ← 생성 (L1 루프)
├── agents/
│   ├── spec-reviewer.md                ← 수정 (컴포넌트 설계 섹션 추가)
│   └── auto-fixer.md                   ← 생성 (격리 수정 에이전트)
└── policies/
    └── auto-fix-scope.md               ← 생성 (정책 단일 출처)

.github/
└── workflows/
    └── ci.yml                          ← 생성 (PR CI)

.husky/
├── pre-commit                          ← 생성
├── commit-msg                          ← 생성
└── pre-push                            ← 생성

scripts/
└── auto-fix/
    ├── check-scope.ts                  ← 생성 (거부 범위 가드)
    └── README.md                       ← 생성 (스크립트 사용법)

docs/
└── auto-fix-log/
    └── .gitkeep                        ← 생성 (디렉토리만 커밋)

루트/
├── commitlint.config.cjs               ← 생성
├── .lintstagedrc.cjs                   ← 생성
└── package.json                        ← 수정 (scripts, devDependencies, prepare 훅)
```

---

## 2. 정책 단일 출처: `.claude/policies/auto-fix-scope.md`

이 파일은 L1(로컬 명령), L2(sub-agent), L3(CI 봇 — 8-2에서 추가)가 **모두 참조**하는 단일 출처. 룰 변경은 이 파일 수정으로만 한다.

### 2-1. 파일 본문

```markdown
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

**/\*.test.ts
**/_.test.tsx
\*\*/_.spec.ts
**/\*.spec.tsx
**/**tests**/\*\*
**/tests/**

# DB / 백엔드 핵심

supabase/migrations/**
supabase/functions/**

# 인증 / 보안 (8-2에서 추가될 인증 코드 미리 차단)

packages/shared/src/services/auth/\*\*
**/auth/**

# 환경변수

.env
.env.\*
!.env.example

# 의존성 / 빌드 설정

package.json
pnpm-lock.yaml
**/next.config.\*
**/vite.config._
tsconfig.json
tsconfig._.json \*_/tailwind.config._

# CI 자체

.github/workflows/**
.husky/**

# 정책 자체 (자기 자신 수정 금지)

.claude/policies/\*\*

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
```

### 2-2. 정책 파일을 단일 출처로 만드는 이유

같은 룰을 L1/L2/L3 세 군데 따로 적으면 한 곳 바꿀 때 다른 곳 까먹어서 사고난다. 한 파일에 두고 모두 참조하면 룰 일관성 보장 + 면접 시 "왜 이렇게 분리했는가?"에 대한 답변 가능.

---

## 3. PR CI: `.github/workflows/ci.yml`

### 3-1. 파일 본문

```yaml
name: CI

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

# 같은 PR에 새 push 들어오면 이전 실행 취소
concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  verify:
    name: Verify (lint/typecheck/test/build)
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup pnpm
        uses: pnpm/action-setup@v4
        with:
          version: 9

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'pnpm'

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm lint

      - name: Typecheck
        run: pnpm typecheck

      - name: Test
        run: pnpm test

      - name: Build
        env:
          # CI에서 빌드 통과를 위한 더미 환경변수
          # 실제 값은 Vercel에서 주입됨
          VITE_SUPABASE_URL: https://dummy.supabase.co
          VITE_SUPABASE_ANON_KEY: dummy-anon-key-for-ci-build-only
        run: pnpm build
```

### 3-2. 왜 이렇게 짰는지

- **`concurrency`**: 같은 PR에 push 여러 번 하면 이전 CI는 취소. 비용 절약 + 결과 깔끔
- **`pull_request` + `push to main` 두 트리거**: PR에선 머지 전 검증, main 푸시는 머지 후 회귀 검증 (squash 머지 후 main에서 한 번 더 돔)
- **`cache: 'pnpm'`**: 첫 실행 후 의존성 설치가 30초 → 5초로 단축
- **`--frozen-lockfile`**: lockfile 안 맞춘 PR 거부
- **`timeout-minutes: 15`**: 빌드가 길어지는 경우 무한 대기 방지
- **빌드용 더미 환경변수**: 클라이언트 빌드는 환경변수가 없으면 실패. 실제 값은 노출 위험이 있어 더미값 사용 (서버 호출은 빌드 시점에 일어나지 않으므로 안전)
- **단일 job (병렬 step)**: 모노레포 규모상 병렬 job으로 나누는 이득보다 캐시 공유 이득이 크다. 추후 필요시 분할

### 3-3. 잠재 문제점 / 후속 조치

- **첫 실행 시 분명 한 번은 깨진다**: 로컬과 CI 환경의 차이(시간대, locale, EOL)로 lint/test 깨질 수 있음. 첫 PR을 의도적으로 만들어 통과시키는 작업이 필요
- **typecheck 스크립트 미정의**: 현재 루트 `package.json`에 `typecheck` 스크립트가 있는지 확인 필요. 없으면 §6에서 추가
- **Build 시 service_role 키 등 시크릿이 필요한 경우**: 현재 단계엔 없음. 7단계의 Edge Function은 서버 빌드라 클라 빌드와 무관

### 3-4. 브랜치 보호 룰 (수동 설정 가이드)

CI workflow를 추가한 후 GitHub repo Settings → Branches → main에 룰 추가:

**필수 (1인 개발자도 적용):**

```
✅ Require a pull request before merging
✅ Require status checks to pass before merging
   ✅ Require branches to be up to date before merging
   ✅ Status checks: "Verify (lint/typecheck/test/build)" 선택
✅ Require conversation resolution before merging
```

**선택 (협업자 생기거나 외부 리뷰 받을 때 활성):**

```
☐ Require approvals: 1
   → 1인 개발 시 본인이 본인 PR을 approve할 수 없으므로 비활성
   → MVP 출시 후 외부 리뷰어 합류 시 활성화
☐ Do not allow bypassing the above settings
   → 본인이 admin이면 보호 룰을 우회할 수 있어 의미 약함
   → 협업자 합류 시 활성화
```

이걸 안 켜면 CI가 빨갛게 떠도 머지 가능 → CI 의미 없음.

이 설정은 코드로 관리할 수 없는 부분이라 수동 설정. 설정 후 STATUS.md에 다음을 기록:

```
브랜치 보호 룰 활성 ✅
- PR 경유 필수, CI 통과 필수, 대화 해결 필수
- approval 1명 필수: 비활성 (1인 운영, MVP 후 활성 예정)
- 우회 금지: 비활성 (admin self-bypass 허용)
```

**플랜/레포 제한 명시:**
GitHub 플랜(Free vs Pro vs Team)이나 repo 가시성(public/private)에 따라 일부 enforcement가 제한될 수 있다. 룰 적용이 불가능한 항목이 발견되면 STATUS.md에 제한 사항을 그대로 기록한다.

---

## 4. 커밋훅: Husky + lint-staged + commitlint

### 4-1. 의존성 설치

```bash
pnpm add -Dw \
  husky \
  lint-staged \
  @commitlint/cli \
  @commitlint/config-conventional \
  tsx
```

> `tsx`는 §7의 `check-scope.ts` 실행에 필요. 이미 프로젝트에 깔려 있다면 생략.

### 4-2. `package.json` 수정 (루트)

```json
{
  "packageManager": "pnpm@9.15.4",
  "scripts": {
    "prepare": "husky",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "build": "turbo run build",
    "verify": "pnpm lint && pnpm typecheck && pnpm test && pnpm build",
    "verify:fast": "pnpm lint && pnpm typecheck",
    "auto-fix:check-scope": "tsx scripts/auto-fix/check-scope.ts"
  }
}
```

> ⚠️ `packageManager` 값(`pnpm@9.15.4`)은 **예시**다. 구현 시점에 사용 중인 실제 pnpm 버전으로 고정해야 한다.
> 확인 명령: `pnpm --version`. 로컬이 pnpm 10이면 `pnpm@10.x.x`, 9면 `pnpm@9.x.x`로 정확한 patch 버전까지 명시한다.
> Corepack이 `packageManager` 필드를 읽어 CI에서 동일 버전을 자동 사용하므로, "9.x.x" 같은 와일드카드는 의도와 다르게 동작할 수 있다.

**왜 이 스크립트들:**

- `packageManager`: 로컬 pnpm 버전과 CI pnpm 버전을 정확히 고정 (Corepack이 읽음). placeholder가 아닌 **실제 사용 중인 patch 버전까지 명시** (예: `pnpm@9.15.4`)
- `prepare`: `pnpm install` 실행 시 husky가 자동 설치되어 새 환경에서도 훅이 자동으로 작동
- `verify`: 4종 검증을 순차 실행. CI와 동일한 명령. 로컬 사전 검증용
- `verify:fast`: lint + typecheck만 (test/build 제외). pre-push 훅에서 사용
- `auto-fix:check-scope`: L1/L3에서 호출하는 거부 범위 가드

**Vitest watch mode 차단 (확정 전략):**

Vitest는 `process.env.CI` 또는 비TTY 환경에서는 자동으로 run 모드로 동작. 따라서 GitHub Actions에서는 `pnpm test`만으로도 watch에 갇히지 않는다.

다만 **로컬에서 Claude Code/AI 에이전트가 `pnpm test`를 호출하면 TTY로 인식되어 watch 모드 진입 위험**이 있다. 이를 방지하기 위해 다음 전략을 **확정**으로 채택:

**[확정] 각 패키지에서 `vitest run`을 직접 명시.**

```json
// 루트 package.json
{
  "scripts": {
    "test": "turbo run test"
  }
}
```

```json
// packages/shared/package.json (예시, 모든 vitest 사용 패키지에 동일 적용)
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

**이유:**

- watch 모드 진입 위험을 패키지 레벨에서 결정적으로 차단
- 인터랙티브 watch가 필요할 땐 `pnpm --filter <pkg> test:watch` 사용
- turbo의 `--` 인자 전달은 환경에 따라 매끄럽지 않아 백업안으로만 두고 채택 안 함
- 8-1 구현 시 모든 vitest 사용 패키지를 일괄 변환 (체크리스트 항목으로 추가)

### 4-3. `.husky/pre-commit`

```sh
pnpm exec lint-staged
```

> **Husky v9 권장 작성 방식**: hook 파일에는 실행할 명령만 적는다.
> 구버전(v8 이하)에서 사용했던 `#!/usr/bin/env sh` shebang과 `. "$(dirname -- "$0")/_/husky.sh"` sourcing 라인은 **deprecated**되어 사용하지 않는다 (Husky v9에서 자동 제거되거나 commit-msg 훅이 스킵되는 문제 발생).

**역할:** 변경 파일에만 prettier/eslint --fix 적용. 1초 미만에 끝남.

### 4-4. `.husky/commit-msg`

```sh
pnpm exec commitlint --edit "$1"
```

**역할:** Conventional Commits 형식 강제 (`feat(scope): subject`).

### 4-5. `.husky/pre-push`

```sh
pnpm verify:fast || {
  echo ""
  echo "❌ pre-push 검증 실패. CI에서도 실패할 가능성이 높습니다."
  echo "   --no-verify로 우회 가능하지만 권장하지 않음."
  exit 1
}
```

**역할:** push 전에 lint + typecheck 실행 (verify:fast). test/build는 너무 느려서 제외하고 CI에 맡김.

### 4-6. `commitlint.config.cjs`

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    // 8단계에선 scope 강제 안 함 (1인 프로젝트 효율 우선)
    // 'scope-empty': [2, 'never'],
    'subject-case': [2, 'never', ['sentence-case', 'start-case', 'pascal-case', 'upper-case']],
    'subject-empty': [2, 'never'],
    'header-max-length': [2, 'always', 100],
  },
}
```

**왜 이렇게:**

- `subject-case`: 주어가 대문자로 시작하는 거 금지 (Conventional Commits 표준)
- `subject-empty`: 빈 subject 금지
- `header-max-length 100`: 한국어 + 영어 혼용 시 100자 정도 여유 필요
- scope 강제는 보류: 1인 개발자가 본인 룰 어길 때 짜증 → MVP 후 강제로 변경 검토

### 4-7. `.lintstagedrc.cjs`

```javascript
module.exports = {
  '*.{ts,tsx,js,jsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,md,yml,yaml,css}': ['prettier --write'],
}
```

**왜:**

- 변경 파일만 처리 → 1초 이하
- ts/tsx는 eslint --fix 후 prettier --write (eslint 결과를 prettier가 다시 정리)
- 다른 파일은 prettier만

### 4-8. 커밋훅 설치 검증

설치 후 다음으로 동작 확인:

```bash
# 일부러 형식 깨고 커밋 시도
echo "const x  =  1;" > /tmp/test.ts  # 잘못된 포맷
# (실제 프로젝트 파일에서 테스트)

git add somefile.ts
git commit -m "lol"  # commitlint 실패해야 함

# 올바른 메시지로 재시도
git commit -m "test: verify commitlint works"  # 통과
```

---

## 5. L1: 로컬 자동 교정 루프 — `.claude/commands/auto-fix.md`

### 5-1. 파일 본문

````markdown
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
````

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

````

### 5-2. 왜 이렇게 짰는지

- **3회 제한**: 에이전트 루프의 가장 큰 위험은 무한 루프 + 토큰 폭주 + 코드 누더기화. "3회 안에 못 고치면 사람 의견 필요한 문제"라는 경험적 판단
- **에러 분류 강제**: 기계적/판단/환경을 명시적으로 분류해야 위험한 수정 차단 가능
- **`auto-fixer` 위임**: 메인 세션은 코드 짜는 컨텍스트라 "최소 변경 원칙"이 흐려짐. 격리된 sub-agent에 위임해야 룰 강화 가능
- **로그 누적**: 디버깅 + 면접에서 "AI가 어떻게 작업했는지 추적 가능합니다" 어필 자료
- **거부 범위 가드는 코드 호출**: LLM이 "이건 *.test.ts지만 별일 아닌 것 같아요" 같은 판단을 못 하게, 결정적 스크립트로 1차 차단

### 5-3. 잠재 문제점

- **`pnpm verify`가 너무 느린 경우**: typecheck까지 30초+ 걸리면 루프 1회당 1분+ 소요. 3회면 3분+. → 첫 실행에서 시간 측정 후 너무 느리면 `verify:fast` 사용 옵션 검토
- **테스트 무력화 시도**: 테스트 실패 시 LLM이 "테스트가 잘못된 것 같다"며 테스트 수정 시도 가능. 정책 §2-1에서 명시적 차단했지만 추가로 auto-fixer 프롬프트에서도 강조 필요 (§6에서 처리)

---

## 6. L2 핵심 sub-agent 2종

### 6-1. `spec-reviewer.md` 보강 (기존 파일 수정)

기존 `spec-reviewer`에 **컴포넌트 설계 검토 섹션**을 추가한다 (별도 `component-design-reviewer` 만들지 않고 흡수).

**기존 파일 끝부분에 다음 섹션 추가:**

```markdown
## 컴포넌트 설계 검토 (8단계 추가)

스펙 ↔ 구현 비교 시 다음 컴포넌트 품질 항목도 함께 검토:

### Props 인터페이스
- [ ] props 개수가 10개 이하인가? (10개 초과 → 책임 분리 필요)
- [ ] boolean props가 5개 이하인가? (5개 초과 → 상태 머신/유니온 타입으로 표현 검토)
- [ ] 모든 props에 의미 있는 이름과 타입이 있는가?
- [ ] optional props에 합리적 기본값이 있는가?

### 책임 분리
- [ ] 한 컴포넌트가 fetch + 상태관리 + 렌더링을 모두 하지 않는가?
- [ ] features/{도메인}/ 안의 책임 분리(hook/component/api)가 지켜지는가?
- [ ] presentational vs container 구분이 명확한가?

### 재사용성
- [ ] 같은 패턴이 3번 이상 반복되면 추상화되었는가?
- [ ] shared/ 또는 components/ui/로 승격 가능한 컴포넌트가 features/에 갇혀 있지 않은가?

### 검토 결과 형식
스펙 일치성 검토 결과 뒤에 다음 섹션 추가:

````

## 컴포넌트 설계

- 🔴 즉시 수정: {파일:라인} {문제} {수정 제안}
- 🟡 개선 여지: {파일:라인} {문제} {수정 제안}
- 🟢 양호: 모든 컴포넌트가 단일 책임 / 적절한 인터페이스

```

```

### 6-2. `auto-fixer.md` (신규 생성)

````markdown
---
name: auto-fixer
description: 빌드/lint/typecheck/test 실패 시 격리된 컨텍스트에서 최소 변경으로 수정합니다. 메인 컨텍스트와 격리되어 동작.
tools: Read, Edit, Bash, Grep, Glob
---

# auto-fixer

너는 빌드 엔지니어다. 검증 실패 로그를 받아서 **최소 변경**으로 통과시키는 게 임무.

## 정책 출처

`.claude/policies/auto-fix-scope.md`

이 파일을 매번 읽고 룰을 확인한 후 작업한다.

## 절대 원칙

1. **최소 변경**: 1개 수정 = 1개 문제. 다른 리팩터링 절대 금지
2. **테스트 약화 금지**: expect 제거, .skip()/.todo()/.only() 추가, assertion 완화 → 절대 X
3. **새 의존성 추가 금지**: `package.json`, `pnpm-lock.yaml` 수정 금지 (사람 결정 필요)
4. **마이그레이션 수정 금지**: `supabase/migrations/**` 수정 금지
5. **거부 범위 절대 준수**: 정책 §2-1 경로는 손대지 않는다
6. **휴리스틱 차단 패턴 금지**: 정책 §2-2의 패턴(`as any`, `// @ts-ignore` 등) 추가 금지

## 입력 (메인 세션이 전달)

- 실패한 명령 (예: `pnpm typecheck`)
- stderr/stdout 전문
- 영향 파일 경로 목록
- (선택) 시도 횟수 / 이전 시도 이력

## 작업 순서

### 1. 정책 확인

`.claude/policies/auto-fix-scope.md` 읽고 현재 정책 룰 파악

### 2. 거부 범위 사전 체크

영향 파일이 §2-1 경로에 해당하면:

- 즉시 중단
- "거부 범위 파일이 영향 받음. 사람 개입 필요" 보고

### 3. 에러 분석

- 어떤 종류의 에러인가?
  - lint: ESLint 룰 위반
  - typecheck: TypeScript 타입 에러
  - test: 단위 테스트 실패 (이 경우 매우 신중)
  - build: 컴파일/번들링 실패
- 진짜 코드 문제인가, 아니면 환경/설정 문제인가?
  - 환경/설정 문제면 즉시 중단

### 4. 최소 변경 patch 작성

- 영향 파일 1개씩 처리
- 한 파일에서 여러 에러가 있으면 묶어서 처리
- 변경 의도 명시 (커밋 메시지 형태)

### 5. 출력

```markdown
## auto-fixer 결과

### 분류

- 에러 종류: {lint|typecheck|test|build}
- 분류: {기계적|판단|거부}
- 영향 파일: {경로 목록}

### 변경 사항

파일별 diff 요약 + 변경 의도

### 검증

- 거부 범위 위반: ❌ 없음 / ✅ 있음 (있으면 중단 사유)
- 휴리스틱 패턴 위반: ❌ 없음 / ✅ 있음
- 변경된 파일이 정책 통과 기준 만족 가능 추정: ✅/❌

### 사람 검토 필요 항목

- (있으면 명시. 없으면 "없음")
```
````

## 거부 사례 (이런 수정은 절대 만들지 않음)

### 잘못된 예 1: 테스트 약화로 통과시키기

```diff
- expect(result).toBe(42);
+ expect(result).toBeDefined();
```

### 잘못된 예 2: any로 타입 에러 회피

```diff
- const data: User = response.json();
+ const data = response.json() as any;
```

### 잘못된 예 3: ts-ignore로 회피

```diff
+ // @ts-ignore
  someComplexCall();
```

이런 패턴이 검출되면 절대 출력하지 않는다.

## 한계 표명

다음 경우엔 명확히 "할 수 없음" 표명하고 사람 호출:

- 비즈니스 로직 버그 (스펙 해석 필요)
- 새 의존성이 필요한 수정
- 거부 범위 파일을 건드려야 하는 수정
- 3회 이상 같은 에러가 다른 위치에서 반복되는 경우

````

### 6-3. 왜 이렇게 짰는지

- **거부 범위 가드를 두 번**: 코드(`check-scope.ts`) + 에이전트 프롬프트 양쪽에서 검증. 한 곳 빠져도 다른 곳에서 잡힘
- **명시적 거부 사례**: "이렇게는 절대 하지 마"의 negative example을 명시. 추상적 룰만 있으면 LLM이 슬쩍 우회 가능
- **출력 형식 고정**: 메인 세션이 결과를 파싱하기 쉽도록 마크다운 섹션 고정
- **한계 표명 강조**: "할 수 없음"을 명확히 하는 게 잘못 시도하는 것보다 안전

### 6-4. 잠재 문제점

- **메인 세션의 `auto-fixer` 호출 누락**: `/auto-fix` 명령에서 `auto-fixer`를 호출하도록 §5에서 명시했지만, 실제 사용 시 메인 세션이 직접 수정하려는 유혹이 있을 수 있음. 정책 파일에 다시 한 번 명시 필요

---

## 7. 거부 범위 가드 스크립트: `scripts/auto-fix/check-scope.ts`

### 7-1. 파일 본문

```typescript
#!/usr/bin/env tsx
/**
 * 거부 범위 가드 스크립트
 *
 * 사용처:
 * - L1 (/auto-fix 명령) — 매 수정 후 호출
 * - L3 (auto-fix-bot.yml, 8-2에서 추가) — patch 적용 후 호출
 *
 * 정책 출처: .claude/policies/auto-fix-scope.md
 *
 * 동작: git status로 변경 파일 목록을 가져와서 거부 패턴과 매칭.
 * 거부 범위 파일이 변경되었으면 exit 1, 아니면 exit 0.
 */

import { execSync } from 'node:child_process';

// 거부 경로 패턴 (정책 §2-1)
const DENIED_PATH_PATTERNS = [
  // 테스트 코드:
  //   /auto-fix와 auto-fixer(LLM 의미적 수정)에 대해서는 전부 차단.
  //   pre-commit lint-staged의 deterministic 포맷팅(prettier --write, eslint --fix)은
  //   이 스크립트를 거치지 않으므로 정책 §2-1의 예외 그대로 허용됨.
  //   즉 이 패턴은 "LLM 자동 수정 차단" 전용이지 "포맷팅 차단"이 아님.
  /\.(test|spec)\.(ts|tsx)$/,
  /\/__tests__\//,
  /\/tests\//,
  // DB / 백엔드 핵심
  /^supabase\/migrations\//,
  /^supabase\/functions\//,
  // 인증 / 보안 (9단계에서 추가될 인증 코드 미리 차단)
  /^packages\/shared\/src\/services\/auth\//,
  /\/auth\//,
  // 환경변수
  /^\.env(\.|$)/,
  // 의존성 / 빌드 설정
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /next\.config\./,
  /vite\.config\./,
  /^tsconfig(\..*)?\.json$/,
  /tailwind\.config\./,
  // CI / 훅
  /^\.github\/workflows\//,
  /^\.husky\//,
  // 정책 자체
  /^\.claude\/policies\//,
];

// .env.example은 허용
const ALLOWED_OVERRIDES = [/^\.env\.example$/];

// 거부 패턴 (정책 §2-2)
const DENIED_DIFF_PATTERNS = [
  { pattern: /-\s*expect\(/, name: 'expect() 제거' },
  { pattern: /\+\s*\.skip\(/, name: '.skip() 추가' },
  { pattern: /\+\s*\.todo\(/, name: '.todo() 추가' },
  { pattern: /\+\s*\.only\(/, name: '.only() 추가' },
  { pattern: /\+.*as\s+any\b/, name: 'as any 추가' },
  { pattern: /\+.*as\s+unknown\s+as\b/, name: 'as unknown as 추가' },
  { pattern: /\+\s*\/\/\s*@ts-ignore/, name: '@ts-ignore 추가' },
  { pattern: /\+\s*\/\/\s*@ts-expect-error/, name: '@ts-expect-error 추가' },
  { pattern: /\+.*eslint-disable/, name: 'eslint-disable 추가 (라인/블록/파일 단위 모두)' },
  { pattern: /-\s*.*console\.error\(/, name: 'console.error 호출 제거' },
  { pattern: /-\s*.*logger\.error\(/, name: 'logger.error 호출 제거' },
  { pattern: /\+.*dangerouslySetInnerHTML/, name: 'dangerouslySetInnerHTML 추가' },
  { pattern: /\+.*\beval\(/, name: 'eval() 사용' },
  { pattern: /\+.*new\s+Function\(/, name: 'new Function() 사용' },
];

interface Violation {
  type: 'path' | 'pattern';
  detail: string;
  file?: string;
}

function getChangedFiles(): string[] {
  try {
    // staged + unstaged 둘 다 검사
    const stagedOutput = execSync('git diff --cached --name-only', {
      encoding: 'utf-8',
    });
    const unstagedOutput = execSync('git diff --name-only', {
      encoding: 'utf-8',
    });
    const all = [...stagedOutput.split('\n'), ...unstagedOutput.split('\n')];
    return [...new Set(all.filter(Boolean))];
  } catch (e) {
    console.error('git diff 실행 실패:', e);
    process.exit(2);
  }
}

function getDiffContent(): string {
  try {
    const staged = execSync('git diff --cached', { encoding: 'utf-8' });
    const unstaged = execSync('git diff', { encoding: 'utf-8' });
    return staged + '\n' + unstaged;
  } catch (e) {
    console.error('git diff 내용 조회 실패:', e);
    process.exit(2);
  }
}

function checkPath(file: string): Violation | null {
  // 허용 오버라이드 먼저 체크
  if (ALLOWED_OVERRIDES.some((re) => re.test(file))) return null;

  for (const pattern of DENIED_PATH_PATTERNS) {
    if (pattern.test(file)) {
      return {
        type: 'path',
        file,
        detail: `거부 경로 매치: ${pattern}`,
      };
    }
  }
  return null;
}

function checkDiffPatterns(diff: string): Violation[] {
  const violations: Violation[] = [];
  for (const { pattern, name } of DENIED_DIFF_PATTERNS) {
    if (pattern.test(diff)) {
      violations.push({
        type: 'pattern',
        detail: name,
      });
    }
  }
  return violations;
}

function main() {
  const changedFiles = getChangedFiles();
  const diff = getDiffContent();

  const violations: Violation[] = [];

  for (const file of changedFiles) {
    const v = checkPath(file);
    if (v) violations.push(v);
  }

  violations.push(...checkDiffPatterns(diff));

  if (violations.length === 0) {
    console.log('✅ 거부 범위 가드 통과');
    process.exit(0);
  }

  console.error('❌ 거부 범위 위반 발견:');
  for (const v of violations) {
    if (v.type === 'path') {
      console.error(`  - 경로: ${v.file} (${v.detail})`);
    } else {
      console.error(`  - 패턴: ${v.detail}`);
    }
  }
  console.error('');
  console.error('정책: .claude/policies/auto-fix-scope.md §2');
  console.error('이 변경은 사람의 명시적 승인이 필요합니다.');
  process.exit(1);
}

main();
````

### 7-2. 왜 이렇게 짰는지

- **결정적 검증**: 정규식 매칭만 사용. LLM 호출 없음 → 항상 같은 입력에 같은 결과
- **두 단계 검증**: 경로 매칭 + 패치 내용 매칭. 둘 다 위반해야 안전
- **`git diff --cached` + `git diff`**: staged + unstaged 모두 검사 (커밋 직전이든 적용 직후든 사용 가능)
- **exit code 분리**: 0=통과, 1=위반, 2=실행 실패. CI에서 다르게 처리 가능
- **TS로 작성**: shell script보다 유지보수 좋음. 이미 프로젝트에 tsx 설치됨

### 7-3. 호출 방식

```bash
# 단독 실행
pnpm auto-fix:check-scope

# /auto-fix 루프 안에서 자동 호출
pnpm exec tsx scripts/auto-fix/check-scope.ts && pnpm verify
```

### 7-4. 잠재 문제점

- **정규식 false positive**: 정상 코드에서도 `as any`가 필요한 경우(외부 라이브러리 타입 한계)가 있을 수 있음. 그땐 사람이 별도 PR로 처리하면 됨 — 자동 수정 영역이 아니니 정당한 차단
- **diff 크기가 크면 매칭이 느림**: 보통은 문제 없으나 거대 PR에서 성능 이슈 가능. 8-2에서 L3 봇 만들 때 측정

### 7-5. `scripts/auto-fix/README.md`

````markdown
# scripts/auto-fix/

자동 교정 시스템(L1/L2/L3) 보조 스크립트.

## check-scope.ts

거부 범위 가드. 변경 파일/diff가 정책 §2의 금지 범위에 해당하는지 결정적 검증.

### 사용

```bash
pnpm auto-fix:check-scope
```
````

- exit 0: 통과
- exit 1: 위반 (사람 검토 필요)
- exit 2: 스크립트 실행 실패

### 호출처

- `.claude/commands/auto-fix.md` (L1, 매 수정 후)
- `.github/workflows/auto-fix-bot.yml` (L3, 8-2에서 추가)

```

---

## 8. 자동수정 이력 디렉토리

### 8-1. `docs/auto-fix-log/`

```

docs/auto-fix-log/
└── .gitkeep # 디렉토리 자체를 git에 커밋

```

`.gitkeep`은 빈 파일. 디렉토리만 만들고 실제 로그는 `/auto-fix` 실행 시 누적.

### 8-2. 로그 형식

`/auto-fix` 명령이 다음 형식으로 자동 생성:

```

docs/auto-fix-log/2026-04-28-1530.md

```

내용은 §5-1 출력 형식 참조.

### 8-3. 누적 가치

- 디버깅: "이 패턴 에러가 자주 났구나" 파악
- 면접: "AI 자동 수정이 어떻게 작동했는지 이력으로 추적 가능합니다"
- 8-2 운영: L3 봇이 동일 PR에 시도 횟수를 카운트할 때 참조 가능 (구현 검토)

### 8-4. 저장 정책

8-1에서는 `docs/auto-fix-log/`를 git에 커밋한다.

**향후 정책 (MVP 출시 후 재검토):**
- 로그가 100개 이상 누적되어 git history가 비대해지면 `.gitignore` 처리 검토
- 또는 월별/분기별 archive 디렉토리(`docs/auto-fix-log/archive/2026Q2/`)로 이동 후 git에서 제거
- 패턴 분석 후에는 raw 로그보다 통계 요약(`docs/auto-fix-log/SUMMARY.md`)만 유지

---

## 9. ADR (이 단계의 핵심 의사결정)

### ADR-023: 정책 단일 출처

**결정**: `.claude/policies/auto-fix-scope.md`를 단일 출처로 하고, L1/L2/L3 모두 이 파일을 참조.

**대안과 트레이드오프**:
- (대안 A) 각 시스템에 룰 복사 → 변경 시 동기화 누락 위험
- (대안 B) 단일 출처 (채택) → 변경이 한 곳에서 끝남. 다만 파일을 안 읽으면 의미 없음 → 시스템마다 "정책 출처" 명시
- (대안 C) 코드 상수로 관리 → 시스템마다 import 필요. .claude는 마크다운 위주 환경이라 부적합

**근거**: 1인 운영 환경에서 룰 분기 관리는 불가능에 가깝다. 단일 출처가 현실적.

### ADR-024: 거부 범위 가드는 코드, 의미 분석은 에이전트

**결정**: 결정적 검증(거부 경로/패턴)은 `check-scope.ts`로, 의미 분석(보안/품질)은 sub-agent로 분리.

**대안과 트레이드오프**:
- (대안 A) 모두 sub-agent로 → LLM의 비결정성으로 가끔 거부 범위 놓침
- (대안 B) 모두 코드로 → 의미 분석 불가능
- (대안 C) 코드 + 에이전트 분리 (채택) → 책임 명확, 안전성 + 깊이 둘 다 확보

**근거**: 보안/안전 가드는 결정적이어야 한다. LLM 판단은 의미 영역에서만 가치 있다.

### ADR-025: pre-commit/pre-push 분리

**결정**: pre-commit은 1초 미만 검증만, pre-push에서 typecheck + lint 한 번 더.

**대안과 트레이드오프**:
- (대안 A) pre-commit에 모든 검증 → 사람이 `--no-verify`로 우회 시작
- (대안 B) pre-push에 모든 검증 → 커밋 단계에서 잘못된 포맷이 통과
- (대안 C) 분리 (채택) → 빠른 피드백(commit) + 안전망(push) 균형

**근거**: 1초 룰을 깨면 무력화된다. 실측 결과 lint-staged는 항상 1초 미만.

### ADR-026: commitlint scope는 8단계에선 강제 안 함

**결정**: type(feat/fix/refactor/...)과 subject 형식만 강제. scope 누락 허용.

**대안과 트레이드오프**:
- (대안 A) scope 강제 → 1인 개발 시 작은 커밋에서 짜증, `--no-verify` 시작
- (대안 B) scope 권장만 (채택) → 자유도 유지, MVP 출시 후 강제로 변경 검토

**근거**: 강제 룰이 무력화되면 룰이 없는 것보다 나쁨. 단계적 도입.

### ADR-027: test-writer 에이전트 미도입

**결정**: 자동 테스트 작성 에이전트(test-writer)를 만들지 않음.

**대안과 트레이드오프**:
- (대안 A) test-writer 도입 → 트리비얼 테스트만 양산 + 코드에 맞춘 테스트 (역방향 TDD) 위험
- (대안 B) 미도입 (채택) → 테스트는 메인 세션 또는 사람이 직접 작성

**근거**: 테스트는 "코드가 무엇을 보장하는가"의 정의. LLM이 코드 컨텍스트 없이 짜면 가짜 안전감만 생성.

---

## 10. 검증 체크리스트 (요약)

상세는 `08-1-verify.md`에서 다룸. 핵심만 미리 명시:

- [ ] `.claude/policies/auto-fix-scope.md` 존재하고 §0 적용 범위 + §1, §2, §5 모두 명시
- [ ] `.github/workflows/ci.yml` 존재 및 PR에서 자동 트리거
- [ ] CI가 lint/typecheck/test/build 4단계 모두 실행 (단일 job 순차)
- [ ] 브랜치 보호 룰 활성: PR 경유 / CI 통과 / 대화 해결 (approval 1명은 1인 운영 시 비활성, STATUS.md에 기록)
- [ ] `package.json`에 `packageManager` 필드로 pnpm 버전 고정 (placeholder 아닌 실제 patch 버전, 예: `pnpm@9.15.4`)
- [ ] vitest 사용 모든 패키지의 `package.json`에서 `"test": "vitest run"`으로 변경 (일괄 변환), 인터랙티브 watch 필요 시 `"test:watch": "vitest"` 분리
- [ ] `.husky/pre-commit`, `commit-msg`, `pre-push` 모두 존재 (Husky v9 문법, shebang/sourcing 라인 없음)
- [ ] `.lintstagedrc.cjs`, `commitlint.config.cjs` 존재
- [ ] `pnpm verify`, `pnpm verify:fast`, `pnpm auto-fix:check-scope` 스크립트 동작
- [ ] `.claude/commands/auto-fix.md` 존재 및 §0 사전 가드(clean tree, main 금지) 포함
- [ ] `.claude/agents/auto-fixer.md` 존재
- [ ] `.claude/agents/spec-reviewer.md`에 컴포넌트 설계 섹션 추가됨
- [ ] `scripts/auto-fix/check-scope.ts` 존재 및 단독 실행 가능 (unused import 없음)
- [ ] `docs/auto-fix-log/.gitkeep` 존재
- [ ] 의도적 lint 에러 → `/auto-fix` → 자동 통과 시나리오 1회 검증 (feature branch에서)
- [ ] 의도적 거부 범위 변경(예: package.json 수정) → check-scope.ts가 차단
- [ ] 의도적 휴리스틱 위반(예: `as any` 추가) → check-scope.ts가 차단
- [ ] dirty working tree 상태에서 `/auto-fix` 호출 → 즉시 중단됨
- [ ] main 브랜치에서 `/auto-fix` 호출 → 즉시 중단됨
- [ ] 잘못된 commit 메시지(예: "lol") → commitlint가 차단
- [ ] 첫 PR이 CI 통과하여 머지됨

---

## 11. 다음 단계 (8-2 진입 조건)

위 체크리스트의 모든 항목이 ✅이고 STATUS.md에 다음이 기록되면 8-2 시작:

```

8-1 완료

- PR CI 작동 확인 (PR #N에서 통과)
- 커밋훅 3종 동작 확인
- /auto-fix 로컬 명령 동작 확인 (자동 통과 시나리오 1회)
- 정책 파일 단일 출처 확립
- auto-fixer 에이전트 호출 확인
- 브랜치 보호 룰 활성

```

8-2에서는 위 기반 위에:
- 추가 sub-agent 6종 (security-auditor, pr-summarizer, ux-state-reviewer, web-a11y-reviewer, native-a11y-reviewer, perf-budget-reviewer)
- L3 CI 자율 봇 (드라이런 → apply 모드)
- 부가 도구 (Dependabot, Gitleaks, eslint-plugin-jsx-a11y)
- 운영 가이드 + 면접 카드 정리

를 추가한다.

---
```
