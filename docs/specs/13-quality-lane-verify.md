# 13단계 품질 레인(Quality Lane) — /verify 리포트

> 검증 세션: 2026-06-22 (구현과 별도 세션 — 자기 코드 관대 방지).
> 대조 기준: `docs/specs/13-quality-lane.md` §14 완료 확인 체크리스트 + 34~63줄 "구현 반영" 블록.
> 게이트 실측은 working tree(미커밋) 기준. 로컬 Supabase 컨테이너 가동 중(`supabase_*_isakok`), REST 200.

## 게이트 실측 요약

| 게이트           | 명령                                   | 결과                                                                                   |
| ---------------- | -------------------------------------- | -------------------------------------------------------------------------------------- |
| Lint             | `pnpm lint`                            | ✅ EXIT 0 (web/shared/mobile)                                                          |
| Typecheck        | `pnpm typecheck`                       | ✅ EXIT 0                                                                              |
| Unit + Coverage  | `pnpm test:coverage`                   | ✅ web 35 tests(5파일) / shared 38 tests(6파일) = 73 통과 (RUM 테스트 +8)              |
| Coverage 래칫    | `pnpm coverage:ratchet`                | ✅ web lines 94%·branches 92.18%(↑, baseline 갱신), shared 74.3%=baseline (8지표 통과) |
| Build            | `pnpm build`                           | ✅ EXIT 0 (gzip 337KB 단일 청크, 빌드 해시 불변)                                       |
| Size-limit       | `pnpm --filter @moving/web size-limit` | ✅ 336.37KB ≤ 345KB (두 예산 모두)                                                     |
| E2E (Playwright) | `playwright test`                      | ✅ **5 passed (56.1s)** — setup(1회) + 2플로우 × Chromium/WebKit (수정 후 재실행)      |

E2E 상세(수정 반영 후 재실행): `[setup] seed` **1회만**(P2 testIgnore로 브라우저 프로젝트 중복 제거 — 7→5 tests) / `[chromium]`·`[webkit]` 토글·온보딩 통과. axe는 정적 페이지 + **동적 상태(설정 '이사 정보 수정' 시트)**에 임베드되어 양 엔진 위반 0건.

> ⚠️ 검증 도중 로컬 Docker/Supabase가 한 번 내려가 재기동(`stop --no-backup` → `start`) 후 위 수정 반영분을 재실행해 5 passed 확인. publishable 키는 결정적이라 `.env.test` 불변.

## 수정 반영 (2026-06-23 — 후속 세션)

verify가 식별한 "커밋 전 권장 수정" + 코드로 고칠 수 있는 follow-up을 모두 반영. 각 항목은 아래 해당 섹션(체크리스트/Codex/서브에이전트)에도 problem→fix로 기록.

- ✅ **[Codex P2] seed.spec.ts 브라우저 프로젝트 중복 실행** — `playwright.config.ts`에 `SETUP_SPEC=/seed\.spec\.ts/` 상수 도입(setup은 `testMatch`로 이 파일만, chromium/webkit은 `testIgnore`로 제외). **재실행 7→5 tests 확인**(seed 1회만).
- ✅ **[web-a11y 🔴] axe 동적 상태 미커버** — 토글 플로우에 설정 → '이사 정보 수정' 시트 열고 `checkA11y` 추가. **양 엔진 위반 0건 확인**(시트 axe-clean). Phase B 체크리스트 [△]→[x].
- ✅ **[spec-reviewer 🟡] RUM 테스트 부재** — `events.test.ts`에 WEB_VITALS 화이트리스트 케이스(원경로 `path` 탈락) + `webVitals.test.ts` 신설(`toRoutePattern` UUID/숫자 정규화 · report PII 화이트리스트 · `release_channel` fallback/값 · `initialized` 가드 · ENABLED=false). web 커버리지 **lines 93.01→94% · branches 90.56→92.18%↑** → `coverage-baseline.json` 갱신(상승 잠금).
- ✅ **[Codex P1] storageKey 마이그레이션 불변식** — `auth/constants.ts` JSDoc에 "웹 미발급→마이그레이션 불요, 향후 웹 단독 익명세션 도입 시 필요" 명문화(동작 변경 없음, 무효 판정 유지).
- ✅ **ADR 099~105 추가(반영)**: `docs/ADR.md`에 7개 추가(max 098 확인). 실제 구현 반영(RUM `route`·`@size-limit/file`·CI `verify` 유지).
- ⏭️ **미반영(의도)**: size-limit `initial entry` 하향(코드 스플리팅 PR 시) · 브랜치 보호 required · 배포 후 PostHog 수신 실측 — 콘솔/배포/미래 단계 잔여.

