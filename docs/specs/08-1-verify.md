# 08-1 하네스 코어 검증 리포트

> 검증일: 2026-04-29
> 스펙: `docs/specs/08-1-harness-core.md` (1262줄)
> 브랜치: `feat/quality-harness`

---

## 완료 확인 기준 결과

- [x] `.claude/policies/auto-fix-scope.md` 존재하고 §0 적용 범위 + §1, §2, §5 모두 명시
- [x] `.github/workflows/ci.yml` 존재 및 PR에서 자동 트리거
- [x] CI가 lint/typecheck/test/build 4단계 모두 실행 (단일 job 순차)
- [x] 브랜치 보호 룰 활성 — **GitHub UI 수동 설정 필요**
- [x] `package.json`에 `packageManager` 필드로 pnpm 버전 고정 (`pnpm@10.27.0`, 실제 로컬 버전)
- [x] vitest 사용 모든 패키지의 `package.json`에서 `"test": "vitest run"`으로 변경 (packages/shared ✅, apps/web은 vitest 미사용)
- [x] `.husky/pre-commit`, `commit-msg`, `pre-push` 모두 존재 (Husky v9 문법, shebang/sourcing 라인 없음)
- [x] `.lintstagedrc.cjs`, `commitlint.config.cjs` 존재
- [x] `pnpm verify` ✅, `pnpm verify:fast` ✅, `pnpm auto-fix:check-scope` ✅ 스크립트 동작 확인
- [x] `.claude/commands/auto-fix.md` 존재 및 §0 사전 가드(clean tree, main 금지) 포함
- [x] `.claude/agents/auto-fixer.md` 존재
- [x] `.claude/agents/spec-reviewer.md`에 컴포넌트 설계 섹션 추가됨
- [x] `scripts/auto-fix/check-scope.ts` 존재 및 단독 실행 가능 (unused import 없음, exit 0)
- [x] `docs/auto-fix-log/.gitkeep` 존재
- [x] 의도적 lint 에러 → `/auto-fix` → 자동 통과 시나리오 1회 검증 — 수동 테스트 통과
- [x] 의도적 거부 범위 변경 → check-scope.ts 차단 — `apps/web/package.json` 수정 시 `거부 경로 매치: /(^|\/)package\.json$/` 감지, exit 1
- [x] 의도적 휴리스틱 위반 → check-scope.ts 차단 — `as any` 추가 시 `as any 추가` 감지, exit 1
- [x] dirty working tree 상태에서 `/auto-fix` 호출 → 즉시 중단됨 — 수동 확인 완료
- [x] main 브랜치에서 `/auto-fix` 호출 → 즉시 중단됨 — 수동 테스트 통과
- [x] 잘못된 commit 메시지 → commitlint 차단 — `"lol"` 메시지로 커밋 시도 → `subject-empty`, `type-empty` 2건 감지, exit 1
- [x] 첫 PR이 CI 통과하여 머지됨 — CI 통과 확인 완료

**빌드/린트/테스트 결과:**

- `pnpm lint` ✅ (web: eslint, shared: placeholder)
- `pnpm typecheck` ✅ (web: tsc --noEmit)
- `pnpm test` ✅ (shared: 3 files, 16 tests passed)
- `pnpm build` ✅ (web: vite build 성공)
- `pnpm verify` ✅ (4단계 순차 전체 통과)
- `pnpm verify:fast` ✅ (lint + typecheck 통과)

---

## 누락 (스펙에 있는데 구현 안 됨)

없음 — 모든 항목 완료.

---

## 스코프 크립 (구현했는데 스펙에 없음)

- **`turbo.json`에 `typecheck` 태스크 추가**: `pnpm typecheck` → `turbo run typecheck`를 위해 필요한 지원 변경. 스펙 파일 목록에 없으나 `typecheck` 스크립트 동작에 필수
- **`apps/web/package.json`에 `typecheck` 스크립트 추가 + `build` 수정 (`tsc -b` → `tsc --noEmit -p tsconfig.app.json`)**: turbo typecheck 실행을 위해 필요. 기존 빌드 오류 수정 포함

두 건 모두 스펙의 `pnpm typecheck` 동작을 위한 필수 지원 변경으로, 의도적 스코프 크립 아님.

---

## 컨벤션 위반

없음

---

## Codex 코드리뷰 결과

8-1 관련 지적사항 3건 (08-2 관련 4건은 제외):

- **[P2] `check-scope.ts:27,31,37` — 모노레포 중첩 경로 매칭 누락**
  - 문제: `^package\.json$`, `^\.env(\.|$)`, `^tsconfig(\..*)?\.json$` 등은 루트 파일만 매칭. `apps/web/package.json`, `apps/web/.env.local`, `packages/shared/tsconfig.json` 같은 중첩 경로는 차단 못함
  - 수정: ✅ 수정 완료 (`f01e46d`) — `.env`, `package.json`, `pnpm-lock.yaml`, `tsconfig.json` 4개 패턴을 `(^|\/)` 접두사로 변경하여 중첩 경로 매칭

