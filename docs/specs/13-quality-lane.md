# 13단계: 품질 레인 (Quality Lane) 스펙 (SDD) v1

> 목표: 손으로 다 검증할 수 없는 회귀를 기계가 머지 전에 막고(게이트), 배포 후 실유저 성능을 관측(모니터)하는 안전망을 구축한다.
> 이 단계가 끝나면: PR마다 E2E(양 엔진) + 접근성 + 번들 사이즈 + 커버리지 래칫이 머지 필수 체크로 돌고, 핵심 순수 로직이 유닛 테스트로 고정되며, 배포된 앱에서 Web Vitals가 PostHog로 실시간 수집되는 상태. WebView·dev=prod라는 이 프로젝트 고유 제약에 맞춰 설계한다.

> 재사용 자산: 익명 세션(ADR-042 `signInAnonymously()`) · `delete_my_*` cascade 정리(ADR-082·12단계 `delete_my_push_tokens`) · PostHog 이벤트(ADR-086) · Sentry PII 스크럽 규율(ADR-089) · 하네스 CI(`ci.yml`, 8단계) · RLS CI required check(ADR-081) · 로컬 Supabase(`supabase start`, 1단계 마이그레이션).

> **설계 핸드오프 → 스펙 (잠금 결정 반영)**
>
> - 격리는 **로컬 Supabase**(`supabase start`)로 — dev=prod(ADR-075) 운영 DB를 테스트가 건드리지 않음. "치울 공유 상태가 없는 게 최고의 청소." [§2-3]
> - E2E는 **Playwright 에이전트로 초안 → 사람이 curate**(과생성 금지, 2 플로우). healer는 **로컬 dev 도구 + diff-gate**(auto-commit 금지). [§5]
> - **Chromium + WebKit** 양 엔진 — WebKit이 iOS WKWebView 기능 정확성을 대표. [§5]
> - Lighthouse 제외 → a11y는 **axe-in-Playwright**(WCAG 2.1 AA), 성능은 **RUM**(PostHog). [§2-1·§7]
> - 커버리지는 **절대 % 목표가 아니라 래칫**(회귀 금지) — 트리비얼 테스트 양산 방지(ADR-027 정신). [§4·§6]
> - 유닛 백필 6영역은 **Phase 0** — 래칫 baseline을 백필 후 실측값으로 고정. [§4]
> - mutation testing·visual regression·Lighthouse는 **제외**(옵션 기록만). [§0]

