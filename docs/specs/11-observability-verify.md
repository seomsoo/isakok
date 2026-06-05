# 11단계 관측(Observability) — 검증 리포트

> 검증일: 2026-06-06 · 스펙: `docs/specs/11-observability.md` · 대상: 미커밋 working tree (관측 레이어 신규 + 이벤트 계측 + 방침 갱신)
> 빌드/린트/테스트: `pnpm build` ✅(exit 0) · `pnpm lint` ✅(exit 0) · `pnpm test` ✅(16/16)

이 단계는 **코드 범위와 콘솔/운영 범위가 명확히 분리**된 스펙(§3-3·§4-3·§5-4·§10)이다. 아래 체크리스트에서 코드 항목은 모두 충족하며, 미충족 항목은 전부 스펙이 "코드 외"로 분리한 콘솔/운영 단계(UptimeRobot·Discord·Vercel env 실측·PostHog 콘솔 IP 설정·대시보드 육안 검증)다.

> **콘솔/운영 업데이트(2026-06-06)**: 검증 후 콘솔 세팅을 실제로 완료함 — Sentry/PostHog 프로젝트 생성, Vercel 환경변수 주입(소스맵 토큰 3종 포함), health Edge Function 배포·검증, UptimeRobot 모니터 2 + 이메일/Discord, PostHog "Discard client IP" ON. 아래 체크리스트의 해당 콘솔 항목을 [x]로 갱신. **잔여는 전부 "코드 머지→prod 배포 후 실측"** (종합 판정 하단 참조).

---

## 완료 확인 기준 결과

### Phase A — 공통 기반

- [x] `getEnv()` (VITE_APP_ENV 1순위, host/빌드모드 fallback) — `env.ts`
- [x] Sentry 프로젝트 1개 생성 + PostHog **1개**(Free — dev/prod는 `environment` 태그, ADR-088) — **콘솔 완료(06-06)**
- [x] 새 환경변수 주입 — Vercel Production(DSN·APP_ENV·POSTHOG_KEY·SENTRY_AUTH_TOKEN/ORG/PROJECT) + 로컬 `.env.local` — **콘솔 완료(06-06)**
- [△] Vercel `VITE_APP_ENV` — **Production=`production` 주입 완료(06-06)**; 배포 후 실측 + Preview/internal 미설정(getEnv fallback이 prod로 오분류하는 Codex P2 위험)은 잔여 — **(배포 후)**
- [△] Sentry environment / PostHog 키 의도값 — **env·키 주입 완료**; 대시보드에 의도값(env=production·올바른 프로젝트)으로 찍히는지 실측은 배포 후 — **(배포 후)**

### §1 Sentry

- [x] `@sentry/react` init (dsn/environment/release/`sendDefaultPii:false`/`tracesSampleRate:0`) — `sentry.ts`
- [x] `beforeSend` 스크럽 (headers/cookies/query/body/breadcrumb/user, stripUrl, allowlist) — `scrub.ts`
- [x] `Sentry.setUser({ id })`만 — `sentry.ts:51-54`
- [x] `@sentry/vite-plugin` 소스맵 업로드 + release 일치 + `dist/**/*.map` 삭제 — `vite.config.ts` (SENTRY_AUTH_TOKEN 있을 때만)
- [x] 브릿지 타임아웃: native only / 공개 라우트 제외 / 12초 / instance당 1회 / prod만 warning — `bridgeMonitor.ts`
- [x] BridgeMessage 파싱 실패 → Sentry 캡처 — `webSessionListener.ts:49`
- [△] WebView onError/onHttpError 네이티브 fallback UI — **mobile 측(WebViewScreen) 기존 구현, 이 diff 밖** — 사전 존재 확인 권장
- [△] WebView 내 전송 + CSP allowlist — **CSP 없음=미차단 확인(06-06; index.html·vercel.json·네이티브 모두)**; 실 WebView 전송은 배포 후 — **(런타임)**

### §2 PostHog

- [x] `posthog-js` init (autocapture/pageview/replay off, US host) — `posthog.ts`
- [x] distinct_id = auth.uid(), AUTH_SESSION 후 `identify`, alias 미사용 — `webSessionListener.ts:59` + `posthog.ts`
- [△] 이벤트 택소노미 — 핵심 퍼널 전부 wiring. `signup`/`photo_gate_cancelled`/toggle `category`는 **ADR-086 명시 follow-up**(아래 누락 참조)
- [x] 이벤트 속성 allowlist + person properties 미사용 — `events.ts` `filterProps`
- [x] `account_delete_completed` 이전 userId 미포함 — `DeleteAccountSheet.tsx:77-78` (reset 후 발행)
- [x] bridge\_\* PostHog 미전송(Sentry 전용) — `bridgeMonitor`는 `captureMessage`만 사용

