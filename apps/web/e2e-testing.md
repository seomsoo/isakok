# E2E 테스트 가이드 (단일 출처)

> `apps/web/e2e/`의 Playwright E2E를 **작성·실행·디버그·수정**할 때 따르는 규칙과 맥락. 에이전트(planner/generator/healer)
> 와 사람이 함께 읽는 문서다. 13단계 품질 레인(`docs/specs/13-quality-lane.md`)의 운영 정본.

## 1. 무엇을 검증하나 (스코프)

- **대상 = 웹앱 핵심 여정**(critical user flow)만. 모든 분기/페이지를 테스트하지 않는다 — 잘못된 수정으로 핵심이 깨지는 걸 막는 게 목적.
- 현재 2 플로우:
  - `flows/onboarding.spec.ts` — 온보딩 3스텝 → 체크리스트 생성 → 대시보드 도달 (+axe)
  - `flows/checklist-toggle.spec.ts` — 상세 진입 → 완료 토글 → 대시보드 할 일에서 소거 (+axe)
- **E2E 제외**: 사진 업로드·푸시는 네이티브 브릿지(카메라·권한·토큰) 의존 → 브라우저로 도달 불가. 실기기/TestFlight 수동.
- **양 엔진**: Chromium + **WebKit**(iOS WKWebView 기능 호환성 근사 대표 — Chromium-only가 못 잡는 iPhone 회귀).

## 2. 격리 아키텍처 (왜 로컬 Supabase인가)

- **dev=prod**(ADR-075)라 "진짜 백엔드 = 프로덕션". E2E가 그걸 때리면 실유저 데이터 오염 → 그래서 **로컬 Supabase**(`supabase start`, Docker)에 대고 돈다. 일회용 컨테이너라 청소 불요.
- 백엔드는 **모킹하지 않는다** — 실제 RPC·RLS·쿼리를 그대로 검증. 유일한 모킹은 **AI 가이드 Edge 함수**(`VITE_DISABLE_AI_GUIDE=true`) — Anthropic API+네트워크라 불가피한 것만.
- 참고: 백엔드를 *모킹*해야 하는 검증은 Playwright가 아니라 **Vitest 통합/유닛**으로 (브라우저 불요).

## 3. 로컬 실행

```bash
# 1) 로컬 Supabase (Docker 필요) — 마이그레이션 + seed.sql(46 master 항목) 적용
supabase start            # 이미 떴으면 생략
supabase db reset         # 깨끗한 시드가 필요할 때

# 2) E2E (apps/web에서)
pnpm --filter @moving/web exec playwright test                 # 전체(setup→chromium→webkit)
pnpm --filter @moving/web exec playwright test --project=chromium e2e/flows/onboarding.spec.ts
pnpm --filter @moving/web exec playwright test --ui            # UI 모드(디버깅)
pnpm --filter @moving/web exec playwright test --repeat-each=10  # burn-in(플래키 확인)
```

- `.env.test`(gitignore)가 로컬 Supabase URL + **publishable 키**(`sb_publishable_…`, 레거시 JWT 아님)를 가리킨다. CI는 워크플로가 `supabase status`로 재생성.
- webServer는 `vite build --mode test && vite preview --host 127.0.0.1`를 자동 수행(설정됨). 직접 띄울 필요 없음.

## 4. 인증 & 상태 세팅 (두 가지 방식)

| 방식          | 파일                           | 용도                                                                                                                                   |
| ------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| **세션 시딩** | `seed.spec.ts`(setup 프로젝트) | `signInAnonymously()` → `storageState` 저장. 이후 모든 spec이 로그인 없이 재사용                                                       |
| **prefill**   | `support/prefill.ts`           | 새 익명 유저 + **move·체크리스트를 RPC로 직접 생성** + 세션 주입. 온보딩 UI를 거치지 않고 "대시보드에 체크리스트가 있는 상태"에서 시작 |

> **prefill 원칙**: 검증하려는 *시작점*의 상태는 UI 클릭이 아니라 API로 미리 만든다(빠름·독립·셋업 변경에 안 깨짐). 온보딩 자체는 `onboarding.spec.ts`가 검증하므로, `checklist-toggle.spec.ts`는 prefill로 move를 만들고 토글만 검증한다.