> **v1 → v1.1 변경 (GPT 리뷰 선별 반영 — ~13/20 채택)**
>
> - E2E webServer는 **`build --mode test && preview`** (preview 단독 의존 금지 — `VITE_*`는 빌드타임 인라인). [리뷰 #1]
> - `seed.spec.ts` 세션 시딩에서 **`page.evaluate` 내 `import.meta.env` 제거** + `SUPABASE_STORAGE_KEY` 상수를 앱 클라이언트·테스트 단일 출처로. [리뷰 #2]
> - E2E 검증 대상 = **웹앱 여정**(WebView 브릿지 아님) 명시. 브라우저는 `persistSession: !isNative=true`로 이미 동작(코드 확인). [리뷰 #3, 일부]
> - CI에서 **`.env.test` 워크플로 생성** + **Supabase CLI 설치 + readiness wait**. [리뷰 #4·#5]
> - `seed.sql`은 **운영 master seed 전체** 주입(수동 축약 금지, 46개라 과하지 않음). [리뷰 #6]
> - E2E 모드 **`VITE_DISABLE_AI_GUIDE=true`** — #2 토글 플로우가 상세 진입 시 AI Edge invoke함을 코드에서 확인 → 차단. [리뷰 #7]
> - 커버리지 래칫 **package별 baseline**(web/shared) + 제외 목록 + 0.1%p 오차. [리뷰 #8·#9]
> - size-limit **`initial entry` + `total JS` 두 예산**(main만 보면 코드스플리팅 후 무의미). [리뷰 #10]
> - Playwright cache key에 **`runner.os` + package hash**. [리뷰 #11]
> - RUM **`release_channel` 속성** + **`initialized` 중복 가드** + SPA route 미수집 명시. [리뷰 #12·#13·#18]
> - e2e job **`timeout-minutes` + 실패 시 artifact**, RLS CI와 역할 구분. [리뷰 #19·#20]
> - WebKit "근사 대표"로 톤 보정, Playwright 에이전트 도구 경계 완화. [리뷰 #15·#16]
> - **거절:** axe 단계 과세분화(#14 — 이미 본문에 있음).

> **구현 반영 (스펙 v1.1 → 실제 구현) — /verify 대조 기준**
>
> 구현 세션에서 미결을 확정하거나 설계가 달라진 것. /verify는 본문 가정이 아니라 이 블록 기준으로 대조한다.
>
> **미결 → 확정:**
>
> - size-limit 두 예산 limit = **345 KB**(실측 gzip 336 + 헤드룸). 커버리지 baseline = **web 92.93% / shared(utils) 74.3% lines**(`docs/coverage-baseline.json`).
> - 6영역 파일 확정: D-day=`utils/dateLabel.ts` · progress=`utils/progress.ts`(essential) · 재배치=`utils/urgencyMode.ts` · 토글/메모=**순수 추출** `checklist-detail/memoSaveMachine.ts`+`dashboard/optimisticToggle.ts` · scrub=`observability/scrub.ts`(11단계 기존) · 매핑=`utils/conditionTags.ts`(항목 선별은 SQL RPC, 그 TS analog).
> - 커버리지 스코프: shared는 `utils/`만(데이터파일 false-positive 회피), web은 `all:false`(lib/supabase import 부수효과 회피).
>
> **설계 변경(이유):**
>
> - **size-limit**: `@size-limit/preset-app`(+`module.exports`) → **`@size-limit/file`(+ESM `export default`, 파일명 `.size-limit.js`)**. preset-app은 `@size-limit/time`(헤드리스 Chrome) 포함→CI 브라우저 의존 → gzip만 게이트하려 file 단독.
> - **RUM**: raw `posthog.capture('web_vitals',{path})` → **`captureEvent` 래퍼 경유 + `route`(동적세그먼트 `:id` 정규화)**. events.ts §2-2 "경로 금지" 규율 + 단일 PostHog 초크포인트. WEB_VITALS 화이트리스트 추가, 게이트 판정 `isProduction()`.
> - **AI 가드 위치**: 상세 마운트(가정) → 실제 **DashboardPage 마운트** 발화 → 가드는 `invokeGenerateAiGuide` 서비스 진입부 `VITE_DISABLE_AI_GUIDE` early-return.
> - **flow#2**: "상세→토글→progress 증가"(본문) → **대시보드→상세→완료토글→복귀 시 그 항목이 할 일에서 소거**(모드 독립, ActionSection `slice(0,5)`라 카운트 불변).
> - **온보딩 스텝**: 4단계(본문) → 실제 **3스텝**(날짜/주거/계약+이사방법).
> - **storageKey import**: `@moving/shared/auth/constants` 서브패스 → **`@moving/shared` 배럴**(서브패스 미해결). 상수는 `packages/shared/src/auth/constants.ts`.
> - **a11y**: axe `color-contrast` **baseline 제외**(캘린더 rgba0.3·muted 부채 — 별도 패스) + viewport `maximum-scale=1.0` 제거(실 WCAG1.4.4 수정).
> - **playwright webServer**: `--host 127.0.0.1` 필수(preview 기본 IPv6 ::1) + `loadEnv`로 .env.test 주입 + `workers:1`(공유 익명유저 레이스 방지).
> - **CI**: 잡 개명(`fast`) 대신 **기존 `verify` 유지 + `e2e` 신설**(개명 시 required check·pr-summarize 깨짐). setup-cli **@v2(2.105.0 핀)** + `status -o json`+jq(rls-ci 패턴, 새 키 `sb_publishable_`).
>
> **추가분 (영상 "AI 에이전트용 하네스" 학습 — 스펙 외):**
>
> - **prefill 헬퍼** `e2e/support/prefill.ts` — 새 익명유저+move를 RPC로 만들고 세션 주입(온보딩 UI 스킵). flow#2 사용 → 빠름·독립.
> - **E2E 가이드 doc** `apps/web/e2e-testing.md` — 실행/컨벤션/함정 단일출처(에이전트+사람).
> - **Playwright Test Agents** `init-agents --loop=claude` → `.claude/agents/playwright-test-{planner,generator,healer}.md`(루트) + `.mcp.json`(cwd=apps/web) + `apps/web/specs/`(계획). healer는 diff-gate(ADR-104). burn-in `--repeat-each=10` 양엔진 41 passed(플래키0).
> - 규칙: 백엔드 _모킹_ 검증은 Vitest 통합으로(Playwright는 진짜 연동만).
>
> **ADR:** §12 099~105 → `docs/ADR.md`에 **반영 완료**(2026-06-23, max 098 확인 후 099~105 추가, 실제 구현 반영: RUM `route`·`@size-limit/file`·CI `verify` 유지).

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- **유닛 백필** (6영역, Phase 0): D-day 계산 / progress 계산 / 스마트 재배치 그룹핑 / 낙관 토글·메모 디바운스 / observability scrub(PII) / 체크리스트 생성 매핑 — 순수 로직만, Vitest
- **커버리지 래칫**: 절대 목표치 없음, "회귀 금지" 래칫. baseline은 백필 후 실측
- **E2E** (Playwright, **Chromium + WebKit** 2 프로젝트): 2 플로우(#1 온보딩→체크리스트→대시보드, #2 체크리스트 토글+progress)
- **테스트 격리**: 로컬 Supabase(`supabase start`) + `seed.sql` 참조 데이터 + `signInAnonymously()` 세션 시딩 → `storageState` 재사용
- **접근성 게이트**: axe-core를 Playwright spec에 임베드(별도 도구 0), WCAG 2.1 AA, E2E 플로우 페이지 + 동적 상태(모달 등), fail 게이트
- **번들 사이즈 가드**: `size-limit`, 현재 gzip 크기를 천장으로 → 코드 스플리팅하며 래칫 다운, 초과 시 fail
- **Web Vitals RUM**: `web-vitals`(LCP/CLS/INP + FCP/TTFB) → PostHog `web_vitals` 이벤트, production 전용, 게이트 아닌 사후 모니터
- **CI 통합**: `ci.yml`에 `fast`/`e2e` 두 잡, 캐싱(Playwright 브라우저 + pnpm 스토어), PR마다, 머지 필수 체크
- **유닛 테스트 작성 도구**: Playwright 에이전트(planner/generator/healer)를 **로컬 dev 도구로만** 사용(CI 아님)

### 안 하는 것

- **Lighthouse CI** — Chromium-only라 iOS WKWebView 성능을 대표 못 함(§2-1). a11y는 axe로 대체
- **mutation testing** — 옵션·니치, 미루는 데 락인 0. config 1회 실행으로 나중에 추가 가능(§2)
- **visual regression** — 스냅샷 유지보수 비용 > 1인 프로젝트 이득. 후속 검토
- **사진 업로드·푸시 E2E** — 네이티브 브릿지(카메라·권한·토큰) 의존 → Playwright로 도달 불가, 실기기/TestFlight 수동 검증(§5)
- **nightly E2E 잡** — mutation 뺐으므로 불필요. E2E는 PR 게이트로 충분
- **healer auto-commit / CI healer 스텝** — healer는 로컬 dev 도구, diff-gate(§5)
- **3개 이상 E2E 플로우** — critical path 2개만, 과생성 금지

---

## 1. 폴더 구조

```
.github/workflows/
└── ci.yml                                  ← 수정 (fast / e2e 두 잡 분리, 캐싱, 브랜치 보호)

apps/web/
├── playwright.config.ts                    ← 생성 (Chromium + WebKit 프로젝트, webServer, storageState)
├── size-limit.config.js                    ← 생성 (메인 청크 gzip 예산)
├── .env.test                               ← 생성 (로컬 Supabase URL/ANON_KEY, PostHog/Sentry off)
├── e2e/
│   ├── seed.spec.ts                        ← 생성 (signInAnonymously → storageState 저장, setup 프로젝트)
│   ├── flows/
│   │   ├── onboarding.spec.ts              ← 생성 (#1, axe 임베드)
│   │   └── checklist-toggle.spec.ts        ← 생성 (#2, axe 임베드)
│   ├── fixtures/
│   │   └── axe.ts                          ← 생성 (axe-core 헬퍼 + WCAG 2.1 AA 태그)
│   └── support/
│       └── cleanup.ts                      ← 생성 (delete_my_* RPC — 로컬은 일회용이라 옵셔널)
└── src/
    └── observability/
        └── webVitals.ts                    ← 생성 (web-vitals → PostHog, production 전용)

apps/web/src/**/__tests__/                  ← 생성/보강 (유닛 백필 6영역)
packages/shared/src/**/__tests__/          ← 생성/보강 (순수 로직 백필)
packages/shared/src/auth/constants.ts      ← 생성/수정 (SUPABASE_STORAGE_KEY 단일 출처)

supabase/
├── seed.sql                                ← 생성/보강 (운영 master seed 전체 — 수동 축약 금지)
└── (config.toml은 기존 로컬 설정 사용)

scripts/
└── coverage-ratchet.mjs                    ← 생성 (package별 baseline 회귀 시 fail)

docs/
└── coverage-baseline.json                  ← 생성 (package별 래칫 기준값, Phase 0 후 실측)

.gitignore                                  ← 수정 (apps/web/e2e/.auth/ 추가 — 세션 토큰)
```

> Playwright/axe/size-limit/web-vitals 설정은 모두 **apps/web 스코프**. 유닛 백필은 web·shared 양쪽. CI만 레포 루트.

---

## 2. 패키지 설치

```bash
# E2E (apps/web)
pnpm --filter @moving/web add -D @playwright/test @axe-core/playwright
pnpm --filter @moving/web exec playwright install --with-deps chromium webkit

# 번들 가드 (apps/web)
pnpm --filter @moving/web add -D size-limit @size-limit/preset-app

# RUM (apps/web, 런타임 의존)
pnpm --filter @moving/web add web-vitals

# 테스트 작성 보조 도구는 로컬 dev 전용 (codegen / MCP / Claude Playwright agent 등)
# → CI 의존성 아님. CI는 생성된 .spec.ts만 실행. 구체 도구는 구현 시 확정(§5-4)
```

> `@axe-core/playwright`: axe-core를 Playwright page에 주입해 위반 수집. `@size-limit/preset-app`: SPA용 gzip+brotli 측정 프리셋. `web-vitals`: Google 공식 Core Web Vitals 측정 라이브러리(LCP/CLS/INP/FCP/TTFB).
> WebKit 브라우저 바이너리는 CI 캐싱 대상(§8).

---

## 3. 테스트 격리 하네스 (로컬 Supabase)

> **핵심 설계:** dev=prod(ADR-075)라 운영 DB가 곧 개발 DB다. E2E·에이전트 탐색이 이 DB를 건드리면 실유저 데이터를 오염시킨다. 그래서 테스트는 **로컬 Supabase**(`supabase start`)에 대고 돈다. 일회용 컨테이너라 청소가 필요 없다 — "치울 공유 상태가 없는 게 최고의 청소."

### 3-1. 로컬 Supabase 기동

```bash
supabase start                # Docker로 Postgres + Auth + Storage + (필요시) Edge Functions
supabase db reset             # 마이그레이션 전체 적용 + seed.sql 주입
```

- 스키마는 `supabase/migrations/`(1단계~) 전체를 마이그레이션으로 재현 → 운영과 동일 구조
- 참조 데이터(체크리스트 템플릿 등 `master_checklist_items`)는 `seed.sql`로 주입 — §3-2
- **Edge Functions 로컬 serve 불필요(확정):** 2 플로우(온보딩·토글)는 DB + RLS + RPC만 탄다. 유일하게 Edge를 타는 AI 가이드는 E2E 모드에서 `VITE_DISABLE_AI_GUIDE`로 차단(§3-3) → `supabase functions serve` 생략.

### 3-2. seed.sql (2 플로우 참조 데이터)

```sql
-- supabase/seed.sql
-- master_checklist_items: 온보딩 체크리스트 생성 RPC가 참조하는 마스터 템플릿
-- + system_config(master_checklist_version 등) RPC가 기대하는 참조 행
```

> **수동 축약 금지.** 온보딩의 체크리스트 생성 RPC는 마스터 항목 조건/카테고리/order/`system_config` 버전을 여러 곳 참조한다. 손으로 subset을 뽑으면 조건 조합 부족으로 대시보드 항목이 0개가 되거나 progress가 실제와 다르게 나올 수 있다.
> **13단계 방침: 운영 master 체크리스트 seed 전체를 로컬에 주입한다.** 항목 46개 수준이라 전체가 과하지 않다. E2E 안정화 후 시간/데이터량이 문제되면 _운영 seed와 같은 source에서_ subset 생성(수동 복붙 아님). `seed.sql`은 운영 시드 소스를 재사용하거나 동일 마이그레이션 경로로 주입.

### 3-3. 앱이 로컬 Supabase를 보게 (env 스왑)

```bash
# apps/web/.env.test (gitignore에 추가 — anon key는 로컬 데모값이라 민감하지 않으나 관례상)
VITE_SUPABASE_URL=http://127.0.0.1:54321
VITE_SUPABASE_ANON_KEY=<supabase start가 출력하는 로컬 anon key>
VITE_APP_ENV=test
# 관측 도구 off (테스트가 운영 PostHog/Sentry를 오염시키지 않게)
VITE_POSTHOG_KEY=
VITE_SENTRY_DSN=
# AI 가이드 background generation off (E2E가 Edge Function/Anthropic에 의존 안 하게)
VITE_DISABLE_AI_GUIDE=true
```

- **`VITE_*`는 빌드 타임 인라인이다.** 따라서 `preview --mode test`만으론 부족 — 테스트 빌드 자체가 `build --mode test`여야 로컬 Supabase를 가리킨다(§5-1·§8). preview는 이미 test 모드로 빌드된 `dist`를 서빙할 뿐. 운영 빌드 env가 섞이면 E2E가 prod DB를 때림(dev=prod라 치명적)
- **AI 차단(`VITE_DISABLE_AI_GUIDE`):** #2 토글 플로우는 항목 상세(`/checklist/:itemId`)를 거치고, 상세 마운트 시 `useGenerateAiGuide`가 background mutation으로 `generate-ai-guide` Edge Function을 invoke한다(7단계). E2E에서 이게 발화하면 로컬 Edge serve·Anthropic 키·외부 네트워크에 의존 → 플레이크·비용. 호출부에서 플래그로 early-return:

```typescript
// useGenerateAiGuide 호출부 (또는 mutationFn 진입부)
if (import.meta.env.VITE_DISABLE_AI_GUIDE === 'true') return // E2E 모드 차단
```

> 이로써 "2 플로우는 DB+RLS만 타므로 Edge serve 불필요"(§3-1)가 *확정*된다 — AI는 E2E 범위 밖.

### 3-4. 세션 시딩 (storageState)

> 네이티브 Expo가 세션을 주입하는 구조라(STATUS 학습 §116), 브라우저에서 앱을 그냥 열면 "session missing"이 난다. E2E는 이 주입을 `signInAnonymously()` 호출로 대체한다.
>
> **이 E2E의 검증 대상 = 웹앱 핵심 여정.** WebView 브릿지(`AUTH_SESSION` 주입) 자체가 아니다. 웹 Supabase 클라이언트는 브라우저 환경(`isNativeWebView()=false`)에서 이미 `persistSession: !isNative = true`로 동작한다(10-1-native-auth §클라이언트). 따라서 localStorage persist 방식 시딩이 실제 앱 인증 흐름과 일치한다. **Native `AUTH_SESSION` 브릿지 검증은 10단계 실기기/수동 smoke 범위로 유지**(§15).

**핵심: localStorage 키를 추측하지 않는다.** 앱 Supabase 클라이언트의 `storageKey`를 명시 상수로 고정하고, `seed.spec.ts`도 같은 상수를 쓴다.

```typescript
// packages/shared/src/auth/constants.ts (또는 supabase 클라이언트 인접)
export const SUPABASE_STORAGE_KEY = 'isakok-auth-token' // 앱 클라이언트와 단일 출처

// 앱 클라이언트 (기존 createClient에 storageKey 명시 추가)
createClient(url, anonKey, {
  auth: { persistSession: !isNative, storageKey: SUPABASE_STORAGE_KEY },
})
```

```typescript
// apps/web/e2e/seed.spec.ts (Playwright "setup" 프로젝트로 등록)
import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_STORAGE_KEY } from '@moving/shared/auth/constants'

const STORAGE = 'apps/web/e2e/.auth/anon.json'

setup('seed anonymous session', async ({ page }) => {
  // 1. 로컬 Supabase에 익명 세션 발급 (ADR-042 재사용)
  const supabase = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!)
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error

  // 2. 세션을 앱이 읽는 localStorage 키에 주입
  //    storageKey·session 모두 Node 쪽에서 계산해 "값으로" 넘긴다.
  //    (page.evaluate 함수 본문은 브라우저 컨텍스트라 import.meta.env·외부 변수 접근 불가)
  await page.goto('/')
  await page.evaluate(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session))
    },
    { key: SUPABASE_STORAGE_KEY, session: data.session },
  )

  // 3. storageState 저장 → 이후 모든 spec이 재사용 (로그인 반복 0)
  await page.context().storageState({ path: STORAGE })
})
```

> **`.gitignore`에 추가:** `apps/web/e2e/.auth/` — storageState 파일은 세션 토큰을 포함한다(로컬 Supabase 토큰이라도 git 커밋 금지).
> **로컬 일회용이라 청소 불필요** — `delete_my_*` RPC는 같은 컨테이너 재사용 대비로 `support/cleanup.ts`에 두되 옵셔널. 운영 DB(dev=prod)였다면 필수였을 cascade 정리가, 로컬 격리로 _문제 자체가 소멸_.
> ⚠️ **완료 기준:** 브라우저 환경에서 `isNativeWebView()=false` 확인 → seeded session으로 `supabase.auth.getUser()` 성공 → Native 브릿지 경로는 이 E2E 대상 아님을 verify에 명시.

---

## 4. 유닛 백필 (Phase 0, 6영역)

> **왜 Phase 0인가:** 커버리지 래칫의 baseline을 "현재 실측값"으로 잡으려면, 핵심 로직이 먼저 테스트로 덮여 있어야 한다. 백필 → baseline 측정 → 래칫 가동 순서. 백필 전에 래칫을 켜면 baseline이 너무 낮아 회귀 방지 의미가 약하다.

> **층 분리(테스트 피라미드):** E2E는 _여정_(2 플로우), 유닛은 _로직_(6영역), 수동은 _네이티브_(사진·푸시). 예를 들어 스마트 재배치는 E2E엔 없지만 그룹핑 로직은 여기 유닛에 있다.

대상 6영역 (모두 순수 함수 — I/O·네트워크 없음, 입력→출력만):

| #   | 영역                     | 위치(추정)                      | 핵심 검증                                                                |
| --- | ------------------------ | ------------------------------- | ------------------------------------------------------------------------ |
| 1   | D-day 계산               | `packages/shared` 날짜 유틸     | 이사일 기준 D-N, 음수(지난), 당일(D-0), 타임존 경계                      |
| 2   | progress 계산            | `packages/shared` progress util | 완료/전체 비율, `is_skippable` nested 경로(STATUS §99), 0건 분모         |
| 3   | 스마트 재배치 그룹핑     | `packages/shared` 재배치 로직   | 5모드 그룹핑, 모드 전환 시 그룹 재계산                                   |
| 4   | 낙관 토글·메모 디바운스  | `apps/web` 4단계 훅 로직        | 낙관 업데이트 롤백, `lastSavedRef` 변경 판별(STATUS §95)                 |
| 5   | observability scrub(PII) | `apps/web` Sentry beforeSend    | URL query strip, 이메일 마스킹, message/stack 자유텍스트 redact(ADR-089) |
| 6   | 체크리스트 생성 매핑     | `apps/web`/`shared` 매핑        | 온보딩 조건 → 마스터 항목 선별 매핑, 조건 무관 항목 포함                 |

```typescript
// 예시: packages/shared/src/checklist/__tests__/progress.test.ts
import { describe, it, expect } from 'vitest'
import { computeProgress } from '../progress'

describe('computeProgress', () => {
  it('is_skippable는 nested 경로로 추출 (최상위 가정 시 과대계산)', () => {
    // STATUS 학습 §99: master_checklist_items.is_skippable 경로
    const items = [
      { is_checked: true, master_checklist_items: { is_skippable: false } },
      { is_checked: false, master_checklist_items: { is_skippable: true } },
    ]
    expect(computeProgress(items)).toEqual({ done: 1, total: 1, ratio: 1 }) // skippable 제외
  })

  it('분모 0 (전부 skippable)일 때 NaN/Infinity 안 냄', () => {
    const items = [{ is_checked: false, master_checklist_items: { is_skippable: true } }]
    expect(computeProgress(items).ratio).toBe(0) // 또는 정의된 안전값
  })
})
```

> ⚠️ **미결(구현):** 각 영역의 정확한 파일 경로·함수명은 구현 세션에서 `grep`으로 확인 후 확정(STATUS 학습 §117: 파일명 추측 금지, import 그래프 확인). 위 표의 위치는 추정.
> **mutation testing 1회 감사는 하지 않음** — 핸드오프에서 제외 확정. 옵션으로만 기록(§16). 커버리지 래칫으로 기본 회귀 방지는 충족.

---

## 5. E2E (Playwright 에이전트로 초안 → curate)

### 5-1. 양 엔진 프로젝트

```typescript
// apps/web/playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  retries: process.env.CI ? 2 : 0, // 플레이크 억제 (로컬 격리로 결정성 높지만 안전망)
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173', // vite preview 기본 포트
    trace: 'on-first-retry',
  },
  webServer: {
    // VITE_*는 빌드 타임 인라인 → 반드시 build --mode test 후 preview.
    // preview --mode test에 의존하지 않는다(이미 빌드된 dist를 서빙할 뿐).
    command:
      'pnpm --filter @moving/web build --mode test && pnpm --filter @moving/web preview --port 4173',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000, // build 포함이라 넉넉히
  },
  projects: [
    { name: 'setup', testMatch: /seed\.spec\.ts/ }, // 세션 시딩
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], storageState: 'apps/web/e2e/.auth/anon.json' },
      dependencies: ['setup'],
    },
    {
      name: 'webkit', // ← iOS WKWebView 기능 호환성 근사 대표
      use: { ...devices['Desktop Safari'], storageState: 'apps/web/e2e/.auth/anon.json' },
      dependencies: ['setup'],
    },
  ],
})
```

> **왜 WebKit인가:** iOS는 WKWebView(WebKit 엔진)로 앱을 렌더한다. Chromium-only 테스트는 iPhone에서 깨지는 기능을 못 잡는다. Playwright WebKit은 iOS WKWebView 기능 호환성의 **근사 대표**다 — 완전 대체는 아니므로(실제 네이티브 WebView·카메라·권한은 별개) 실기기 수동 검증과 병행한다. (성능은 RUM이 담당 — §7.)

### 5-2. 2 플로우 (critical path만)

**#1 온보딩 → 체크리스트 생성 → 대시보드** (`flows/onboarding.spec.ts`)

- 4단계 폼 입력 → 제출 → 체크리스트 생성 RPC 트랜잭션 → 대시보드 진입
- 검증: 대시보드에 "오늘 할 일" 렌더, 항목 수 > 0

**#2 체크리스트 토글 + progress** (`flows/checklist-toggle.spec.ts`)

- 항목 상세 진입 → 체크 토글(낙관적) → progress 증가 반영
- 검증: 토글 후 progress 바/카운트 갱신

> **E2E 제외:** 사진 업로드·푸시는 네이티브 브릿지(카메라·권한·토큰)에 의존 → Playwright(브라우저)로 도달 불가. 실기기/TestFlight **수동 검증**으로 남긴다. 대신 사진/푸시의 _순수 로직_(EXIF 추출, scrub 등)은 유닛 백필이 일부 커버.

### 5-3. axe-core 임베드 (a11y 게이트)

```typescript
// apps/web/e2e/fixtures/axe.ts
import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']

export async function checkA11y(page: Page, context?: string) {
  const results = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS) // best-practice는 제외 → warn-only는 별도(아래)
    .analyze()
  expect(results.violations, `a11y violations${context ? ` @ ${context}` : ''}`).toEqual([]) // fail 게이트
}
```

- 호출 위치: 각 E2E 플로우의 **주요 페이지 + 동적 상태**(모달 열림 등). 정적 페이지뿐 아니라 모달·시트 같은 동적 상태도 검사
- **첫 실행 위반 닫고 → fail 게이트로 전환.** best-practice 룰은 warn-only(별도 리포트, 게이트 아님)
- ⚠️ **왜 Lighthouse가 아니라 axe인가:** Lighthouse a11y는 내부적으로 axe를 돌린다. axe-in-Playwright로 직접 돌리면 (a) 별도 도구·브라우저 0, (b) 양 엔진 + 동적 상태까지 커버 → 더 싸고 더 넓다.

### 5-4. 에이전트로 작성 → curate (테스트 작성 방법)

> **결정: 손으로 X, Playwright 에이전트(planner/generator/healer)로.** 단 **로컬 dev 도구로만**, CI 아님.

- **세션:** `seed.spec.ts`의 `signInAnonymously()` + storageState를 에이전트도 재사용
- **생성:** 섹션별 선별 생성 후 **2 플로우로 curate** — 에이전트 과생성 금지(critical path만 남김)
- **탐색 대상:** 에이전트는 **로컬 Supabase**에 대고 탐색 → 운영 오염 0 (에이전트 무한 탐색 위험이 0 — 최대 장애물 해소)
- **healer:** **diff-gate** — 로컬에서 사람이 호출 → diff 리뷰 → 수동 반영. **auto-commit 금지, CI 스텝 아님**
- **axe:** 에이전트가 만든 표준 `.spec.ts`에 `checkA11y` 호출만 얹음 (충돌 없음)

> **왜 healer를 게이트하나(diff-gate):** 무검토 auto-heal은 어설션을 느슨하게 만들어 *진짜 회귀를 초록불로 세탁*할 수 있다. 이 프로젝트는 blast radius가 높다(적은 고가치 테스트 + 실유저 + dev=prod). 시니어는 자율성을 blast radius에 맞춘다. healer는 로컬 dev 도구이지 CI 스텝이 아니다.
>
> **왜 손이 아니라 에이전트인가:** 학습/포트폴리오 가치 + _통합 난제(dev=prod 격리, 게이팅)를 푼 것 자체가 엔지니어링 포인트_. 단, 바운드(2 플로우 + diff-gate)를 둬서 통제.
>
> **CI에는 LLM 0:** planner/generator/healer는 _로컬 dev 도구_(LLM·대화형). CI는 그 산출물(`.spec.ts`)만 돌린다(LLM 0, 토큰 0).
>
> ⚠️ **도구 경계(구현 시 확정):** 여기서 "에이전트"는 특정 패키지가 아니라 *로컬 작성 워크플로*를 가리킨다. 실제로는 Playwright `codegen` / Playwright MCP / Claude의 Playwright 조작 중 무엇을 쓸지 구현 세션에서 확정. 공통점은 **CI 비의존 + 산출물만 커밋**.

---

## 6. 번들 사이즈 가드 + 커버리지 래칫

### 6-1. size-limit (번들 가드)

```javascript
// apps/web/size-limit.config.js
module.exports = [
  {
    name: 'initial entry (gzip)',
    path: 'dist/assets/index-*.js',
    limit: '___ KB', // ⚠️ 현재 gzip 크기 실측값으로 (미결)
    gzip: true,
  },
  {
    name: 'total JS (gzip)', // ← main만 보면 코드스플리팅 후 무의미
    path: 'dist/assets/*.js',
    limit: '___ KB', // ⚠️ 전체 JS gzip 합 실측값으로 (미결)
    gzip: true,
  },
]
```

- **예산 = 현재 크기를 천장**으로 시작 → 코드 스플리팅하며 **래칫 다운**(초과 시 fail)
- **main chunk만 보지 않는다(중요):** 코드 스플리팅을 넣으면 main은 줄지만 lazy chunk가 늘 수 있다. main만 게이트하면 *전체 JS가 악화돼도 통과*하는 회귀가 생긴다 → `initial entry`와 `total JS` 두 예산을 함께 본다
- 최적화 타깃(이미 식별됨): 라우트 기반 코드 스플리팅(~837KB 단일 청크 분할), `exifreader`·`react-day-picker` lazy import
- **측정 먼저, 최적화 나중:** 가드(baseline)가 있어야 최적화의 before/after를 증명할 수 있다
- ⚠️ **미결(구현):** 두 `limit` 숫자는 `pnpm --filter @moving/web build` 후 실측. Vite 해시 파일명(`index-*.js`) glob이 분할 후에도 의도한 청크를 가리키는지 확인(분할 시 패턴 조정).

### 6-2. 커버리지 래칫 (회귀 금지)

```javascript
// scripts/coverage-ratchet.mjs (개요)
// 1. package별 coverage-summary.json 읽기 (모노레포 — 위치 분산)
//    apps/web/coverage/coverage-summary.json
//    packages/shared/coverage/coverage-summary.json
// 2. docs/coverage-baseline.json의 package별 이전 값과 비교
// 3. 현재 < (baseline - 허용오차) 이면 exit 1 (회귀)
// 4. 통과 시 baseline 갱신은 수동 커밋 — 자동 상승 금지
//
// 허용오차: 0.1%p 이하 미세 변동(도구·반올림)은 회귀로 보지 않음
```

```json
// docs/coverage-baseline.json (Phase 0 백필 후 package별 실측값 커밋)
{
  "apps/web": { "lines": 0, "functions": 0, "statements": 0, "branches": 0 },
  "packages/shared": { "lines": 0, "functions": 0, "statements": 0, "branches": 0 }
}
```

**coverage 측정 제외 대상** (vitest config `coverage.exclude`):

```
**/*.d.ts · **/__tests__/** · **/*.test.ts · **/*.spec.ts
apps/web/e2e/** · apps/web/playwright.config.ts
**/*.config.{ts,js} · packages/shared/src/types/**   ← generated types
```

> **왜 package별인가:** 모노레포라 `coverage-summary.json`이 패키지마다 따로 생긴다(turbo가 위치 분산). 루트 단일 baseline은 합산 왜곡 → web·shared **분리 baseline**이 회귀를 정확히 잡는다.
> **왜 절대 % 목표가 아니라 래칫인가:** 절대 목표치("80% 달성")는 트리비얼 테스트 양산을 부른다(ADR-027 정신 — 가짜 안전감). 래칫은 "한 번 덮은 건 다시 벗기지 마라"만 강제 → 의미 있는 테스트만 늘어난다.
> **왜 제외/오차가 필요한가:** generated types·테스트·config가 섞이면 baseline이 왜곡되고, 반올림으로 미세 변동이 false 회귀를 낸다 → 제외 목록 + 0.1%p 오차.
> baseline 자동 상승 금지: 우연히 오른 커버리지가 천장이 되면 후속 PR이 부당하게 막힌다. 상승은 사람이 의도적으로 커밋.
> ⚠️ **미결(구현):** baseline 값은 **Phase 0 백필 완료 후** 실측 커밋. 그 전엔 래칫 비활성(또는 0).

---

## 7. Web Vitals RUM (PostHog, 사후 모니터)

> **왜 RUM인가:** lab 측정(Lighthouse 등)은 Chromium에서 돌아 WebKit/iOS 성능을 못 본다. RUM(Real User Monitoring)은 *실제 기기·실제 네트워크*에서 측정 → **iOS 포함 field 성능의 진실**. 이건 게이트가 아니라 배포 후 모니터다(머지를 막지 않음).

```typescript
// apps/web/src/observability/webVitals.ts
import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals'
import posthog from 'posthog-js'

const ENABLED = import.meta.env.VITE_APP_ENV === 'production'
let initialized = false // 중복 등록 방지 (HMR·remount·WebView reload)

function report(metric: Metric) {
  if (!ENABLED) return // production build 전용 (test/dev 수집 안 함)
  posthog.capture('web_vitals', {
    metric: metric.name, // LCP / CLS / INP / FCP / TTFB
    value: metric.value,
    rating: metric.rating, // good / needs-improvement / poor
    path: window.location.pathname, // PII 없는 경로만 (쿼리 제외)
    release_channel: import.meta.env.VITE_RELEASE_CHANNEL ?? 'unknown', // internal | production
  })
}

export function initWebVitals() {
  if (initialized) return // 같은 metric 중복 capture 방지
  initialized = true
  onLCP(report)
  onCLS(report)
  onINP(report) // ← INP 포함 (LCP만 보면 인터랙션 지연 못 봄)
  onFCP(report)
  onTTFB(report)
}
```

- **이벤트:** `web_vitals` `{ metric, value, rating, path, release_channel }`
- **수집률:** 100% (트래픽 작아 샘플링 불필요)
- **distinct_id:** `auth.uid()` (ADR-086 PostHog 설정 계승)
- **production build 전용:** test/dev는 off (§3-3). 단 dev=prod라 **internal 테스트도 production build로 빌드**된다 → RUM이 수집됨. 이건 *의도*다(internal도 실기기 성능을 보는 목적). 다만 지표 해석 시 internal 유저가 섞이지 않게 **`release_channel`로 구분**(internal/production). 이 속성으로 PostHog에서 필터링
- **중복 등록 방지:** 모듈 레벨 `initialized` 플래그 — HMR·remount·WebView reload로 `initWebVitals()`가 여러 번 불려도 metric 1회만 등록
- **PII 규율:** `path`는 pathname만(쿼리스트링 제외) — 주소/이메일이 경로에 안 들어가게(ADR-089 정신)
- **수집 범위:** Core Web Vitals(초기 page lifecycle) 중심. **SPA route 전환 후 perceived latency는 미수집** — 라우트 전환 지연이 문제로 보이면 후속에서 custom event 추가

> **왜 INP를 포함하나:** LCP(로딩)만 보면 인터랙션 지연을 놓친다. INP(Interaction to Next Paint)는 2024년 Core Web Vital로 승격된 진짜 반응성 지표. 토글·폼 같은 인터랙션 많은 앱이라 INP가 LCP보다 체감에 가깝다.

---

## 8. CI 통합 (`ci.yml` — fast / e2e 두 잡)

> **동작 모델:** 머지 전 게이트(E2E 양 엔진 + axe + 번들 + 커버리지) ‖ 배포 후 RUM 모니터. 게이트와 모니터는 두 반쪽이다.

```yaml
# .github/workflows/ci.yml (개요 — 기존 하네스 CI에 추가/분리)
jobs:
  fast: # 빠른 피드백 (수십 초~분)
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { cache: 'pnpm' } # pnpm 스토어 캐싱
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test --coverage # 유닛 + 커버리지 측정
      - run: node scripts/coverage-ratchet.mjs # 래칫 (회귀 시 fail)
      - run: pnpm --filter @moving/web build
      - run: pnpm --filter @moving/web size-limit # 번들 가드

  e2e: # 느린 잡, fast와 병렬 (플레이크 격리)
    runs-on: ubuntu-latest
    timeout-minutes: 20 # supabase start + 양 엔진 build/test 상한
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { cache: 'pnpm' }
      - run: pnpm install --frozen-lockfile

      # Playwright 브라우저 캐싱 (os + lock/package hash — 버전·OS 변화 반영)
      - uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: pw-${{ runner.os }}-${{ hashFiles('pnpm-lock.yaml', 'apps/web/package.json') }}
      - run: pnpm --filter @moving/web exec playwright install --with-deps chromium webkit

      # 로컬 Supabase: CLI 설치 → start → readiness wait → reset (바로 테스트 금지)
      - uses: supabase/setup-cli@v1
        with: { version: latest }
      - run: supabase start
      - name: Wait for local Supabase
        run: |
          for i in {1..30}; do
            curl -sf http://127.0.0.1:54321/rest/v1/ >/dev/null && exit 0
            sleep 2
          done
          supabase status; exit 1
      - run: supabase db reset # 마이그레이션 + seed.sql
      # .env.test를 repo에 두지 않고 워크플로에서 생성 (운영 env 혼입 차단)
      - name: Write test env
        working-directory: apps/web
        run: |
          ANON=$(supabase status -o env | grep ANON_KEY | cut -d= -f2- | tr -d '"')
          cat > .env.test <<EOF
          VITE_SUPABASE_URL=http://127.0.0.1:54321
          VITE_SUPABASE_ANON_KEY=$ANON
          VITE_APP_ENV=test
          VITE_POSTHOG_KEY=
          VITE_SENTRY_DSN=
          VITE_DISABLE_AI_GUIDE=true
          EOF

      # playwright.config webServer가 build --mode test && preview 수행
      - run: pnpm --filter @moving/web exec playwright test # chromium+webkit + axe

      # 실패 시에만 리포트 업로드 (용량/시간 절약)
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
```

- **두 잡 분리 이유:** `fast`로 린트/타입/유닛/번들을 빠르게 → 즉시 피드백. `e2e`는 느리고 가끔 플레이크 → **병렬 별도 잡**으로 격리(빠른 체크가 E2E 때문에 늦지 않음)
- **PR마다 + 머지 필수 체크:** 실유저+dev=prod라 회귀를 _머지 전에_ 막아야 함 → 브랜치 보호에 `fast`·`e2e` required 추가(ADR-081 RLS CI required와 같은 패턴)
- **`.env.test`는 워크플로에서 생성:** repo에 커밋하지 않고 e2e job 시작 시 Supabase CLI 출력(`supabase status -o env`)의 로컬 anon key로 덮어쓴다 → 운영 env 혼입 원천 차단
- **CLI 설치 + readiness wait:** runner에 Supabase CLI가 기본 없음(`supabase/setup-cli`) + `start` 직후 Postgres/Auth ready 전 테스트 시작하면 flaky → curl 폴링으로 대기
- **nightly 불필요:** mutation을 뺐으므로 야간 잡 없음. E2E는 PR 게이트로 충분
- **결정성:** 로컬 Supabase 격리로 테스트가 결정적 + Playwright `retries: 2`로 잔여 플레이크 억제
- ⚠️ **미결(구현):** `supabase status -o env`의 정확한 출력 키 형식 확인(로컬 anon key는 보통 고정 데모값이라 하드코딩 fallback도 가능). webServer의 `build --mode test`가 `.env.test`를 읽는지 로컬에서 1회 검증.

---

## 9. 환경 변수 / 시크릿

| 변수                            | 위치                 | 용도                                                 |
| ------------------------------- | -------------------- | ---------------------------------------------------- |
| `VITE_SUPABASE_URL` (test)      | `.env.test` / CI env | 로컬 Supabase(`127.0.0.1:54321`)                     |
| `VITE_SUPABASE_ANON_KEY` (test) | `.env.test` / CI env | 로컬 데모 anon key (민감X)                           |
| `VITE_APP_ENV=test`             | `.env.test`          | RUM/관측 off 분기                                    |
| `VITE_POSTHOG_KEY` (빈값)       | `.env.test`          | 테스트 시 PostHog off                                |
| `VITE_DISABLE_AI_GUIDE=true`    | `.env.test`          | E2E 시 AI background generation 차단(Edge 비의존)    |
| `VITE_RELEASE_CHANNEL`          | EAS/Vercel build env | RUM `release_channel` 속성(internal/production 구분) |
| `VITE_SENTRY_DSN` (빈값)        | `.env.test`          | 테스트 시 Sentry off                                 |

> 운영 RUM은 기존 `VITE_POSTHOG_KEY`(production) 재사용 — 신규 시크릿 없음. RUM은 ADR-086 PostHog 프로젝트에 `web_vitals` 이벤트만 추가.

---

## 10. manual-setup (콘솔 — 코드 아님)

- **GitHub 브랜치 보호:** `main`에 `fast`·`e2e` 잡을 required status check로 추가 (Settings → Branches). ADR-081 RLS CI와 같은 화면
- **로컬 Docker:** E2E 개발/CI에 Docker 필요(`supabase start`). 개발 머신에 Docker Desktop, CI runner는 기본 제공
- **Supabase CLI:** 로컬·CI에 `supabase` CLI 설치(`brew install supabase/tap/supabase` 또는 CI action)

> 신규 외부 서비스 가입·키 발급 없음(에이전트는 로컬 dev 도구, RUM은 기존 PostHog). 12단계 대비 manual-setup이 가볍다.

---

## 11. 개인정보 / 약관

- **변경 없음.** RUM은 기존 PostHog(ADR-086, US, 이벤트만, autocapture off)에 `web_vitals` 이벤트만 추가 → 11단계에서 고지한 PostHog 수탁·국외이전 범위 내. 신규 수탁자·신규 PII 수집 없음
- `web_vitals` 페이로드는 성능 수치 + pathname(PII 없음)만 → 추가 고지 불요
- E2E·유닛·번들 가드는 **개발 인프라**라 사용자 데이터·약관과 무관

---

## 12. ADR (DECISIONS.md 복붙용)

> ⚠️ ADR 번호: 설계 시점 max = **098**. 작성 직전 `docs/ADR.md` 최대번호 재확인 후 +1부터(STATUS 학습 §146 — 가정/실제 어긋난 전례). 아래는 **099 가정**.

### ADR-099: 테스트 격리 = 로컬 Supabase (dev=prod 운영 DB 미오염)

- 결정: E2E·에이전트 탐색을 운영 Supabase가 아닌 **로컬 Supabase**(`supabase start`)에 대고 실행. 마이그레이션으로 스키마 재현 + `seed.sql` 참조 데이터. 일회용 컨테이너라 청소 불필요.
- 이유: dev=prod(ADR-075)라 운영 DB가 곧 개발 DB. 테스트가 이걸 건드리면 실유저 데이터 오염. 로컬 격리로 _오염 문제 자체가 소멸_ + 에이전트 무한 탐색 위험 0(최대 장애물 해소). "치울 공유 상태가 없는 게 최고의 청소."
- 보완: ADR-075(dev=prod)는 _배포 환경_ 얘기 — 테스트는 로컬 일회용으로 가도 "분리하지 않는다"는 철학과 충돌 안 함(운영을 둘로 안 나눔). 세션은 `signInAnonymously()`(ADR-042) + storageState 재사용.
- 대안: 운영 DB + `delete_my_*` cascade 청소(에이전트 탐색이 청소보다 빨리 오염, blast radius 큼), 별도 prod-분리 staging($25/mo Pro — 출시 전 과투자) — 미채택.

### ADR-100: E2E = Playwright Chromium+WebKit 2 플로우, 네이티브 제외

- 결정: E2E는 **Chromium + WebKit** 양 엔진 × **2 플로우**(온보딩→체크리스트→대시보드 / 토글+progress). 사진·푸시는 E2E 제외(실기기 수동).
- 이유: WebKit이 iOS WKWebView *기능 정확성*을 대표(Chromium-only는 iPhone 회귀 못 잡음). critical path 2개만 — 적고 고가치인 테스트가 유지보수 가능. 네이티브 브릿지(카메라·권한·토큰)는 Playwright로 도달 불가 → 수동.
- 보완: 층 분리(E2E=여정 / 유닛=로직 / 수동=네이티브). 스마트 재배치 등 E2E 없는 영역은 유닛 백필이 로직 커버.
- 대안: Chromium만(iOS 미대표), 3+ 플로우(유지보수 비용 > 이득), 사진·푸시 E2E(브라우저 도달 불가) — 미채택.

### ADR-101: a11y = axe-in-Playwright (Lighthouse 대체), WCAG 2.1 AA fail 게이트

- 결정: 접근성은 `@axe-core/playwright`를 E2E spec에 임베드(WCAG 2.1 AA). E2E 플로우 페이지 + 동적 상태(모달 등), 첫 위반 닫고 fail 게이트. best-practice는 warn-only. **Lighthouse CI 미도입.**
- 이유: Lighthouse a11y는 내부적으로 axe를 돌림 → axe 직접 호출이 (a) 별도 도구·브라우저 0, (b) 양 엔진 + 동적 상태까지 커버 → 더 싸고 넓다. Lighthouse 성능 부분은 Chromium-only라 WKWebView 무관(→ RUM이 대체).
- 대안: Lighthouse CI(Chromium-only + 도구 중복), pa11y(별도 러너) — 미채택.

### ADR-102: Web Vitals RUM = PostHog 사후 모니터 (INP 포함, production 전용)

- 결정: `web-vitals`(LCP/CLS/INP/FCP/TTFB) → PostHog `web_vitals` `{metric,value,rating,path}`, 100% 수집, `distinct_id=auth.uid()`, **production 전용, 게이트 아닌 모니터.**
- 이유: lab(Lighthouse)은 Chromium이라 WebKit/iOS 성능 못 봄 → RUM이 _iOS 포함 field 성능의 진실_. INP 포함(LCP만 보면 인터랙션 지연 못 봄, 2024 Core Web Vital). 머지를 막지 않는 사후 관측(게이트와 역할 분리).
- 보완: 기존 PostHog(ADR-086) 재사용 → 신규 수탁자·약관 변경 0. path는 pathname만(PII 제외, ADR-089).
- 대안: 게이트화(field 지표는 환경 편차 커 머지 차단 부적합), Lighthouse lab(iOS 무관) — 미채택.

### ADR-103: 번들 가드 size-limit 래칫 다운 + 커버리지 래칫 (절대 % 아님)

- 결정: 번들은 `size-limit`로 현재 gzip 크기를 천장 → 코드 스플리팅하며 래칫 다운(초과 fail). 커버리지는 절대 목표치 없이 baseline 대비 **회귀 금지 래칫**(baseline은 Phase 0 백필 후 실측, 자동 상승 금지).
- 이유: 측정(baseline) 먼저 → 최적화 before/after 증명 가능(라우트 분할·`exifreader`/`react-day-picker` lazy 타깃 식별됨). 절대 % 목표는 트리비얼 테스트 양산(ADR-027 정신) → 래칫만 강제해 의미 있는 테스트만 증가.
- 대안: 고정 번들 한도(점진 개선 인센티브 없음), 절대 커버리지 % 게이트(가짜 테스트 유발) — 미채택.

### ADR-104: 테스트 작성 = Playwright 에이전트(로컬 dev) + healer diff-gate

- 결정: E2E 초안은 Playwright 에이전트(planner/generator/healer)로 생성 → **사람이 2 플로우로 curate**. 에이전트는 로컬 Supabase에 탐색(오염 0). healer는 **diff-gate**(로컬 수동 호출 → 리뷰 → 반영, auto-commit·CI 스텝 금지). CI는 산출물 `.spec.ts`만 실행(LLM·토큰 0).
- 이유: 학습/포트폴리오 + _통합 난제(dev=prod 격리·게이팅) 해결 자체가 엔지니어링 포인트_. 단 바운드. 무검토 auto-heal은 어설션을 느슨하게 해 진짜 회귀를 초록불로 세탁 → blast radius 높은 이 프로젝트(적은 고가치 테스트 + 실유저 + dev=prod)엔 부적합. 자율성을 blast radius에 맞춤.
- 보완: 에이전트=로컬 대화형 도구, CI=결정적 산출물 실행. 둘을 섞지 않음(CI에 LLM 0).
- 대안: 손으로 전량 작성(학습/난제해결 가치 손실), healer auto-commit(회귀 세탁 위험) — 미채택.

### ADR-105: CI 두 잡(fast/e2e) 병렬 + PR 머지 필수, nightly 미도입

- 결정: `ci.yml`에 `fast`(린트·타입·유닛·커버리지 래칫·번들)와 `e2e`(로컬 Supabase + Playwright 양 엔진 + axe)를 **병렬 별도 잡**으로. **PR마다 + 머지 필수 체크**(브랜치 보호). nightly 잡 없음.
- 이유: 실유저+dev=prod라 회귀를 머지 전에 막아야 함(PR 게이트). 빠른 체크와 느린 E2E를 분리해 피드백 속도 확보 + 플레이크 격리. mutation 뺐으므로 야간 잡 불요. 로컬 Supabase로 결정성 + retries로 플레이크 억제.
- 대안: 단일 잡(E2E 플레이크가 빠른 체크까지 지연), nightly E2E(실유저 환경엔 머지 전 차단이 맞음) — 미채택.

> **제외 기록(ADR 아님, 추적용):** Lighthouse CI(ADR-101 사유), mutation testing(옵션·니치, config 1회로 후속 가능), visual regression(스냅샷 유지보수 > 1인 이득) — 미도입.

---

## 13. 구현 Phase 순서

> 구현은 별도 세션(Claude Code). 토대 → 게이트 → 모니터 순.

- **Phase 0 — 유닛 백필(6영역) → 커버리지 래칫 baseline 설정.** (mutation 1회 감사는 안 함 — 옵션 기록만)
- **Phase A — 로컬 Supabase 하네스 + `seed.spec.ts` 세션 시딩 + storageState.** (토대)
- **Phase B — E2E 플로우(#1·#2)를 에이전트로 초안 → curate, Chromium+WebKit, axe 임베드.**
- **Phase C — 번들 사이즈 가드(size-limit).**
- **Phase D — Web Vitals RUM(`web-vitals` → PostHog).**
- **Phase E — CI 통합(`fast`/`e2e` 두 잡, 캐싱, 브랜치 보호).**

---

## 14. 완료 확인 체크리스트

> ⚠️ 스펙 본문(§13 아님, 여긴 §14)을 직접 `[x]` 체크하지 말 것 — 검증 결과는 `docs/specs/13-quality-lane-verify.md`에 `[x]`/`[△]`/`[ ]`로 기록(STATUS 학습 §145). 아래는 verify 시 옮겨갈 항목.

### Phase 0 — 유닛 백필 / 래칫 baseline

- [ ] 6영역 유닛 테스트 작성 (D-day / progress / 재배치 그룹핑 / 토글·디바운스 / scrub / 매핑)
- [ ] 각 영역 파일 경로·함수명 grep 확인 후 확정 (추측 금지)
- [ ] `pnpm test --coverage` 통과
- [ ] `docs/coverage-baseline.json`에 실측 baseline 커밋

### Phase A — 격리 하네스

- [ ] `supabase start` + `db reset`로 로컬 스키마 재현 + CLI readiness wait 확인
- [ ] `seed.sql`에 운영 master 체크리스트 seed 전체 주입(수동 축약 금지)
- [ ] `.env.test` (로컬 Supabase URL/KEY, PostHog/Sentry off, `VITE_DISABLE_AI_GUIDE=true`)
- [ ] `SUPABASE_STORAGE_KEY` 상수를 앱 클라이언트 + `seed.spec.ts` 단일 출처로 고정
- [ ] `seed.spec.ts` 익명 세션 → storageKey 일치 주입(`page.evaluate`에 값으로 전달) → storageState 저장
- [ ] `.gitignore`에 `apps/web/e2e/.auth/` 추가
- [ ] 브라우저 환경 `isNativeWebView()=false` + seeded session `getUser()` 성공 확인
- [ ] AI 차단 플래그로 상세 진입 시 `generate-ai-guide` invoke 0건 확인

### Phase B — E2E + a11y

- [ ] `playwright.config.ts` (setup + chromium + webkit, webServer = **build --mode test && preview**)
- [ ] #1 온보딩 플로우 (양 엔진 통과)
- [ ] #2 토글+progress 플로우 (양 엔진 통과)
- [ ] axe 위반 수집 → critical/serious 수정 → 0건 확인 → fail 게이트 활성화 (순서대로)
- [ ] `checkA11y` 주요 페이지 + 동적 상태(모달)에 임베드, WCAG 2.1 AA
- [ ] 에이전트 산출물 2 플로우로 curate (과생성 제거)

### Phase C — 번들 가드

- [ ] `size-limit.config.js` `initial entry` + `total JS` 두 예산 실측값으로
- [ ] 코드스플리팅 후 glob이 의도한 청크 가리키는지 확인
- [ ] `pnpm size-limit` 통과 (초과 시 fail 동작 확인)

### Phase D — RUM

- [ ] `webVitals.ts` (LCP/CLS/INP/FCP/TTFB → PostHog, production build 전용, `initialized` 중복 가드)
- [ ] `release_channel` 속성으로 internal/production 구분
- [ ] `initWebVitals()` 앱 진입점 배선
- [ ] 배포 후 PostHog에 `web_vitals` 이벤트 수신 확인 (실측 — verify 잔여)

### Phase E — CI

- [ ] `ci.yml` `fast`/`e2e` 두 잡 분리 + 캐싱(PW 브라우저 `runner.os`+hash, pnpm)
- [ ] `e2e` 잡: `supabase/setup-cli` + readiness wait + `.env.test` 워크플로 생성
- [ ] `e2e` 잡 `timeout-minutes` + 실패 시 playwright-report artifact 업로드
- [ ] `coverage-ratchet.mjs` package별 baseline + 제외/오차로 회귀 시 fail 확인
- [ ] 브랜치 보호에 `fast`·`e2e` required status check 추가 (콘솔)

---

## 15. 엣지케이스 / 주의

- **`.env.test` 모드 누락 → prod DB 강타:** `VITE_*`는 빌드 타임 인라인이라 테스트 빌드는 반드시 `--mode test`로. 운영 빌드 env가 섞이면 E2E가 dev=prod 운영 DB를 때림(치명적). CI 잡에서 모드 명시 고정
- **localStorage 세션 키 불일치 → "session missing":** `supabaseClient`의 `storageKey`와 `seed.spec.ts`가 주입하는 키를 정확히 일치(STATUS §110·§116). 모듈 레벨 평가 타이밍 주의
- **axe 동적 상태 누락:** 모달·시트는 별도 상태라 정적 페이지 검사만으론 빠짐 → 열린 상태에서도 `checkA11y` 호출
- **WebKit 플레이크:** WebKit이 Chromium보다 타이밍 민감 → `retries: 2` + `trace: on-first-retry`로 진단. 결정성은 로컬 Supabase 격리가 1차 보장
- **커버리지 baseline 조기 설정 금지:** Phase 0 백필 _완료 후_ 측정. 백필 전 baseline은 의미 없음
- **size-limit는 빌드 산출물 경로 의존:** Vite 해시 파일명(`index-*.js`) glob이 청크 분할 후에도 메인 청크를 정확히 가리키는지 확인(분할 시 여러 청크 → 패턴 조정)
- **Edge Functions 로컬 serve:** AI 가이드 등 Edge 의존 플로우는 E2E 범위 밖이라 보통 불필요하나, 온보딩이 Edge를 타면 `supabase functions serve` 필요 — 구현 시 확인
- **에이전트 과생성:** Playwright generator가 부수 플로우까지 만들면 유지보수 폭증 → 2 플로우만 남기고 curate. healer diff는 반드시 사람이 리뷰(어설션 약화 감시)
- **RLS CI(10-2)와 e2e job 중복 우려:** 둘 다 로컬 Supabase를 띄우지만 목적이 다르다 — RLS CI는 _DB 정책 격리_ 검증, 13단계 e2e는 _웹앱 여정 + a11y_ 검증. 별도 job으로 유지. 추후 CI 시간이 문제되면 setup 재사용/composite action으로 통합 검토

---

## 16. 면접 대비 핵심 포인트

> **한 줄 핵심:** "손으로 다 못 보는 걸 기계가 대신 검증하게 한 안전망 — 단 WebView·dev=prod라는 우리만의 제약에 맞춰 설계했다."

- **WebView 카드:** iOS=WebKit·안드=크롬 엔진이라 Lighthouse(크롬)는 아이폰을 대표 못 함 → 양 엔진 E2E(WebKit) + 실유저 RUM. "도구를 안 쓴 게 아니라, 우리 렌더 환경에 안 맞아서 더 정확한 걸로 바꿨다."
- **dev=prod 카드 (제일 강함):** 에이전트의 무한 탐색이 운영 DB를 더럽히지 않게 **로컬 Supabase로 격리** — "치울 공유 상태가 없는 게 최고의 청소." 제약(Free tier 단일 인스턴스)을 핸디캡이 아니라 설계 입력으로 다뤘다.
- **판단 카드:** 도구 이름("에이전트 썼다")이 아니라 *왜 그 선택을 했는지*가 핵심. 자율성을 blast radius에 맞춰 조절(healer는 diff-gate). 시니어 무브.
- **동작 멘탈모델:** PR → CI 자동 게이트(통과해야 머지) → 배포 → RUM으로 실유저 관측. "게이트 vs 모니터" 두 반쪽.
- **에이전트 위치:** planner/generator/healer는 _로컬 dev 도구_(LLM·대화형). CI는 산출물(`.spec.ts`)만 실행(LLM 0, 토큰 0). "AI로 짰지만 CI는 결정적."
- **측정 먼저 카드:** 번들 baseline·커버리지 baseline·RUM을 먼저 깔았다 → 이후 최적화(라우트 분할 등)의 before/after를 *증명*할 수 있다. 추측 아닌 데이터 기반 개선.
- **층 분리 카드:** E2E=여정, 유닛=로직, 수동=네이티브. 피라미드를 의식적으로 나눠 각 층이 맞는 걸 검증.

---

## 17. 다음 단계 (스펙 외)

- **Spec 13 완료 = 공개 출시 품질 레인 완성.** 이후 최적화 단계(라우트 코드 스플리팅, lazy import)는 깔린 baseline 위에서 before/after 증명하며 진행
- **옵션(미루는 데 락인 0):** mutation testing 1회 config 감사 / visual regression / Lighthouse(만약 별도 웹 랜딩 추가 시) — 필요해질 때 추가
- E2E 플로우 확장(사진은 여전히 수동, 비-네이티브 신규 플로우는 같은 하네스에 추가)
- RUM 누적 후 실제 INP/LCP 핫스팟 기반 최적화 우선순위 결정