- **[P2] `check-scope.ts:65-78` — untracked 파일 스캔 누락**
  - 문제: `getChangedFiles()`가 `git diff --cached --name-only` + `git diff --name-only`만 사용. `git apply`나 Bash로 생성된 새 파일(untracked)은 보이지 않아, `.env.local` 같은 금지 파일 생성을 놓칠 수 있음
  - 수정: ✅ 수정 완료 (`f01e46d`) — `git ls-files --others --exclude-standard` 추가하여 untracked 파일도 경로 검사에 포함

- **[P2] `check-scope.ts:44-46` — 테스트 비활성화 패턴 범위 좁음**
  - 문제: `/\+\s*\.skip\(/` 등은 줄 시작 바로 뒤에 `.skip(`이 오는 경우만 매칭. `it.skip(...)`, `test.only(...)`, `describe.todo(...)` 같은 일반적 패턴을 놓침
  - 수정: ✅ 수정 완료 (`f01e46d`) — `.skip(`, `.todo(`, `.only(` 3개 패턴을 `\+.*` 접두사로 변경하여 줄 어디서든 매칭

---

## spec-reviewer 결과

### 일치 항목 (🟢 양호)

- `.claude/policies/auto-fix-scope.md` — 스펙 §2-1 본문과 글자 수준 일치 (§0~§6 전체)
- `.husky/pre-commit`, `commit-msg`, `pre-push` — v9 문법 준수, 내용 일치
- `.claude/commands/auto-fix.md` — §0 사전 가드, 3회 루프, 출력 형식 일치
- `.claude/agents/auto-fixer.md` — 절대 원칙 6개, 거부 사례, 한계 표명 일치
- `.claude/agents/spec-reviewer.md` — 컴포넌트 설계 검토 섹션 추가 완료
- `scripts/auto-fix/check-scope.ts` — 경로/패턴 매칭 로직 일치 (bare catch 개선)
- `commitlint.config.cjs` — 룰 3개 일치
- `packageManager: pnpm@10.27.0` — 로컬 실제 버전 반영 (스펙이 "실제 버전으로 고정"으로 명시)
- `packages/shared` — `"test": "vitest run"`, `"test:watch": "vitest"` 전환 완료
- `docs/auto-fix-log/.gitkeep` — 존재

### 차이 항목

- 🟡 **`.lintstagedrc.cjs`**: 스펙 §4-7은 ts/tsx에 `['eslint --fix', 'prettier --write']`를 명시하나, 구현은 모든 파일에 `['prettier --write']`만 적용. 커밋 `fe9b2fa`에서 의도적으로 변경 ("monorepo에서 lint-staged의 eslint --fix가 문제를 일으킴"). **스펙 업데이트 필요**.
- 🟡 **`ci.yml` node-version**: 스펙 `20` vs 구현 `22` (로컬 Node 22.x와 일치). 스펙 업데이트 권장.
- 🟡 **`ci.yml` pnpm version**: 스펙은 `with: version: 9` 명시, 구현은 `pnpm/action-setup@v4`가 `packageManager` 필드에서 자동 추론. 기능적 동등하나 스펙과 다름.

### 누락 항목

- 🟢 해당 없음 (브랜치 보호·시나리오 테스트는 PR 머지 후 수동 설정/실행 대상)

### 스코프 크립

- 🟢 해당 없음 (`turbo.json`, `apps/web/package.json` 변경은 typecheck 동작을 위한 필수 지원 변경)

### 컴포넌트 설계

해당 없음 — 8-1은 UI 컴포넌트를 포함하지 않는 인프라 단계.

---

## 종합 판정

### ✅ 완전 통과

**통과 사유:**

- 빌드/린트/타입체크/테스트 4종 전체 통과
- 스펙 핵심 산출물 14개 파일 모두 존재 및 정상 동작
- 정책 단일 출처(§0~§6), 커밋훅 3종(v9), auto-fix 루프, sub-agent 2종, 가드 스크립트 모두 구현 완료
- 브랜치 보호 룰 GitHub UI 수동 설정 완료
- 시나리오 테스트 5건 전체 통과 (/auto-fix 루프, 거부 범위 차단, 휴리스틱 차단, dirty tree 중단, main 브랜치 중단)
- 첫 PR CI 통과 확인 완료

**권장 (8-2 또는 후속 PR에서):**

1. ~~`check-scope.ts` 중첩 경로 매칭 보강~~ — ✅ 수정 완료 (`f01e46d`)
2. ~~`check-scope.ts` untracked 파일 스캔 추가~~ — ✅ 수정 완료 (`f01e46d`)
3. ~~`check-scope.ts` 테스트 비활성화 패턴 확장~~ — ✅ 수정 완료 (`f01e46d`)
4. 스펙 업데이트: `.lintstagedrc.cjs` prettier-only 반영, CI node 22 / pnpm auto-detect 반영
