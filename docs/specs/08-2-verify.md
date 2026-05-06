# 8단계-2 검증 리포트

> 검증 일시: 2026-05-03
> 스펙: `docs/specs/08-2-harness-ci-bot.md` (v2-fix)

## 빌드/린트/테스트

- `pnpm build`: ✅ 통과 (818KB JS, 50KB CSS)
- `pnpm lint`: ✅ 통과 (web + shared)
- `pnpm test`: ✅ 통과 (16 tests, 3 suites)

---

## 완료 확인 기준 결과

### 8-1 정책 보강

- [x] `.claude/policies/auto-fix-scope.md` §2-1에 `scripts/auto-fix/**` 거부 범위 추가됨 (line 98)
- [x] `scripts/auto-fix/check-scope.ts`의 `DENIED_PATH_PATTERNS`에 `/^scripts\/auto-fix\//` 추가됨 (line 39)
- [x] 보강 변경이 8-2 PR에 통합됨 (정책과 코드가 동시 반영되어야 거부 범위 공백 방지)

### 에이전트 정의

- [x] `.claude/agents/security-auditor.md` 존재 + 책임 분리 명시 + prompt injection 방어 문구
- [x] `.claude/agents/pr-summarizer.md` 존재 + 평가 금지 명시 + prompt injection 방어 문구
- [x] `.claude/agents/ux-state-reviewer.md` 존재 + 4상태 항목 + prompt injection 방어 문구
- [x] `.claude/agents/web-a11y-reviewer.md` 존재 + WCAG 기준 (24×24/44×44) 명시 + prompt injection 방어 문구
- [x] `.claude/agents/native-a11y-reviewer.md` 존재 + 9단계 활성 표시 + prompt injection 방어 문구
- [x] `.claude/agents/perf-budget-reviewer.md` 존재 + 카테고리 6개 + prompt injection 방어 문구

### CI 워크플로우

- [x] 8-1 `ci.yml`에 PR 번호 artifact 저장 step 추가됨 (verify 앞, line 23-37)
- [x] `.github/workflows/pr-summarize.yml` 존재 + trusted tools 패턴 + 파일 읽기 댓글 게시
- [x] `.github/workflows/auto-fix-bot.yml` 존재 + trusted tools 패턴 + 7단계 가드
- [x] auto-fix-bot이 `pull_request` CI 실패에만 동작 (line 17: `event == 'pull_request'`)
- [x] 모든 가드가 `skip output` + `if:` 패턴 (exit 0 단독 사용 X)
- [x] `.github/workflows/gitleaks.yml` 존재
- [x] `.github/dependabot.yml` 존재 + groups 설정

### 보조 스크립트

- [x] `scripts/auto-fix/fetch-logs.mjs` 존재 + maxBuffer 50MB / 출력 5MB 분리
- [x] `scripts/auto-fix/check-attempts.mjs` 존재 + 단독 실행 가능
- [x] `scripts/auto-fix/run.mjs` 존재 + `HARNESS_LLM_MODEL` 환경변수 + `--workspace` 인자 + dry-run 시 git apply 차단 + prompt injection 방어 문구 자동 추가ㅊ
- [x] `scripts/auto-fix/budget-guard.mjs --check` / `--record` 둘 다 동작 + best-effort 명시

### Secrets / Variables

- [ ] `ANTHROPIC_API_KEY_HARNESS` Secret 등록 → GitHub 설정, 코드에서 미검증 (가이드 문서에 명시됨)
- [ ] `AUTO_FIX_BOT_TOKEN` Secret 등록 → GitHub 설정, 코드에서 미검증
- [ ] `AUTO_FIX_MODE` Variable 등록 → GitHub 설정, 코드에서 미검증
- [ ] `AUTO_FIX_DAILY_TOKEN_LIMIT` Variable 등록 → GitHub 설정, 코드에서 미검증
- [ ] `HARNESS_LLM_MODEL` Variable 등록 → GitHub 설정, 코드에서 미검증

> 참고: 위 5개 항목은 GitHub Settings에 수동 등록이 필요하며, 워크플로우에서 참조하는 변수명은 올바르게 정의되어 있음. 실제 등록은 PR 머지 후 수행.

### 부가 도구

- [x] eslint-plugin-jsx-a11y 설치 (root package.json) + recommended 룰 적용 (eslint.config.js)
- [x] `.gitleaks.toml` 존재 (allowlist에 docs 전체 제외 없음, regex 더미값만 허용)