---

## 완료 확인 기준 결과

### Phase 0 — 유닛 백필 / 래칫 baseline

- [x] 6영역 유닛 테스트 작성 — dateLabel(D-day)·progress(essential)·urgencyMode(재배치)·optimisticToggle+memoSaveMachine(토글·디바운스)·scrub(PII)·conditionTags(매핑). spec-reviewer가 함수명·경로 일치 확인.
- [x] 각 영역 파일 경로·함수명 grep 확인 후 확정 — 추측 없이 순수 추출(`now` 주입으로 순수성 확보).
- [x] `pnpm test --coverage` 통과 — **73 tests green**(web 35 + shared 38, RUM 테스트 +8).
- [x] `docs/coverage-baseline.json` 실측 baseline — **web 94 / shared(utils) 74.3**(RUM 테스트 추가로 web 92.93→94 상승, baseline 갱신 잠금). 미커밋 상태로 존재.

### Phase A — 격리 하네스

- [x] `supabase start` + `db reset` 로컬 스키마 재현 + readiness wait — 컨테이너 가동·REST 200 확인(readiness wait는 CI 측 curl 폴링으로 ci.yml에 존재).
- [x] `seed.sql` 운영 master 전체 주입 — 774줄, 46행 단일 INSERT(수동 축약 없음). system_config는 migration 00008이 주입(seed 불필요 — 정상).
- [x] `.env.test`(로컬 URL/KEY, PostHog/Sentry off, `VITE_DISABLE_AI_GUIDE=true`) — 6개 변수 전부 존재, gitignore 처리.
- [x] `SUPABASE_STORAGE_KEY` 단일 출처 — `packages/shared/src/auth/constants.ts` → 배럴 export → 앱 클라이언트 + seed.spec + prefill 동일 import.
- [x] `seed.spec.ts` 익명 세션 → storageKey 주입(`page.evaluate`에 값으로 전달) → storageState 저장 — E2E setup 통과.
- [x] `.gitignore`에 `apps/web/e2e/.auth/` 추가 — `.gitignore` 확인(security-auditor).
- [x] 브라우저 `isNativeWebView()=false` + seeded session `getUser()` 성공 — E2E 플로우가 seeded 세션으로 동작.
- [x] AI 차단 플래그로 상세 진입 시 invoke 0건 — early-return이 타입 안전 성공 객체 반환(ux-state-reviewer 확인). 토글 플로우(상세 경유) Edge 비의존으로 통과.

### Phase B — E2E + a11y

- [x] `playwright.config.ts`(setup + chromium + webkit, webServer = `build --mode test && preview`) — `--host 127.0.0.1 --strictPort`, `workers:1`, `loadEnv('test')` 주입.
- [x] #1 온보딩 플로우 양 엔진 통과 — E2E #3(chromium)·#6(webkit).
- [x] #2 토글 플로우 양 엔진 통과 — E2E #2(chromium)·#5(webkit). (구현반영: "progress 증가" → "완료 토글 후 그 항목이 할 일에서 소거", ActionSection `filter` 기반 구조적 단언.)
- [x] axe 위반 0건 → fail 게이트 활성화 — `toEqual([])` 게이트, 검사 페이지 위반 0.
- [x] `checkA11y` 주요 페이지 **+ 동적 상태(모달)** 임베드 — 정적 3상태(온보딩 step1·대시보드·항목 상세) **+ 동적 상태 1건(설정 '이사 정보 수정' 시트)**. **수정 반영(2026-06-23)**: 토글 플로우에서 시트를 열고 `checkA11y` 호출 → 양 엔진 위반 0건 확인. 스펙 §5-3·§14·§15 동적 상태 요구 충족. (원 문제: web-a11y-reviewer 🔴 — 정적만 커버·시트 9개 게이트 미진입. 아래 서브에이전트 결과 참조.)
- [x] 에이전트 산출물 2 플로우로 curate — 2플로우만 유지(과생성 제거).

### Phase C — 번들 가드

- [x] `.size-limit.js` `initial entry` + `total JS` 두 예산 실측값 — 둘 다 345KB(실측 gzip 336 + 헤드룸). 파일명 `.size-limit.js`(ESM `export default`, STATUS §153).
- [x] 코드스플리팅 후 glob이 의도한 청크 가리키는지 확인 — perf-budget-reviewer가 `/tmp` 격리 빌드로 실증: `index-*.js`=엔트리 전용, `*.js`=전체 포착. (실제 스플리팅은 §17 다음 단계 — 분할 PR에서 `initial entry` limit 하향 필수, 아래 🟡 참조.)
- [x] `pnpm size-limit` 통과(초과 시 fail) — 336.37 ≤ 345 통과.

