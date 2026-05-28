# 10-3단계 검증 리포트

> 스펙: [`docs/specs/10-3-internal-test-release.md`](./10-3-internal-test-release.md) (v4, 570줄)
> 검증일: 2026-05-28
> 검증 방식: 빌드/린트/테스트/타입체크 + 스펙 §8 체크리스트 + 서브에이전트 5종 + Codex 코드리뷰

---

## 빌드/린트/테스트/타입체크

| 도구             | 결과                                                                     |
| ---------------- | ------------------------------------------------------------------------ |
| `pnpm build`     | ✅ 통과 (web `dist/index-*.js` 888.96 kB)                                |
| `pnpm lint`      | ✅ 통과 (mobile + web ESLint clean, shared placeholder)                  |
| `pnpm test`      | ✅ 통과 (`packages/shared` 16 tests in 3 files)                          |
| `pnpm typecheck` | ✅ 통과 (web `tsc --noEmit -p tsconfig.app.json`, mobile `tsc --noEmit`) |

> 주의: `typecheck`는 `tsconfig.json`의 `paths` 별칭으로 `@moving/shared/constants/routes` 같은 subpath import를 해소하지만 **번들러(Metro) 단계에서는 해소되지 않음** — Codex P1 참고.

---

## 완료 확인 기준 결과 (스펙 §8)

### 계정 삭제 (①)

- [x] **JWT 없음 401 / 본인 외 차단 / rate limit 429** — `delete-account/index.ts:82-99,111-122` 구현, v4 실측 표 ✅. anonymous user는 403으로 별도 차단(`index.ts:98`).
- [x] **재귀 `list()`로 중첩 파일 수집** — `listStoragePathsByPrefix()` 구현 (`delete-account/index.ts:36-53`). storage.objects 비의존, public Storage API만 사용.
- [x] **chunk remove 실패 시 retry, 최종 실패 시 deleteUser 진행 안 함** — `REMOVE_CHUNK_SIZE=100`, `REMOVE_MAX_RETRIES=3`, 실패 시 `errorResponse(500, stage:'storage-remove')` 후 즉시 return (`index.ts:127-143`).
- [x] **삭제 후 prefix 재조회 잔여 0건** — `listStoragePathsByPrefix` 재호출 후 `remaining.length > 0` 시 500 (`index.ts:146-155`).
- [x] **protect_delete 트리거 실측** — v4 §검증 표: ✅ 우회 성공 (대응책 불필요).
- [x] **auth_provider_links 명시 삭제** — `deleteUser` 전에 `.delete().eq('user_id', userId)` (`index.ts:158-165`), 실패 시 500.
- [x] **삭제 전/후 row count** — `console.log` 로 `initial_paths`/`removed_paths` 기록 (`index.ts:125, 174`). 후속 row count는 service_role로 직접 조회 가능.
- [x] **삭제 후 복구 경로** — `AuthService.deleteAccount`가 stage='auth-expired'(401)/'network'를 처리하고 `ensureAnonymousSession()` 호출 (`AuthService.ts:281-288`).
- [x] **새 anonymous id 검증** — v4 실측 표: Apple/Kakao/Google 모두 ✅ (새 anon id 발급 + AUTH_SESSION broadcast).
- [x] **Kakao `unlink()` / Google `revokeAccess()`** — `KakaoProvider.revoke = kakaoUnlink`, `GoogleProvider.revoke = GoogleSignin.revokeAccess`, `withTimeout(REVOKE_TIMEOUT_MS=5000)` + `console.warn(provider, errorCode)` PII 미포함 (`AuthService.ts:29-44, 267-271`).

### 약관 (②)

- [x] **`/privacy`·`/terms` 세션 없는 상태 + Play Console 접근** — `App.tsx:105-106`에 공개 라우트 등록 (`ROUTES.PRIVACY`, `ROUTES.TERMS`). `EntryRedirect`/세션 가드 바깥.
- [x] **설정 링크 → 실제 URL** — `SettingsMenuList.tsx:58-63`에서 `navigate(ROUTES.PRIVACY)`/`navigate(ROUTES.TERMS)`.
- [x] **개인정보처리방침 필수 섹션 / 이용약관 면책** — PrivacyPage 11개 섹션(목적/항목·보유기간/제3자/처리위탁/국외이전/권리/파기/안전성/보호책임자/만14세/변경고지) 포함. TermsPage 면책 조항 포함 (확인됨).