### 운영 문서

- [x] `docs/harness-ops.md` 존재 (모드 전환 + 비용 모니터링 + 장애 대응 5개 시나리오)
- [x] `docs/architecture/harness-engineering.md` 존재 (면접 카드)

### 8-2 실제 동작 검증 (apply 모드 제외)

- [ ] PR 생성 시 pr-summarize 워크플로우 자동 트리거 + 댓글 게시 → PR 머지 후 검증 필요
- [ ] pr-summarize가 trusted tools(`tools/`)로 실행되는지 확인 → 워크플로우 코드 확인 완료 (line 44-50)
- [ ] 의도적 lint 실패 PR → CI 실패 → auto-fix-bot 트리거 → PR 머지 후 검증 필요
- [ ] mode=dry-run 전환 → 봇이 PR 댓글로 dry-run 결과 게시 → PR 머지 후 검증 필요
- [ ] dry-run 모드에서 git apply / PR 생성이 절대 일어나지 않음 → 코드 확인 완료 (run.mjs line 120-121)
- [ ] fork PR로 트리거 시도 → fork 가드 차단 → PR 머지 후 검증 필요
- [ ] 시도 횟수 4회 시도 → check-attempts가 차단 → PR 머지 후 검증 필요
- [ ] budget-guard가 한도 초과 시 차단 → PR 머지 후 검증 필요
- [x] CI 봇이 `docs/auto-fix-log/`에 commit하지 않음 → 워크플로우 코드에 commit step 없음, PR 댓글 + artifact만 사용

---

## 누락 (스펙에 있는데 구현 안 됨)

1. **Secrets/Variables 실제 등록**: 워크플로우에서 참조하는 5개 시크릿/변수가 GitHub Settings에 아직 미등록 (PR 머지 후 수동 설정 필요)
2. ~~8-1 정책 보강 별도 PR~~ → 8-2 PR에 통합 결정 (정책-코드 동시 반영으로 거부 범위 공백 방지)

---

## 스코프 크립 (구현했는데 스펙에 없음)

없음

---

## 컨벤션 위반

없음

---

## Codex 코드리뷰 결과

- **[P1] `scripts/auto-fix/check-attempts.mjs:18-19`** — branch name shell injection
  - 문제: `execSync`에 `BRANCH` 환경변수를 template literal로 직접 삽입. 같은 리포지토리 PR의 브랜치명이 쉘 문법(`"`, `` ` ``, `$()`)을 포함하면 `GH_TOKEN`이 있는 환경에서 임의 명령 실행 가능
  - 수정: ✅ 수정 완료 — `execSync` → `execFileSync` + argument array로 전환. 쉘 해석 없이 `gh` 바이너리에 인자 직접 전달

- **[P2] `.github/workflows/auto-fix-bot.yml:116-121`** — setup-node cache path 불일치
  - 문제: `cache: 'pnpm'`만 지정하고 `cache-dependency-path` 미설정. 리포지토리를 `tools/`와 `workspace/`에만 checkout하므로 루트에 `pnpm-lock.yaml` 없음 → `setup-node`가 캐시 저장 실패 가능
  - 수정: ✅ 수정 완료 — `cache-dependency-path: tools/pnpm-lock.yaml` 추가

- **[P2] `.github/workflows/auto-fix-bot.yml:81-88`** — head_branch checkout (stale 코드 위험)
  - 문제: `ref: ${{ github.event.workflow_run.head_branch }}`로 현재 브랜치 최신 tip을 checkout. 실패 시점의 `head_sha`와 다를 수 있음 (실패 후 새 커밋 push 시 stale 로그로 잘못된 코드 분석)
  - 수정: ✅ 수정 완료 — artifact 다운로드를 workspace checkout 앞으로 이동, `pr-info/head_sha`에서 읽은 SHA로 checkout

---

## spec-reviewer 결과

해당 없음 (단순 단계 — DB/Edge Function 미변경, 스펙 파일 2500줄이지만 CI/워크플로우 중심으로 클라이언트 코드 변경 없음)

---

## 종합 판정

✅ **통과** (Codex P1 1건 + P2 2건 모두 수정 완료)

### 비차단 참고 사항 (PR 머지 후 수동 처리)

- GitHub Secrets/Variables 5개 등록
- 8-2 실제 동작 검증 (PR 머지 후 트리거 테스트)
- 8-1 정책 보강 PR 분리 여부는 운영 판단 (현재 통합되어 있어도 기능상 문제 없음)