### §3 업타임

- [x] `health` Edge Function (GET/HEAD·405·200/503·데이터 미반환·timeout 2s·no-store·경량쿼리·service_role 미사용) — `health/index.ts` + `config.toml` verify_jwt=false
- [x] UptimeRobot 모니터 2개 (isakok-web-prod·isakok-health-prod, 5분) — **콘솔 완료(06-06)**
- [x] 이메일 + Discord 웹훅 알림 (다운/복구) — **콘솔 완료(06-06)**

### §4 환경 분리

- [x] Sentry `environment` 태그 — `sentry.ts:34` (prod 알림 라우팅은 콘솔)
- [△] PostHog dev/prod 분리 — **단일 프로젝트+`environment` 태그로 변경(ADR-088)**; dev 누출 없음 실측은 배포 후

### §5 PII 스크럽

- [x] Sentry: user=id only, denylist 스크럽, allowlist extra/context — `scrub.ts`
- [x] PostHog: distinct_id=uuid, 속성 allowlist, person properties 미사용 — `events.ts`/`posthog.ts`
- [x] IP off — Sentry `sendDefaultPii:false`+scrub(코드 강제); **PostHog 콘솔 "Discard client IP" ON 완료(06-06)** — H-3 콘솔 측 해소(코드 강제는 선택 하드닝)
- [ ] 대시보드 실 페이로드 육안 검증 — **(콘솔, §5-4)**

### §6 방침

- [x] 처리위탁/국외이전에 Sentry·PostHog(US) 추가 + "최소 기술정보 처리" 표현 — `PrivacyPage.tsx:112-155`
- [△] 보유기간 콘솔 실제값 확인 — **PostHog 1년=Free 확인(06-06)**; Sentry retention 콘솔 확정 잔여 (현재 방침엔 추정값 Sentry 30일/PostHog 12개월)
- [x] `/privacy` 페이지 반영 — `PrivacyPage.tsx`

### 공통

- [x] init·전송 실패가 앱 기능에 영향 없음 (swallow/log-only) — 전 모듈 try-catch + 키 가드
- [x] `pnpm build` / `pnpm lint` / `pnpm test` 통과

> 범례: [x] 충족 · [ ] 콘솔/운영 단계(코드 외) · [△] 코드 충족 + 운영/사전존재 확인 잔여

---

## 누락 (스펙에 있는데 구현 안 됨)

스펙 §2-2 택소노미에 **정의**됐으나 **발행(capture) 미wiring** — 셋 다 `docs/ADR.md` ADR-086에 근거와 함께 의도적 follow-up으로 기록됨(스펙-구현 차이가 ADR로 정당화). 회귀 방지용으로 보존:

- **`signup` 이벤트 미발행** — `AUTH_SESSION` payload(`bridge.ts:46-53`)에 `is_new_user`가 없어 web에서 신규/기존 구분 불가. web은 익명→식별 전환만 `login`으로 기록(`webSessionListener.ts:61-63`). → native/server 후속.
- **`photo_gate_cancelled` 미발행** — 게이트 취소는 네이티브 로그인 시트 측에서 발생. 현재 web에선 `photo_gate_shown`/`photo_gate_login_clicked`만 발행. → follow-up.
- **`checklist_item_toggled`의 `category` 속성 미전송** — `useToggleItem.ts:17`이 `{ completed }`만 전송(allowlist엔 `category` 등재됨). 호출부에서 category thread 필요. → follow-up.
- **(참고) WebView onError/onHttpError 네이티브 fallback UI(§1-4)** — apps/mobile 측 기존 구현이라 이 diff 밖. 사전 존재 여부만 확인 권장(누락 아님으로 추정).

> 그 외 §8 미체크 항목은 전부 콘솔/운영(UptimeRobot·Discord·Vercel env 실측·PostHog IP 콘솔·대시보드 육안)으로, 스펙이 명시적으로 "코드 외"로 분리한 것 → 누락 아님.

---

## 스코프 크립 (구현했는데 스펙에 없음)