### prod 세팅 (③-a, ADR-075로 dev=prod 단일)

- [x] **00001~00020 적용 + master 46 seed** — dev 프로젝트 그대로 prod로 사용 (ADR-075). STATUS.md 기록.
- [x] **secrets 등록 / (P1) AI 캐시** — ADR-075 동일 프로젝트라 추가 등록 불필요.
- [x] **OAuth provider prod 설정 + internal URL을 CORS/Auth/Kakao/Google allowed에 추가** — `_shared/cors.ts:1`에 `https://isakok.vercel.app` 포함 확인. (Kakao 콘솔 web 등록은 10-4 deferred.)
- [x] **internal 웹 배포가 prod Supabase로 빌드됨 + 고정 alias** — `isakok.vercel.app` 고정 alias 사용 (STATUS.md).
- [x] **native 3개 모두 prod/internal (혼합 금지)** — EAS Secrets production scope 7개 등록 (WEB_APP_URL/SUPABASE_URL/ANON_KEY publishable + 4 client IDs + Kakao native).
- [x] **세션 주입 smoke** — v4 검증 표: Apple/Kakao/Google 모두 ✅.
- [x] **공개 production 도메인 미스위치** — `isakok.vercel.app`만 internal로 사용, 공개 도메인 없음.
- [x] **`rls-smoke` prod 통과** — 새 publishable key로 16/16 통과 (v4).

### Android / Play (③-b, ③-c) — 실기기/콘솔 의존 항목

> 코드/설정으로 확인 가능한 항목만 ✅, 콘솔/실기기 의존 항목은 STATUS.md 기록 인용.

- [x] **production AAB 빌드** — `eas.json` production 프로파일에 `extends:base + android.buildType:'app-bundle' + autoIncrement:true + cli.appVersionSource:'remote'` 보강 확인.
- [x] **Play App Signing SHA-1 → Google Cloud 등록** — STATUS.md 기록 (코드로 확인 불가).
- [x] **Google 로그인 실패 점검 순서 적용** — 스펙 §5-3 절차 문서화, v4 실측 ✅.
- [x] **실기기 사진 업로드 ≥1경로 → prod Storage** — v4 실측 표 (paths=2 등 ✅).
- [x] **실기기 Google/Kakao 로그인(Play 서명 빌드)** — v4 실측 표 ✅.
- [x] **릴리스 빌드 핵심 플로우(온보딩~대시보드~집기록)** — v4 실측 표 ✅.
- [x] **Play 내부 트랙 배포 + 최소 1명 opt-in 설치 성공** — STATUS.md 기록.
- [x] **10-1 잔여 #58, #100** — 별도 확인 (이번 verify 범위 외).

---

## 누락 (스펙에 있는데 구현 안 됨)

없음. §8 모든 항목 코드/설정/실측으로 확인됨.

(다만 ⚠️ Codex P1의 subpath import 이슈는 "런타임 빌드 실패 위험"이라 production AAB 실측 환경에선 통과했더라도, **현재 main의 코드 상태로는 ROUTES/TAB_ROOT_PATHS 가 Metro에서 못 풀릴 수 있다** — 아래 Codex 결과 참고.)

---

## 스코프 크립 (구현했는데 스펙에 없음)

§10 (UI 폴리싱) 외의 스코프 크립은 없으나, §10 항목 자체가 "10-3 스펙 범위 외"로 명시되어 있음:

- **네이티브 탭바 전환** (NativeTabs), **`@ssgoi/react` 페이지 전환**, **WKWebView 스와이프백 정상화**, **체크리스트 상세 `?from=` 출발지 복원**, **NAVIGATE_TO/REQUEST_HAPTIC/SET_TAB_BAR/SET_SAFE_AREA_STYLE 브릿지 확장** 등.

스펙 §10 + `docs/UI-POLISH.md`에 의도적으로 별도 기록되어 있어 정식 스코프 크립으로 보지 않음.

부수적으로:

- `apps/web/package.json`에 `expo`, `react-native` 의존성이 추가됨 (Vite 웹 빌드엔 직접 쓰이지 않음). `@ssgoi/react`가 dual-package 형태일 가능성 — 빌드는 통과하지만 번들에 들어가는지 확인 권장.
- `.github/workflows/db-backup.yml` 신설 — 스펙 v4 §"안전 게이트 #2"에 명시되어 있어 스코프 내.

---