### Phase D — RUM

- [x] `webVitals.ts`(LCP/CLS/INP/FCP/TTFB → PostHog, production 전용, `initialized` 가드) — `captureEvent` 래퍼 경유 + `toRoutePattern`(동적세그먼트 `:id` 정규화) + `ENABLED=isProduction()`.
- [x] `release_channel` 속성으로 internal/production 구분 — payload에 포함.
- [x] `initWebVitals()` 앱 진입점 배선 — `main.tsx` 렌더 전 동기 등록(LCP/FCP 누락 방지, 비블로킹).
- [ ] 배포 후 PostHog `web_vitals` 수신 확인 — **배포 후 실측 잔여**(코드 검증 불가).

### Phase E — CI

- [x] `ci.yml` 두 잡 분리 + 캐싱 — 기존 `verify`(=fast 역할) 유지 + `e2e` 신설(개명 회피 — required check·pr-summarize 보호). PW 캐시 `runner.os`+hash, pnpm 캐시.
- [x] `e2e` 잡: `supabase/setup-cli@v2`(2.105.0 핀) + readiness wait(curl 폴링) + `.env.test` 워크플로 생성(`status -o json`+jq).
- [x] `e2e` 잡 `timeout-minutes` + 실패 시 playwright-report artifact 업로드.
- [x] `coverage-ratchet.mjs` package별 baseline + 제외/0.1%p 오차로 회귀 fail — 실행 통과(자동 상승 금지 확인).
- [ ] 브랜치 보호에 `verify`·`e2e` required status check 추가 — **콘솔 잔여**(첫 push 후 Settings → Branches).

---

## 누락 (스펙에 있는데 구현 안 됨)

- **없음** (코드로 검증 가능한 범위). `support/cleanup.ts`는 스펙이 "옵셔널"로 명시(로컬 일회용이라 cascade 정리 불요) → 의도적 생략, 누락 아님.
- 잔여로 명시된 항목(코드 외): 배포 후 PostHog 수신 실측 · 브랜치 보호 required · ADR 099~105 `docs/ADR.md` 번호 확정 반영 — 전부 스펙/STATUS에 잔여로 기록됨.

## 스코프 크립 (구현했는데 스펙에 없음)

- **없음 (전부 정당화됨).** `e2e/support/prefill.ts`·`e2e/support/onboarding.ts`·Playwright Test Agents(`.claude/agents/playwright-test-*`)는 스펙 56~61줄 "추가분(영상 하네스 학습)" 블록에 근거 명시.

## 컨벤션 위반

- **없음.** storageKey를 `@moving/shared` 배럴에서 import하는 것은 패키지 public 엔트리(서브패스 `@moving/shared/auth/constants` 미해결 → 배럴 사용, 구현반영 51줄 명시)라 apps/web "feature 배럴 금지" 규칙과 무관. 테스트는 co-located `*.test.ts`로 컨벤션 준수.

---

## Codex 코드리뷰 결과

원본 리뷰: working tree diff 대상, P1 1건 / P2 1건.

- **[P1] apps/web/src/lib/supabase.ts:20 — storageKey 변경 전 기존 세션 마이그레이션**
  - 문제: storageKey를 supabase-js 기본 키(`sb-<ref>-auth-token`)에서 `isakok-auth-token`으로 바꾸면, 기존 웹/브라우저 유저가 옛 키에 저장한 세션을 못 읽어 로그아웃 → 온보딩 리다이렉트 → 기존 move 데이터 고아화 우려. (Codex 권고: 옛 키 유지 또는 1회 마이그레이션.)
  - 수정: **⏳ 무효 판정 — 코드 수정 불요.** security-auditor가 앱 인증 토폴로지로 반증: ① 웹 브라우저 직접 접속은 `signInAnonymously()`를 **호출하지 않음**(호출처 전수 추적 — 네이티브 AuthService·E2E·검증스크립트뿐, `apps/web/src` 런타임 0건). 순수 웹 유저는 발급된 세션이 없어 옛 키에 저장된 적도 없음 → **마이그레이션 대상 = 공집합**. ② 세션은 네이티브 셸이 브릿지로 메모리 주입(`persistSession: false` in native). ③ 네이티브 셸이 진입 시 `sb-*-auth-token` 기본 키를 **능동 삭제**(`INJECTED_BEFORE_LOAD`). → 일반 SPA 가정엔 맞으나 이 앱엔 비적용. **단 follow-up**: 향후 웹 단독에서 `persistSession:true`로 익명 세션을 자체 발급하면 그 시점부터 storageKey 1회 마이그레이션 필요(불변식 종속). **→ 2026-06-23 반영**: 이 불변식을 `packages/shared/src/auth/constants.ts` JSDoc에 명문화(코드 동작 변경 없음, 회귀 시 단서).