- **없음 (문제성).** `ALLOWED_EVENT_PROPS`가 스펙 §2-2 예시(3개)보다 7개 더 등록(native_media `kind`/`count`, photo_gate `source`, login/signup `provider`)했으나, 모두 **§2-2 택소노미 본문에 정의된 이벤트의 비식별 enum/scalar 속성**이라 스코프 크립 아님(spec-reviewer 확인). `filterProps`가 미등록 키를 전부 제거해 화이트리스트를 상수로 강제.
- 경미한 방어적 보강(스펙 의도 내): `webSessionListener.looksLikeBridgeAttempt`(foreign postMessage 오탐 방지), scrub denylist에 `apikey`/`access_token`/`refresh_token` 추가, posthog `capture_pageleave:false`·`ui_host`.

---

## 컨벤션 위반

- **없음.** 관측 모듈 전부 named export·JSDoc·import 순서 준수. `@/observability/`로 분리돼 레이어 규칙(features가 관측을 직접 들고 있지 않음) 준수. `tsc`/`eslint` 통과. `as` 단언은 기존 브릿지 파싱 패턴 범위 내.

---

## Codex 코드리뷰 결과

`/codex:review` (working tree diff) — P1 0건 / P2 1건.

- **[P2] `apps/web/src/observability/env.ts:21` — 누락 env가 production으로 기본 판정될 수 있음**
  - 문제: `VITE_APP_ENV`가 빠진 Vercel preview/internal 배포에서도 Vite 빌드는 production 모드라 `import.meta.env.PROD === true` → fallback이 그 배포를 `production`으로 분류. 브릿지 경고가 prod Sentry로 가고, 내부/테스트 활동이 prod 관측에 섞일 수 있음(이 헬퍼가 막으려던 바로 그 경우).
  - 수정: ⏳ **미반영 (스펙 설계대로)**. 스펙 §4-2 코드 블록이 이 fallback과 **정확히 동일**하고, 완화책은 §4-3 "각 deployment에서 `VITE_APP_ENV` 명시 + 실측"으로 운영 단계에 위임돼 있음. env.ts 주석도 "fallback only — deployment에 명시 주입 전제"로 명기. 즉 스펙 위반이 아니라 스펙이 택한 트레이드오프. **선택적 하드닝**으로 "fallback을 production이 아닌 development로" 두거나 "미명시 시 console.warn"을 추가하면 휴먼 미스에 더 강건해짐 — 출시 전 Vercel 전 deployment에 `VITE_APP_ENV`가 실제로 박혔는지 실측으로 갈음 가능.

---

## spec-reviewer 결과 (복잡 단계 — Edge Function + 클라이언트 + PII)

스펙 §8 체크리스트 코드 항목 전수 + 사용자 지목 5개 포인트 심층 비교. **🔴 0건.**

- 🟢 일치: §1 Sentry init·§5 스크럽·§1-3 브릿지 6규칙 전부·§3-2 health 8규격 전부·§2 PostHog·§2-3 distinct*id/identify/reset·§4 환경분리·소스맵 release 일치·§9 swallow·bridge*\* Sentry 전용·ADR 번호(085~089) 정합·§6 방침("최소 기술정보 처리" 표현 정확).
- 🟢 사용자 지목 검증: ①미발행 3종은 ADR-086 명시 follow-up(누락 아님) ②브릿지 방어 완전 일치 ③health 규격 완전 충족 ④allowlist 확장은 비식별·택소노미 내(스코프 크립 아님) ⑤방침 정확 반영.
- 🟡 권장(비차단): (a) `account_delete_completed` race window — 네이티브가 새 익명 세션 생성(`AuthService.ts:324`) 전에 `ACCOUNT_DELETE_RESULT` broadcast하나, `posthog.reset()`이 이미 새 anon distinct_id를 만들어 "이전 userId 미포함"은 충족. 엄밀히 "새 익명 uid 기준"을 원하면 새 AUTH_SESSION 후 발행으로 이동 검토. (b) `photo_gate_shown`(source: `photo_room`) vs `photo_gate_login_clicked`(source: `photo_gate`) 값 체계 불일치 → 전환율 join 시 혼동, 컨벤션 통일 권장. (c) `observability/`에 단위 테스트 부재 — `scrub`/`filterProps`/bridge instance-once는 순수 로직이라 PII 회귀 방지 테스트 추가 권장.

---

## 서브에이전트 리뷰 결과