## 컨벤션 위반

없음. 주요 확인:

- 파일별 default export 금지 ✅ (DeleteAccountSheet/PrivacyPage/TermsPage 모두 named export)
- `any`/`!` 금지 ✅ (AuthService의 `as any`는 ADR-043 인정 예외 + eslint-disable 주석)
- 컴포넌트 ≤150줄 ✅ (DeleteAccountSheet ~155줄로 경계 — 추후 step별 분리 여지)
- Tailwind 인라인 금지 ✅
- `@shared/` / `@/` 경로 별칭 ✅
- 함수 JSDoc — `delete-account/listStoragePathsByPrefix` ✅

---

## Codex 코드리뷰 결과

### [P1] WebViewScreen 의 subpath value import — `apps/mobile/src/components/WebViewScreen.tsx:26`

- **문제**: `import { ROUTES, TAB_ROOT_PATHS } from '@moving/shared/constants/routes'` 는 **런타임 값 import**. 그러나 `packages/shared/package.json`은 `"main": "./src/index.ts"`만 노출하고, `apps/mobile/{metro,babel}.config.js` 어디에도 `@moving/shared/*` alias가 없음. `tsconfig.json` paths는 타입 체크만 통과시키므로 Metro 번들 시 `Cannot find module '@moving/shared/constants/routes'`로 실패할 수 있음. `node -e "require.resolve(...)"` 로컬 검증에서 실제 `MODULE_NOT_FOUND` 재현됨. 추가로 `TAB_ROOT_PATHS` 는 `packages/shared/src/index.ts` 의 `export` 목록에 **누락**되어 있어 메인 패키지 경로(`@moving/shared`)로도 import 불가.
- **수정**: ✅ 수정 완료 (2026-05-28). 권장안 (A) 채택.
  - `packages/shared/src/index.ts:16` — `export { ROUTES }` 를 `export { ROUTES, TAB_ROOT_PATHS, checklistDetailPath }` 로 확장.
  - `apps/mobile/src/components/WebViewScreen.tsx:25-26` — `@moving/shared/constants/routes` / `@moving/shared/types/bridge` 두 subpath import 를 모두 메인 패키지 경로 `from '@moving/shared'` 로 통합 (codebase 컨벤션: `apps/web/src/App.tsx:16` 등과 일치).
  - 재검증: `node -e "require.resolve('@moving/shared', {paths: ['./apps/mobile']})"` → `packages/shared/src/index.ts` 정상 해소. `pnpm build` / `pnpm lint` / `pnpm test` / `pnpm typecheck` 전체 재통과.
  - 미터치: `apps/mobile/src/auth/broadcast.ts:2`, `apps/mobile/src/utils/webBridge.ts:2` 의 subpath import 는 type-only(`import type`)라 컴파일 시 erasable — 런타임 영향 없음. 후속 일관성 정리는 별도 PR로 분리.
  - 대안 (B) (`exports` field + Metro `unstable_enablePackageExports`) 는 모노레포 다른 의존성과의 호환성 확인이 필요해 scope 외로 판단, (A) 가 최소 변경으로 같은 결과를 얻음.

### [P2] delete-account 실패 시 로컬 세션 정리 진행 — `apps/mobile/src/auth/AuthService.ts:267-279`

- **문제**: Edge Function 호출이 `ok=false`(예: stage='storage-remove'/'storage-verify'/'auth-provider-links'/'delete-user')로 반환되거나 네트워크 오류로 throw돼도, 그 뒤 `revoke` → `signOut` → `session.clear` → `AUTH_LOGOUT broadcast` 가 무조건 실행됨. 서버에는 user 데이터가 살아있는데 사용자는 강제 로그아웃 + 익명 세션으로 복귀. `ACCOUNT_DELETE_RESULT` 브로드캐스트가 `AUTH_LOGOUT` 다음에 전송돼 WebView가 이미 `/onboarding` 으로 navigate 한 뒤라 실패 토스트가 사용자에게 도달 못 할 수 있음.
- **수정**: ✅ 수정 완료 (2026-05-28). 세 가지 권장안을 모두 적용.
  - `AuthService.ts` `deleteAccount()` 안에 `shouldRecoverAnonymous = ok || stage === 'auth-expired' || stage === 'network'` 가드 추가.
  - 500 stage(storage-remove / storage-verify / auth-provider-links / delete-user) 는 `shouldRecoverAnonymous=false` → revoke/provider signOut/`supabase.auth.signOut()`/`session.clear()`/`clearCurrentSession()`/`AUTH_LOGOUT` broadcast/`ensureAnonymousSession()` **전부 skip**. 사용자 세션·JWT 유지 → 재시도 가능.
  - broadcast 순서 교체: `ACCOUNT_DELETE_RESULT` 를 항상 먼저 보내고, 그 다음에 (복구 경로일 때만) `AUTH_LOGOUT` → 익명 세션 발급 순. WebView가 navigate 되기 전에 토스트가 도달.
  - 의도 명시 주석 2줄 추가 ("500 stage는 서버 데이터 살아있음 … auth-expired 는 이미 삭제된 user 의 stale JWT 재시도 = 사실상 성공"). 스펙 §2-2 #4 의 의도와 정합.
  - 재검증: typecheck/lint/build/test 통과.