## 5. 작성 컨벤션 (플래키 예방)

- **시멘틱 셀렉터**: `getByRole('button', { name: '다음' })`, `getByRole('checkbox', { name: /완료 처리$/ })`. CSS 클래스·DOM 구조 의존 금지(자주 바뀜).
- **하드 대기 금지**: `waitForTimeout` ❌ → `expect(...).toBeVisible({ timeout })`, `waitForURL`, `expect.poll` 같은 **조건 기반 대기**.
- **a11y 게이트**: 주요 페이지 + 동적 상태에서 `checkA11y(page, '컨텍스트')`(WCAG 2.1 AA). `color-contrast`는 baseline 제외(기존 디자인 부채, fixtures/axe.ts 참고).
- **burn-in**: 새 spec은 머지 전 `--repeat-each=10`으로 1회 확인. 한 번이라도 실패하면 플래키.
- **직렬 실행**: `workers: 1`(playwright.config) — flow#1이 공유 익명 유저(seed)에 move를 만들어 양 엔진 병렬 시 레이스. flow#2는 prefill로 독립적이지만 flow#1 때문에 직렬 유지.

## 6. 이 앱 특유의 함정 (회귀·플래키 방지 — 작성 시 반드시 인지)

- **대시보드 액션 항목은 가까운 이사일에서만 보인다**: move 날짜가 멀면(relaxed) 밀린/오늘 할 일이 0 → ActionSection 빈 상태. prefill 기본값 **오늘+8일**(urgent)로 액션 항목 확보.
- **ActionSection은 `slice(0, maxVisible=5)`**: 항목 1개 완료해도 빈자리를 다음 항목이 채워 "보이는 체크박스 수"는 불변. 토글 검증은 카운트 감소가 아니라 **방금 토글한 특정 항목(aria-label)이 사라지는지**로 단언.
- **대시보드 데이터는 비동기 로딩**: `goto('/dashboard')` 직후 카운트하면 0. 첫 액션 항목이 `toBeVisible`될 때까지 대기 후 진행.
- **온보딩 제출 → `/pre-check` 경유**(대시보드 직행 아님): 밀린 항목 있으면 skip 버튼(`건너뛰고 대시보드로 이동`)이 로딩 후 등장 → 기다렸다 클릭. 밀린 항목 0이면 자동 대시보드.
- **로컬 키는 새 형식**(`sb_publishable_…`): `.env.test`에 레거시 데모 JWT(`eyJ…`) 넣으면 인증 실패.
- **`vite preview`는 기본 IPv6 `::1`만 바인딩** → Playwright의 127.0.0.1 접속 실패. webServer에 `--host 127.0.0.1` 명시(설정됨).
- **세션 키는 `SUPABASE_STORAGE_KEY` 단일 출처**(`@moving/shared`) — 앱 클라이언트와 seed/prefill이 같은 키를 써야 "session missing" 안 남.

## 7. CI

- `.github/workflows/ci.yml`의 **`e2e` 잡**: `supabase/setup-cli@2`(버전 **2.105.0** 핀) → `supabase start` → `.env.test` 생성 → `playwright test`. 실패 시 `playwright-report` 아티팩트 업로드.
- `verify` 잡(=fast)이 lint·typecheck·test:coverage·coverage-ratchet·build·size-limit. RLS CI(`rls-ci.yml`)와 역할 구분: RLS=DB 정책 격리, e2e=웹앱 여정+a11y.

## 8. 새 플로우 추가하기

1. **critical path인지** 자문(실패 시 핵심 가치가 깨지나). 아니면 유닛/통합으로.
2. 시작 상태는 **prefill**로 세팅(가능하면). UI 셋업 반복 금지.
3. 시멘틱 셀렉터 + 조건 기반 대기로 작성. 주요 상태에 `checkA11y`.
4. `--repeat-each=10` burn-in 통과 확인.
5. (선택) Playwright Test Agents: `npx playwright init-agents --loop=claude`로 깐 planner/generator/healer로 초안 → **사람이 curate**(과생성 금지) → healer 수정은 **diff 검토 후 반영**(자동커밋 금지, ADR-104).