- **spec-reviewer**: 🔴 0 / 🟡 3 / 🟢 다수 — 위 별도 섹션 참조.
- **security-auditor**: 🔴 0 / 🟡 5 / 🟢 6 — PII가 관측 payload로 직접 새는 경로·토큰 누수 경로 없음 확인. 🟡 핵심: **[H-1] `scrubEvent`가 exception message·stacktrace·`event.message`를 스크럽하지 않음** — 실무 최대 PII 누수원(에러 메시지에 박힌 주소/메모/이메일, Supabase 에러 메시지의 쿼리 파라미터, stack frame `filename`의 query). 스펙 §5-2가 표준 필드(user/request/breadcrumb/extra/contexts)는 다 커버하나 메시지/스택은 호출부 규율(메시지에 PII 미포함)에만 의존. **§5가 "관통 스크럽"을 표방하므로 출시 전 보강 강권**. [H-2] `stripDenyKeys` 1-depth만 순회(중첩 PII 통과, 호출부 allowlist가 1차 방어라 설계상 한계지만 코드 게이트 부재). [H-3] PostHog IP 비저장이 콘솔 "Discard client IP" 설정 의존(휴먼 미스 취약, 코드 강제 권장). [H-4] `filterProps`는 견고하나 `posthog-js` 직접 import 차단(ESLint)으로 우회 회귀 방지 권장. [H-5] 삭제 후 reset 호출부 검증(follow-up). 🟢: 토큰 미누수(user*id uuid만 setUser/identify)·health 데이터 미반환+service_role 미사용+IP 미로깅·master 공개 SELECT RLS 정합·빌드 시크릿 VITE* 오용 없음·bridge 컨텍스트 비식별·관측 장애 무영향.
- **web-a11y-reviewer**: 🔴 0 / 🟡 4 / 🟢 다수 — 이번 UI 변경(PrivacyPage 표·위탁 목록)의 시맨틱은 **양호**(caption sr-only·th scope="col"·h1→h2 위계 유지). 🟡는 대부분 **기존 이슈**(11단계 신규 결함 아님): 라우트 진입 포커스 이동 부재, 뒤로가기 40px(AA 통과·AAA 미달, 타 화면 44px와 불일치), `text-muted` 14px 대비(표 헤더가 `bg-tertiary/40` 위 — axe-core 측정 1순위). **관측 계측(captureEvent)이 기존 포커스/키보드/Esc 로직에 회귀를 준 곳 0건** 확인.
- **perf-budget-reviewer**: 🔴 0 / 🟡 3 / 🟢 1 — 새 SDK 2종이 `main.tsx` 렌더 차단 경로에 정적 포함(gzip 약 80~95 kB, 현 초기 청크 292.85 kB의 ~30%). 🟡: (1) init을 render 뒤 + idle로 이동(단 Sentry는 부팅 브릿지 에러 캡처 위해 동기 유지, **PostHog만 지연이 안전**), (2) 라우트 `React.lazy` 스플리팅(985 kB 단일 청크의 본질적 레버, App.tsx 14페이지 정적 import), (3) `manualChunks` vendor 분리(캐시 효율 + 500 kB 경고 해소). 🟢: posthog 무거운 모듈(rrweb 리플레이·surveys)은 런타임 CDN 로드 구조 + `disable_session_recording`/`autocapture:false`로 번들·네트워크 양쪽 차단 — **tree-shaking 추가 작업 불필요**. (전부 11단계 스펙 범위 밖 최적화 — follow-up 권장, 차단 아님.)

> ux-state-reviewer는 트리거(useMutation/useQuery 변경)는 발화했으나 **건너뜀**: 이번 비동기 훅 변경은 기존 onMutate/catch 경로에 fire-and-forget `captureEvent`만 추가했고 loading/empty/error/success 분기를 신설하지 않음. 기존 "웹 8개 페이지 Error 분기 누락"은 STATUS '알려진 문제'에 이미 별도 단계로 트래킹 중.

---

## 종합 판정

**✅ 통과 (11단계 코드 범위 — 🔴 0건, build/lint/test 그린).**

스펙 §8 체크리스트의 코드 작업 항목은 누락 없이 충족. 미체크 항목은 전부 스펙이 "코드 외"로 분리한 콘솔/운영(UptimeRobot·Discord·Vercel env 실측·PostHog IP 콘솔·대시보드 육안 검증). 사용자 지목 3개 미발행 이벤트·allowlist 확장·방침 표현 모두 spec-reviewer가 의도/정합 확인.

### 출시 전 검토 권장 — 2026-06-06 후속 수정 반영