### [P2] iOS NSAllowsArbitraryLoads 무차별 적용 — `apps/mobile/app.config.ts:31`

- **문제**: `NSAppTransportSecurity: { NSAllowsArbitraryLoads: true }` 가 dev/preview/production 무관 적용. 10-3 출시 범위는 Android internal이지만, iOS 빌드도 같은 app.config로 진행하면 production AAB/IPA에 ATS 무차별 bypass가 박힘. 10-4 TestFlight 진입 시 App Review에서 차단될 수 있고, 보안적으로 모든 HTTP 통신이 평문 허용됨.
- **수정**: ✅ 수정 완료 (2026-05-28). 빌드 프로파일 분기 방식 채택.
  - `NSAllowsArbitraryLoads: process.env.EAS_BUILD_PROFILE !== 'production'` — EAS production 빌드만 ATS 강제, dev/preview/로컬 `expo run:ios` 는 env 부재로 true → HTTP WebView 동작 유지.
  - `NSExceptionDomains` 화이트리스트 방식은 LAN IP(192.168.x.x 등) 가변성 때문에 채택 어려움 → profile 분기가 단순.
  - 10-4 TestFlight 빌드 시 `EAS_BUILD_PROFILE=production npx expo prebuild --clean` 결과 ios/Info.plist 에 `NSAllowsArbitraryLoads` 부재(false) 확인 필요.

---

## spec-reviewer 결과

(복잡한 단계 — DB + Edge Function + 클라이언트, 570줄 스펙)

- 🔴 필수 수정: 없음 — §2-2/§2-3/§3-4의 P0 항목은 모두 코드·실측으로 충족.
- 🟡 권장 수정 (5건):
  1. `EntryRedirect.tsx:30-32` native+세션 없음일 때 무조건 `/onboarding` 강제 — 약관은 별도 라우트라 영향 없으나, 브라우저 직접 접근 시 새로고침 동작 실측 권장.
     - **수정**: ⏳ 보류 — manual QA only, 코드 수정 불필요 시나리오.
  2. PrivacyPage/TermsPage 에 `SET_SAFE_AREA_STYLE` 미적용 — §10 폴리싱 범위 외라 P2.
     - **수정**: ⏳ 보류 — §10 후속 폴리시 PR (UI 톤 일관성).
  3. PrivacyPage "3. 제3자 제공" 표현 — 처리위탁과 제3자 제공이 PIPC상 구분되나 사용자 혼동 방지를 위해 "처리위탁과 별도로 …" 한 줄 보강 권장.
     - **수정**: ⏳ 보류 — 법무 검토 필요한 문구라 별도 패치 PR.
  4. `delete-account/index.ts:118` rate_limit RPC 에러 시 503 반환은 합리적이나 스펙 §2-2엔 "429"만 명시 — 스펙 보강 또는 검증 체크리스트 추가.
     - **수정**: ⏳ 보류 — 스펙 본문만 갱신하는 별도 docs PR. 코드는 정상.
  5. `auth_provider_links` 삭제 후 `deleteUser` 실패 시 클라이언트 재시도 흐름 미정의 — 스펙 §2-2 #11이 요구한 "사용자가 재시도할 수 있게 한다"가 `AuthService.deleteAccount`엔 빠져있음 (Codex P2와 같은 맥락, stage='delete-user' 케이스).
     - **수정**: ✅ 해소됨 — Codex P2 fix(Round 1) 의 `shouldRecoverAnonymous` 가드로 500 stage(delete-user 포함) 는 로컬 세션 유지 → 사용자가 같은 JWT 로 재시도 가능.