- **[P2] apps/web/playwright.config.ts:31 — setup spec이 브라우저 프로젝트에서도 실행**
  - 문제: setup 파일명이 `seed.spec.ts`라 Chromium/WebKit 프로젝트가 기본 `*.spec.ts` 매칭으로 **setup 의존성과 별개로 한 번 더** 실행. `testIgnore` 부재 확인. **E2E 실행 출력으로 실증됨** — seed가 3회 실행(`[setup]` #1 + `[chromium]` #4 + `[webkit]` #7). 정상 브라우저 런마다 익명 유저 2개 추가 생성 + 공유 storageState(`anon.json`) 재기록 → 결정성 부채(이번 런은 통과했으나 fragile).
  - 수정: **✅ 수정 완료(2026-06-23).** `playwright.config.ts`에 `SETUP_SPEC = /seed\.spec\.ts/` 상수를 두고 setup은 `testMatch: SETUP_SPEC`, chromium/webkit은 `testIgnore: SETUP_SPEC`로 분리. **재실행 결과 7→5 tests**(seed가 `[setup]`으로 1회만 실행, 브라우저 프로젝트 중복 제거) 확인. 익명유저 추가 생성·storageState 재기록 부채 해소.

---

## spec-reviewer 결과

복잡 단계(CI+클라이언트+다수 파일, 794줄 스펙)라 호출.

- **일치 🟢**: 6영역 백필 함수명·경로, 래칫(package별+0.1%p+자동상승금지), storageKey 단일출처, seed 46행 전체, E2E config(`build --mode test && preview`·workers1·loadEnv), RUM(captureEvent+route정규화+가드), AI 가드(DashboardPage 마운트 발화→서비스 진입부 early-return), CI(verify유지+e2e신설·setup-cli핀·size-limit `@size-limit/file`) — 전부 "구현반영" 블록과 정밀 일치.
- **차이**: 8개(size-limit 도구·RUM 래퍼·AI가드 위치·flow#2·온보딩 3스텝·storageKey 배럴·color-contrast 제외·viewport)는 스펙 **본문 옛 가정**과 다르나 모두 "구현반영" 블록에 사유 명시 → 정당.
- **누락**: 없음(cleanup.ts 옵셔널, 콘솔/배포 잔여는 명시됨).
- **스코프크립**: 없음(추가분 블록 근거).
- 판정: **🔴 0건 / 🟡 2건** — (a) size-limit 두 예산 동일 345는 분할 후 `initial entry`만 하향 필요(미래 신호), (b) `events.test.ts`에 WEB_VITALS 화이트리스트(`route`/`release_channel`만 통과, PII 키 탈락) + `toRoutePattern` 정규화 직접 테스트 부재 → 회귀 방어망 보강 권장. **→ ✅ 반영(2026-06-23)**: events.test.ts WEB_VITALS 케이스 + webVitals.test.ts 신설로 보강(커버리지 상승). (a)는 코드 스플리팅 PR로 이월.

## 서브에이전트 리뷰 결과

- **security-auditor**: 🔴 0 / 🟡 2 / 🟢 다수 — **Codex P1 무효 판정**(위 참조). 🟡: ① P1 무효 판정이 "웹 미발급" 불변식에 종속(follow-up 메모 권장), ② `apps/web/e2e/.auth/anon.json` 워킹트리 존재(로컬 만료 토큰·민감도 낮음, `.gitignore` 처리됨 — PR 전 `git status --ignored`로 1회 육안 확인 권장). 🟢: service*role/`sb_secret*`앱 소스·E2E 0건(anon만),`.env.test`publishable+로컬URL뿐, prefill의`p_user_id`는 RPC `IS DISTINCT FROM auth.uid()` 가드로 위조 불가.
- **web-a11y-reviewer**: 🔴 1 / 🟡 3 / 🟢 3 — **🔴 axe 게이트가 모달/시트를 한 번도 열지 않음**(스펙 4회 요구한 동적상태 검사 0건, 시트 9개 게이트 미진입). 마침 axe가 못 잡고 이 에이전트 영역인 포커스 트랩/복귀/dialog 시맨틱 결함(`MoveEditSheet`에서 `role="dialog"`·focus trap·Escape·포커스 복귀 부재 실관찰)이 회귀 안전망에서 누락. **수정**: 기존 2플로우 안에서 시트 1개 열고 `checkA11y` 추가(새 플로우 신설 아님 → 과생성 제약 무충돌), 또는 위 [△] 기록 유지. 🟢: viewport `maximum-scale=1.0` 제거(WCAG 1.4.4 올바른 수정, textarea 16px라 iOS 입력줌 무관) · color-contrast 한 룰만 제외(구조적 위반은 계속 게이트) · MemoSection 회귀 0(aria-label·role=status/live·heading 양호). 🟡: 타 폼컨트롤 폰트 iOS 줌 점검 / color-contrast 전역 제외 정밀화(셀렉터 한정) / 상태 전이 후 checkA11y.
- **ux-state-reviewer**: 🔴 0 / 🟡 0 — 4상태 완전 3/3. **early-return 상태 누락 0건**: AI 가드가 `{status:'ok',source:'cache_hit',updated:0}`(타입 안전 유니온 멤버) 즉시 resolve → loading 매달림 없음. 유일 소비처(DashboardPage)는 반환값을 UI 분기에 안 씀. useToggleItem 롤백(previousToday/Timeline 복원+haptic+toast) 온전. memoSaveMachine error 시 inFlight/pending 정리로 데드락 방지. (정보: 토글/메모 실패 toast가 ux-writing-guide "원인+해결" 권장 대비 해결 안내 부족 — 등급 외.)
- **perf-budget-reviewer**: 🔴 0 / 🟡 2 / 🟢 다수 — size-limit 두 예산이 분할 후 회귀 포착 **실증 완료**(`index-*.js`=엔트리, `*.js`=전체). web-vitals +gzip 2.4KB(`attribution` 빌드 회피), `initWebVitals()` 비블로킹(콜백 등록만), production 게이트 정확(test는 `development` 폴백→미수집). 라우트 분할 보류는 "측정 먼저" 원칙상 합당. 🟡: ① 분할 PR에서 `initial entry` limit을 실측+~10KB로 **하향 필수**(안 하면 dead ceiling — 엔트리 145KB 회귀까지 통과), ② `manualChunks`/벤더 분리 도입 시 `initial entry` glob 다중 패턴 확장(벤더 우회 방지).

---

## 종합 판정

**✅ 통과 — 커밋 전 권장 수정 2건 반영·재검증 완료(2026-06-23). 게이트·E2E 전부 green.**

6개 게이트 + E2E 양 엔진 전부 통과. 구현이 스펙 "구현 반영" 블록·§14와 정밀 일치하며, 모든 차이는 사유 명시·모든 누락은 옵셔널/잔여로 명시됨. spec/ux-state/security/perf 리뷰에서 **🔴 차단 0건**, Codex P1 무효 판정. verify가 식별한 커밋 전 권장 수정 2건 + RUM 테스트·P1 메모는 후속 세션에서 반영·재검증 완료(위 "수정 반영" 섹션).

### 커밋 전 권장 수정 (반영 완료)

1. ✅ **[P2 — Codex, 실증됨] `playwright.config.ts` seed.spec.ts 브라우저 프로젝트 실행 차단** — `testIgnore: SETUP_SPEC` 적용. **재실행 7→5 tests 확인**(seed `[setup]` 1회만).
2. ✅ **[web-a11y 🔴] axe 동적 상태(시트) 커버리지** — 토글 플로우에 설정 '이사 정보 수정' 시트 `checkA11y` 추가. **양 엔진 위반 0건 확인**.

### follow-up 상태

- ✅ **RUM 테스트 보강(반영)**: `events.test.ts` WEB_VITALS 화이트리스트 + `webVitals.test.ts`(`toRoutePattern`·report PII·release_channel·가드) 신설. 커버리지 상승·baseline 갱신.
- ✅ **Codex P1 follow-up 메모(반영)**: `auth/constants.ts` JSDoc에 마이그레이션 불변식 명문화.
- ⏭️ **🟡 size-limit `initial entry` 하향**: 라우트 코드 스플리팅 PR(§17)에서 실측+~10KB로 래칫 다운(dead ceiling 방지). `total JS` 345는 영구 유효. (분할 전이라 지금 하향 불가 — 미래 단계.)
- ✅ **ADR 099~105(반영)**: `docs/ADR.md`에 추가 완료(2026-06-23).
- ⏭️ **잔여(콘솔/배포)**: 브랜치 보호 `verify`·`e2e` required 추가 · 첫 PR run으로 `e2e` CI 잡 실측 · 배포 후 PostHog `web_vitals` 수신 확인 · `git status --ignored`로 `.auth/anon.json` 미커밋 육안 확인.