> 검증에서 나온 🟡 권장 중 **관측 코드 범위(1~7)를 코드로 처리 완료**. build/lint/test 그린(web 테스트 15 신규 + shared 16). perf/a11y는 별도 레인 유지. 각 항목은 "문제(원래 지적) → 수정"으로 보존.

- ✅ **[security H-1] scrub 보강** — 문제: `scrubEvent`가 `event.message`·exception `value`·stack frame `filename`·breadcrumb message를 스크럽 안 해 에러 메시지에 박힌 주소/이메일/토큰·URL 쿼리가 그대로 Sentry로 감(실무 최대 누수 경로, §5 "관통 스크럽" 미충족). 수정: `redactText`(URL query strip + 이메일 마스킹) 신설해 message/exception value/breadcrumb message에 적용 + stack frame `filename`에 `stripUrl`. `scrub.test.ts` 11케이스로 회귀 고정. (`scrub.ts`)
- ✅ **[security H-2] 중첩 PII** — 문제: `stripDenyKeys`가 1-depth만 순회해 `extra:{response:{data:{to_address}}}` 같은 중첩 denylist 키 통과. 수정: 재귀(depth 5 상한, 배열 포함)로 전환.
- ✅ **[Codex P2] env fallback** — 문제: `VITE_APP_ENV` 미설정 시 prod 빌드는 `import.meta.env.PROD`로 `production` 분류 → preview/internal 미설정 배포가 prod 관측 오염. 수정: fallback을 `development`로(prod는 항상 명시 주입). prod 빌드 미설정 시 1회 `console.warn`. (`env.ts`)
- ✅ **[spec 🟡-b] source 값 통일** — 문제: `photo_gate_shown`(`photo_room`) vs `login_clicked`(`photo_gate`) source 불일치로 전환율 join 깨짐. 수정: analytics source를 화면 기준(`photo_room`/`photos_list`)으로 통일(네이티브 payload source는 브릿지 계약이라 유지).
- ✅ **[security H-4] ESLint 가드** — 문제: `posthog-js` 직접 import로 `captureEvent` allowlist 우회 가능(회귀 위험). 수정: `observability/` 밖 `posthog-js` import를 `no-restricted-imports`로 차단.
- ✅ **[spec 🟡-c] 단위 테스트** — 문제: 관측 순수 로직 테스트 부재(PII 회귀 위험), apps/web에 테스트 러너 없음. 수정: apps/web vitest 셋업(config+script+dep, `*.test.ts`는 빌드 tsc 제외) + `scrub`(11)·`filterProps`(4) 테스트. `pnpm test`에 통합.
- ✅ **[문서 정합] PostHog 단일 프로젝트 결정** — 문제: 코드·verify는 단일 프로젝트+`environment` 태그인데 스펙/ADR 일부가 "dev/prod 2개 프로젝트"로 잔존. 수정: ADR-088 이유/구현 정정 + 스펙 §4-1 "구현 정정" 노트(비파괴).
- ⏳ **[security H-3] PostHog IP 코드 강제** — 콘솔 "Discard client IP" ON으로 **이미 차단(완료)**. 코드 강제는 IP가 서버측 부여라 client에서 깔끔히 끄는 옵션이 없어(콘솔이 정공법) **선택 하드닝으로 보류**.
- ⏭️ **[perf 🟡 / a11y 🟡] 별도 레인** — PostHog 지연 로드·manualChunks·라우트 스플리팅(스펙 §10 품질 12+) / 뒤로가기 44px·진입 포커스·대비(기존 이슈). 이번 범위 제외.

### 콘솔/운영 잔여 (코드 외, 스펙 분리 항목)

**✅ 완료(2026-06-06)**: Sentry 프로젝트 생성 · PostHog 프로젝트(Free 1개+`environment` 태그) · Vercel 환경변수 주입(소스맵 토큰 3종 포함) · health 배포+검증(GET 200/POST 405/HEAD 200) · UptimeRobot 모니터 2 + 이메일/Discord · PostHog "Discard client IP" ON · CSP 미차단 확인.

**⏳ 잔여(코드 머지→prod 배포 후 실측)**: `VITE_APP_ENV`/`environment` 태그 실측 · Sentry 알림 `environment=production` 필터(배포 후 'production' 환경 생긴 뒤) · 대시보드 실 페이로드 PII 육안 검증(§5-4) · Sentry retention 콘솔 확정 · **코드 머지→prod 배포(웹 관측 활성화)**.