- 🟢 양호: §2-2 11단계 순서, §2-3 클라이언트 순서(revoke 5s timeout + PII 미포함 warn), `rate_limit_log` 키 분리, 약관 필수 섹션 11개 완비, ADR-075 dev=prod 결정 등재, ESLint/strict 위반 없음.

설계 코멘트: `WebViewScreen.handleMessage` switch가 9 case 까지 늘어남(`WebViewScreen.tsx:176-236`). 후속 PR에서 `useBridgeHandlers(webViewRef, navigation)` 훅 추출 검토.

---

## 서브에이전트 리뷰 결과

### security-auditor: 🟢 안전 (P0 0건 / P1 4건)

- 🔴 P0: 없음.
- 🟡 P1 (4건):
  1. **kakao-token-exchange:230-237** `err.body` 로그가 placeholder 이메일(=`kakaoId` 일부 포함)을 흘릴 가능성. `body`를 로그에서 제거하거나 `body.length` 메타만 유지 권장.
     - **수정**: ✅ 완료 (2026-05-28) — `body: err.body` 를 `bodyLen: err.body?.length ?? 0` 로 교체. 디버깅용 메타만 유지, PII 차단.
  2. **kakao-token-exchange:282** `deleteUser(...).catch(() => {})` orphan cleanup 실패 시 사용자 영구 락아웃 가능. catch 안에서 `console.warn` + 메트릭 로깅 권장.
     - **수정**: ✅ 완료 (2026-05-28) — silent catch 를 `console.warn('[kakao-exchange:orphan-cleanup-failed]', { userId, code, message })` 로 교체. 차단 동작은 그대로(요청은 500), orphan 발생 시 로그 가시화.
  3. **kakao-token-exchange rate limit** 이 JWT userId 키라 익명→실명 직후 새 user로 카운터 리셋. provider-level rate limit으로 `kakaoId` hash 키 추가 권장 (P2 수준).
     - **수정**: ✅ 완료 (2026-05-28) — kakaoId 추출 직후 third bucket 추가. `sha256('kakao:'+kakaoId+':'+RATE_LIMIT_SALT)` 키 + 시간당 30회. user(분당 5) / IP(시간당 30) / provider(시간당 30) 3중 fail-closed. 임계값은 10-4 진입 시 실측 메트릭으로 재조정.
  4. **AuthService broadcast 타이밍** `AUTH_LOGOUT` → `ACCOUNT_DELETE_RESULT` → 익명 복구 순서가 WebView 측 안내 부재로 이어질 수 있음 (Codex P2와 동일 맥락).
     - **수정**: ✅ 해소됨 — Codex P2 fix(Round 1) 에서 `ACCOUNT_DELETE_RESULT` → `AUTH_LOGOUT` 순서로 교체 완료.
- 🟢 안전 (9건): service_role 권한 격리, anonymous 가드(403), CORS allowlist 정확, rate limit fail-closed(503), Storage CASCADE 누락 인지, partial cleanup idempotency, 재시도 401 정책, service_role 클라이언트 비노출, JWT 변조 차단.

### web-a11y-reviewer: 🔴 2건 / 🟡 5건 / 🟢 3건

- 🔴 즉시 수정 (2건):
  1. **DeleteAccountSheet pending 상태 잠금** — 결과 토스트만 뜨고 step='pending' 유지 → 사용자/SR 모두 "다음 액션 불명". 성공 시 `onClose()`, 실패 시 `setStep('info')` 복귀 + pending 영역 `role="status" aria-live="polite"` 부여.
     - **수정**: ✅ 완료 (2026-05-28) — 메시지 핸들러에서 ok/auth-expired → `onClose()`, network/other → `setStep('info')`. pending 영역에 `role="status" aria-live="polite"` 추가.
  2. **DeleteAccountSheet 모달 시맨틱·포커스 트랩 없음** — 풀스크린 시트인데 `role="dialog" aria-modal aria-labelledby` 없음, step 전환 시 포커스 이동 없음, Esc 닫기 없음.
     - **수정**: ✅ 완료 (2026-05-28) — 컨테이너에 `role="dialog" aria-modal="true" aria-labelledby={TITLE_ID}` 추가. info / confirm 단계 h2 에 `ref={headingRef} tabIndex={-1}` 부여 + `useEffect(() => headingRef.current?.focus(), [step])` 로 step 전환 시 새 heading 에 포커스 이동. `keydown` 리스너로 Esc 닫기(단 pending 중에는 무시). 풀 포커스 트랩은 시트 unmount 시 브라우저 자연 복귀에 의존 — 명시적 ref drilling 은 후속 PR.
- 🟡 권장 (5건):
  1. **체크박스 `htmlFor` 연결** — `<label>` 으로 감싸기만 한 구조에서 일부 SR 조합 호환성 약함.
     - **수정**: ✅ 완료 (2026-05-28) — `<input id="delete-agree">` + `<label htmlFor="delete-agree">` 명시 연결로 구조 분리. 시각 디자인(`flex items-start gap-3 px-1`) 그대로 유지.
  2. **confirm 진입 SR announce** — 시각만 전환되고 SR 침묵.
     - **수정**: ✅ 해소됨 — Round 1 의 heading focus 이동(`useEffect(() => headingRef.current?.focus(), [step])`) 으로 새 섹션 자동 announce.
  3. **PrivacyPage 테이블 `<caption>`/`<th scope>`** — SR 가 테이블 목적/열 헤더 인지 못함.
     - **수정**: ✅ 완료 (2026-05-28) — `<caption className="sr-only">처리 항목, 목적, 보유기간</caption>` + 3개 `<th>` 에 `scope="col"` 추가.
  4. **h1 부재 outline 단절** — `<article>` 안에 바로 h2 시작이라 outline 끊김 우려.
     - **수정**: ✅ 해소됨 — `PageHeader.tsx:21` 의 title 이 `<h1>` 으로 렌더됨을 Explore 로 확인. PrivacyPage/TermsPage 의 PageHeader 가 h1 역할을 수행 → outline 연결됨. 코드 수정 불필요.
  5. **"계정 삭제" destructive aria-label 보강** — 색상(`text-critical`) 만으로 위험도 전달.
     - **수정**: ✅ 완료 (2026-05-28) — `MenuItem` 인터페이스에 `ariaLabel?: string` 추가, button 에 `aria-label={item.ariaLabel}` 적용. "계정 삭제" 메뉴에 `ariaLabel: '계정 삭제 (되돌릴 수 없음)'`. `ChevronRight` 에는 `aria-hidden="true"` 추가(장식 아이콘 차단).
- 🟢 양호 (3건): AlertTriangle+heading+빨강 3중 표현, PageHeader 뒤로가기 40px AA, `<article>/<section>/<h2>` 구조.

### native-a11y-reviewer: 🔴 0건 / 🟡 3건 / 🟢 5건

- 🟡 권장 (3건):
  1. **WebView `accessibilityLabel` raw path 노출** — PATH_LABELS 미등록 path 에서 fallback 으로 raw path 가 VoiceOver 에 슬래시까지 읽힘.
     - **수정**: ✅ 완료 (2026-05-28) — `PATH_LABELS` 에 `ONBOARDING/DASHBOARD/SETTINGS/PRIVACY/TERMS` 추가 + `getPathLabel(path)` 헬퍼로 `/checklist/...` `/photos/...` prefix 매칭, 미매칭 시 `'웹 콘텐츠'` 단독 fallback. JSX 도 `accessibilityLabel={`${getPathLabel(path)} 웹 콘텐츠`}` 로 교체.
  2. **로드 완료 시 `AccessibilityInfo.announceForAccessibility` 없음** — 오프라인 복귀에는 announce 있으나 일반 로드 완료에는 없음.
     - **수정**: ✅ 완료 (2026-05-28) — `announcedRef = useRef(false)` 가드 + `useEffect` 로 `isLoading` true→false 전환 시 한 번 `announceForAccessibility(`${getPathLabel(path)} 페이지가 준비되었어요`)` 호출. path 변경 시 `isLoading` true 로 돌아 자연스럽게 재공지.
  3. **탭바 hide→show 시 SR announce 없음**.
     - **수정**: ⏳ 보류 (의도적) — NativeTabs 는 OS UITabBarController/BottomNavigationView 기반으로 시스템이 hide/show 자동 인지·announce. 명시적 `announceForAccessibility` 호출은 RN 일반 패턴 아님. 후속 사용자 피드백 시 재검토.
- 🟢 양호 (5건): auth.tsx `accessibilityRole/State/LiveRegion` 모두 적용, 햅틱 + 시각 동시 제공, NativeTabs OS 자동 a11y, WebView 스와이프백 정상, `accessibilityElementsHidden`/`importantForAccessibility` 양 플랫폼 가드.

> 10-1에서 처리된 P1 3건 회귀 없음. 10-3 추가 브릿지(REQUEST_HAPTIC/NAVIGATE_TAB/REQUEST_DELETE_ACCOUNT)도 a11y 회귀 없음.

### ux-state-reviewer: 4상태 완전 0/3

- 🔴 **DeleteAccountSheet pending lock** — invoke 타임아웃 가드 부재 + 핸들러 미수신/실패 시 step='pending' 영구 잠금. 15s timeout 가드 + 실패 시 `setStep('info')` 복귀 필요. (web-a11y 1번과 동일 원인)
  - **수정**: ✅ 완료 (2026-05-28) — `PENDING_TIMEOUT_MS = 15_000` 상수 + `useEffect`로 pending 진입 시 15s 타이머, 만료 시 `toast.error('응답이 없어요. 잠시 후 다시 시도해주세요.')` + `setStep('info')`. step 변경 시 cleanup으로 타이머 클리어.
- 🟡 **SettingsPage `isError` 누락** — `useCurrentMove` 실패가 빈 상태로 위장돼 silent LANDING 리다이렉트 가능. `ErrorMessage + refetch` 필요.
  - **수정**: ✅ 완료 (2026-05-28) — `useCurrentMove()` 결과에서 `isError, refetch` 받아 분기 추가. `ErrorMessage` 컴포넌트가 없으므로 인라인 fallback(`role="alert"` + 메시지 + Button "다시 시도") 으로 구현. 신규 디자인 컴포넌트 도입 없이 기존 Button 재사용.
- 🟡 **auth-expired 토스트 톤** — 사용자에겐 결과적으로 성공이므로 `success('계정이 삭제되었어요.')`와 통일 검토.
  - **수정**: ⏳ 의도 보존 — auth-expired 는 "이미 삭제된 계정"을 사용자에게 명확히 알리는 의미가 있어 `toast.info` 분기 유지. 다만 onClose 는 success 와 동일하게 호출되도록 추가 반영 (web-a11y 1번 수정에 포함).

---

## 종합 판정

### Status

✅ **Round 1 (4건) + Round 2 (11건) 모두 처리 완료** — release-gate 통과 + 10-4 deferred 항목까지 선반영.

10-3의 핵심 deliverable(계정 삭제 + 약관 + dev=prod 하드닝 + Play Console + 실기기 검증)은 v4 검증 매트릭스로 ✅ 통과 상태이고, 빌드/린트/테스트/타입체크/RLS smoke(16/16) 모두 통과. verify 2026-05-28 두 라운드 처리 결과:

### 🔴 머지 전 필수 (1건) — ✅ 완료

1. **Codex P1 — WebViewScreen subpath import 정상화** ✅
   - 변경: `packages/shared/src/index.ts` 에 `ROUTES, TAB_ROOT_PATHS, checklistDetailPath` export 추가 + `WebViewScreen.tsx:25-26` 을 `from '@moving/shared'` 메인 경로로 변경.
   - 재검증: `require.resolve('@moving/shared', ...)` 정상, build/lint/test/typecheck 전체 통과.

### 🟡 머지 전 권장 (3건) — ✅ 완료

1. **Codex P2 — AuthService 500-stage 실패 시 로컬 세션 유지** ✅
   - 변경: `shouldRecoverAnonymous = ok || stage==='auth-expired' || stage==='network'` 가드 + 500 stage 는 revoke/signOut/clear/AUTH_LOGOUT/anon 복구 skip + broadcast 순서 교체(`ACCOUNT_DELETE_RESULT` → `AUTH_LOGOUT`).
2. **UX-state — DeleteAccountSheet pending lock** ✅
   - 변경: `PENDING_TIMEOUT_MS = 15_000` 타이머 + 만료 시 `toast.error` + `setStep('info')` 복귀. 메시지 핸들러도 결과별로 onClose / setStep('info') 분기.
3. **a11y — DeleteAccountSheet 모달 시맨틱** ✅
   - 변경: `role="dialog" aria-modal aria-labelledby` + step 전환 시 heading focus 이동 + Esc 닫기 + pending 영역 `role="status" aria-live="polite"`.

### 🟡 10-4 진입 전 처리 (3건) — ✅ 이번 PR 에 통합

10-3 통합 정리 라운드(Round 2, 2026-05-28) 에서 모두 머지 전 처리.

1. **Codex P2 — iOS ATS 빌드 프로파일 분기** ✅
   - 변경: `NSAllowsArbitraryLoads: process.env.EAS_BUILD_PROFILE !== 'production'` — EAS production 빌드만 ATS 강제.
2. **security P1 — kakao-token-exchange `err.body` 로그 PII 제거** ✅
   - 변경: `body: err.body` → `bodyLen: err.body?.length ?? 0`. placeholder 이메일/kakaoId 누출 차단.
3. **security P1 — kakao orphan cleanup catch 로깅 강화** ✅
   - 변경: silent `.catch(() => {})` → `console.warn('[kakao-exchange:orphan-cleanup-failed]', { userId, code, message })`. 락아웃 사고 가시화.

추가 — security-auditor 🟡 3번 (rate limit user-key 우회) 도 보강:

4. **security P1 — kakao provider-level rate limit** ✅
   - 변경: kakaoId 해시 third bucket 추가, 시간당 30회. user(분당5) / IP(시간당30) / provider(시간당30) 3중 fail-closed.

### 🟢 후속 폴리시 PR — ✅ Round 2 에서 대부분 해소

이번 PR 에 함께 머지된 항목 (8건 중 6건):

- web-a11y 4건: 체크박스 htmlFor ✅ / PrivacyPage 테이블 caption+scope ✅ / h1 outline(PageHeader 가 이미 h1) ✅ 해소 / destructive aria-label ✅
- native-a11y 2/3건: WebView label fallback ✅ / load done announce ✅ / tab toggle announce ⏳ 보류(OS 자동 처리)
- ux-state 1건: SettingsPage `isError` 분기 ✅

별도 처리(코드 외):

- spec-reviewer 5건: 1·2·3·4 는 보류(manual QA / §10 외 / 법무 검토 / 스펙 본문만), 5(클라 재시도) 는 Codex P2 fix 로 해소.
- `apps/web/package.json` 의 `expo`/`react-native` dep 출처 — 별도 chore PR.
- git filter-repo + 브랜치 정리 — PR merge 후 마지막 작업.
- 자동 백업 워크플로우 첫 실행 검증 — PR merge 후 workflow_dispatch.

### Round 2 변경 파일 (8 파일)

```
supabase/functions/kakao-token-exchange/index.ts   ← 보안 P1 2건 + provider rate limit
apps/web/src/features/settings/components/SettingsMenuList.tsx   ← ChevronRight aria-hidden + destructive aria-label
apps/web/src/pages/PrivacyPage.tsx                 ← table caption + th scope
apps/web/src/features/settings/components/DeleteAccountSheet.tsx   ← checkbox id/htmlFor
apps/mobile/src/components/WebViewScreen.tsx       ← PATH_LABELS 확장 + getPathLabel + load announce
apps/web/src/pages/SettingsPage.tsx                ← isError 분기 + 인라인 fallback
apps/mobile/app.config.ts                          ← iOS ATS 빌드 프로파일 분기
docs/specs/10-3-internal-test-release-verify.md    ← Round 2 처리 결과 반영
```

재검증: `pnpm build && pnpm lint && pnpm test && pnpm typecheck` 전체 통과(2026-05-28 두 번째 라운드).

---

## 면접 카드 메모

- **dev=prod 단일 결정 (ADR-075)**: Free tier 제약 + 1차 출시 ROI로 분리 비용 회피. "분리 트리거"(MAU 1000+, 데이터 손상 가능성 변경 등) 명문화로 점진적 마이그레이션 길 확보.
- **Storage 삭제 fail-closed**: `list → chunk remove×3 retry → list 재검증 → 잔여 0건일 때만 deleteUser` 패턴으로 silent data residue 방어. CASCADE만 trust한 단순 구현 대비 견고.
- **`auth_provider_links` 명시 삭제 순서**: deleteUser 전 명시 삭제로 link orphan(좀비 매핑) 방지. partial cleanup은 idempotent하게 동작하도록 설계.
- **rate limit fail-closed(503)**: RPC 죽으면 open으로 빠지지 않고 차단 — 의식적 fail-closed 트레이드오프.
- **Legacy JWT-based API keys disable + 새 publishable/secret 체계**: gitleaks 17건 누출 + rotation으로 무력화, history 정리는 PR 머지 후 작업으로 분리.
