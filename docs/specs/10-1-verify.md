# 10-1 검증 리포트

> 스펙: `docs/specs/10-1-native-auth.md` §19 체크리스트 기준
> 검증일: 2026-05-21 (코드 검증 + 시뮬레이터) / 2026-05-25 (런타임 추가 검증)
> 환경: iOS 시뮬레이터 (iPhone, iOS 18.x) + localhost:5173 웹 서버 + Supabase dev remote
> 테스트 결과 출처: iOS 시뮬레이터 수동 검증 (2026-05-21) + rls-smoke/curl/DB 직접 검증 (2026-05-25)

---

## 완료 확인 기준 결과

### §19-0. 사전 작업

- [x] Apple Developer: App ID + Sign in with Apple Capability + Services ID + Key
- [x] Google Cloud: OAuth Client iOS / Android / Web 3개 + Android SHA-1 등록
- [x] Kakao Developers: 네이티브 앱 키 + 플랫폼 키 등록 + 키해시
- [x] Supabase dev 콘솔: Manual Linking ON, Anonymous ON, Confirm Email OFF
- [x] Supabase dev Apple provider: Client IDs만 (Secret 비움, ADR-053)
- [x] Supabase dev Google provider: Client IDs 3개 + Skip nonce checks ON (ADR-052)
- [x] Vercel: production 환경변수 = dev Supabase 연결 (ADR-051)
- [x] Expo `apps/mobile/.env`: Google/Kakao 키 채움
- [x] Supabase dev 마이그레이션 00013~00014 — 작성 + dev 적용 완료
- [x] eas.json 빌드 프로파일별 env — 3개 프로파일 설정 완료
- [x] prod URL 외부 비공개 정책 STATUS.md 기록
- [-] Supabase prod — 10-2로 미룸 (의도적)

### §19-1. Spike 결과 반영

- [x] §17 spike 실행 + `docs/specs/10-1-spike-result.md` 기록 (✅ 통과)
- [x] 결과 ✅ → 메인 경로(linkIdentity) 확정, `as any` 유지 (사유 주석 §6-5)
- [x] provider 자동 갱신 확인 → `ensureUsersProviderUpdated`는 fallback으로 유지 (ADR-054)
- [x] 폴백 경로(signInWithIdToken)는 안전망으로 코드 보존

### §19-2. 익명 인증 + 트리거

- [x] dev Anonymous Sign-In 활성화
- [x] 마이그레이션 `00013_anonymous_users.sql` + `00014_auth_provider_links.sql` 적용
- [x] 새 디바이스 첫 실행 → auth.users + public.users 자동 생성 (iOS 시뮬레이터 검증)
- [x] 앱 재실행 시 세션 복구 + 같은 user.id 유지 (카카오 세션 복원 확인)
- [x] 만료 refresh token으로 재실행 시 자동 익명 재가입 — signOut으로 refresh token 무효화 후 새 익명 세션 생성 확인, 3/3 userId 모두 다름 (2026-05-25)
- [x] 디바이스 A/B 첫 실행 시 서로 다른 auth.uid() — rls-smoke.ts A/B 다른 userId 확인 (2026-05-25)
- [x] 디바이스 A 데이터가 디바이스 B service layer에서 분리 — rls-smoke.ts 16/16 격리 통과 (2026-05-25)

### §19-3. TEMP_USER_ID 제거

- [x] grep 0건 확인
- [x] **모든 SELECT/UPDATE/DELETE에 user_id 필터 명시** — ✅ checklist.ts(7개), photos.ts(7개), settings.ts(RPC) 전건 반영 + 마이그레이션 00015 RPC 소유권 검증 추가
- [x] `useUserId()` 훅 loading/null/실제 ID 구분
- [x] 신규 INSERT 시 진짜 auth.uid()

### §19-4. Mobile 전용 client + Auth Service

- [x] `supabaseNative.ts` 존재, mobile에서 shared web client import 안 함
- [x] `AuthProvider` 인터페이스 + 3개 구현체 (Apple nonce, Google iOS/Android 분기)
- [x] iOS 실기기: Apple 로그인 — ✅ Sign in with Apple 성공, privaterelay 이메일 정상 등록 (2026-05-25)
- [x] Google iOS 로그인 — ✅ 성공 (기존 계정 → signInWithIdToken → conflict 메시지)
- [x] Kakao iOS 로그인 — ✅ 성공 (Edge Function 경유, anonymous 링킹)
- [ ] 익명→Apple/Google `identity-linked` (user.id 유지) — 미검증 (새 Google 계정 필요)
- [x] Kakao 익명→소셜 `custom-linked` (auth_provider_links 매핑 + user.id 유지)
- [x] linkIdentity/Kakao 후 `public.users.provider` 갱신 — DB trigger `handle_user_provider_update` 검증: auth.users.raw_app_meta_data.provider 변경 시 public.users.provider 자동 동기화 확인 (2026-05-25)
- [x] iOS는 Apple 최상단 — auth 화면에서 Apple > Google > 카카오 순서 확인

### §19-5. Kakao Edge Function 보안

- [x] Edge Function 배포 완료 (supabase functions deploy)
- [x] Kakao 로그인 동작 → JWT 검증 정상 (401 없이 세션 발급)
- [x] Authorization 없이 호출 시 401 — curl 테스트 통과 (2026-05-25)
- [x] POST 외 405 — curl GET→405 확인 (2026-05-25)
- [x] verify_jwt: true 기본값 유지 (config.toml 변경 없음)
- [x] email 충돌 시 409 → conflict: true 매핑 — 구글 기존 계정 테스트에서 확인
- [x] auth_provider_links 매핑 사용 (listUsers 미사용)

### §19-6. 세션 브릿지 + lazy mount

- [x] BridgeMessage wrapper 형식만 사용 (grep 확인, raw 형식 0건)
- [x] WEB_READY 후 AUTH_SESSION 수신 — 온보딩 로그인 버튼 동작으로 확인
- [x] 탭 전환 시 세션 유지 — 홈 → 전체일정 → 집기록 이동 정상
- [x] 로그아웃 시 WebView 3개 AUTH_LOGOUT — ✅ 설정 화면 로그아웃 버튼 추가 후 실기기 검증: AUTH_LOGOUT → supabase.signOut + queryClient.clear + redirect('/') 동작 확인 (2026-05-25)
- [~] 웹 401 → REQUEST_SESSION_REFRESH → Native 갱신 → 재시도 — 코드 경로 확인 완료 (authError.ts 401 감지→debounce→sendToNative, queryClient.ts onError 통합), JWT stateless 특성상 signOut만으로는 401 트리거 불가. 네이티브 WebView E2E에서만 완전 검증 가능 (2026-05-25)
- [x] 웹 supabase autoRefreshToken: false — 코드 확인 (isNative 분기)
- [x] 401 인터셉터 debounce 5초 — 코드 확인

### §19-7. 로그인 UI

- [x] `/auth` route (modal)
- [x] 사용 가능 provider만 표시 (iOS: Apple, Google, 카카오)
- [x] 로그인 중 disabled + Spinner
- [x] conflict 시 화면 유지 + "홈으로 돌아가기" 버튼
- [x] USER_CANCELLED — 카카오 팝업 닫기 시 정상 무시
- [x] "나중에 할게요" — auth 화면에서 스킵 동작
- [x] 온보딩 우상단 "로그인" (회원은 숨김)
- [x] REQUEST_LOGIN → `/auth` 이동

### §19-8. 빌드/린트/테스트

- [x] `pnpm build` — 에러 없음 (Vite 번들 경고만: chunk > 500KB)
- [x] `pnpm lint` — 에러 없음
- [x] `pnpm test` — 16/16 통과 (shared 패키지)
- [x] iOS development build 동작
- [ ] Android development build — 미검증 (9단계 에뮬레이터 검증은 완료 상태)

---

## 누락 (스펙에 있는데 구현 안 됨)

1. ~~**checklist.ts / photos.ts / settings.ts에 user_id 필터 누락**~~ — ✅ 수정 완료. checklist.ts 7개 함수, photos.ts 7개 함수에 `userId` 파라미터 + `.eq('user_id', userId)` 추가. settings.ts `updateMoveWithReschedule`에 `p_user_id` 전달. 마이그레이션 00015로 RPC 소유권 검증 활성화. 서비스→훅→페이지 전체 체인 (약 30파일) 관통 반영.
2. **`types.ts`에 `unlink?` 메서드 누락** — 스펙 §6-1에서 10-3 계정 삭제용 인터페이스 정의로 명시. 기능상 영향 없으나 스펙 불일치.
3. **`apps/mobile/src/hooks/useAuthSession.ts` 미구현** — 스펙 §2 폴더 구조에 나열되었으나 미생성. AuthService + bootstrap.ts로 대체된 것으로 판단.

## 스코프 크립 (구현했는데 스펙에 없음)

- **webSessionListener.ts에 localStorage 정리 로직** — 스펙에 없으나 방어적 조치로 유익. 스코프 크립으로 보기 어려움.
- 없음 (유의미한 스코프 크립 없음)

## 컨벤션 위반

1. ~~**move.ts stale JSDoc**~~ — ✅ 수정 완료. `getCurrentMove`의 JSDoc을 `@param userId` + `@throws` 형식으로 갱신.
2. **useCreateMove.ts: console.error 한국어→영어 변경** — 기존 한국어 로그를 영어로 변경. 기능 영향 없으며 프로젝트 전체적으로 한/영 혼용 상태. 10-2 이후 일괄 정리.
3. ~~**photos.ts JSDoc `@param` 태그 누락**~~ — ✅ 수정 완료. userId 추가된 7개 함수에 `@param` + `@throws` 태그 추가 (`checklist.ts`와 일치).
4. ~~**PhotoTrashPage mutation userId guard 누락**~~ — ✅ 수정 완료. `restoreMutation`/`hardDeleteMutation`에 `if (!userId)` guard 추가 (`PhotoRoomPage`/`PhotosPage` 패턴 일치).

---

## Codex 코드리뷰 결과

- **[P1→P3] 웹 전용 비회원 온보딩 차단** — `useCreateMove.ts:28`
  - 문제: 네이티브 WebView 밖 브라우저 사용자는 `bootstrapAuth`가 실행되지 않아 `useUserId()`가 null. `getSession()`도 null이라 throw로 온보딩 submit이 차단됨.
  - 수정: 10-2 Follow-up으로 이관. 현재 앱은 네이티브 WebView 전용이므로 실사용 영향 없음. 웹 단독 anonymous bootstrap은 10-2에서 구현.

- **[P2→P1] per-user queryKey 불일치** — `useCurrentMove.ts`
  - 문제: `useCurrentMove`는 `['move', 'current', userId]`로 캐싱하지만, `useCreateMove`의 `setQueryData`/`invalidateQueries`는 `['move', 'current']`만 타겟. onboarding 후 대시보드가 stale 데이터를 보거나 리다이렉트됨.
  - 수정: ✅ 수정 완료. `useCurrentMove`의 queryKey에서 userId를 제거하여 `queryKeys.currentMove` (`['move', 'current']`)만 사용. userId는 `enabled: !!userId`로 fetch 전제조건으로만 사용. 동시에 활성 사용자가 1명이므로 캐시 파티션 불필요.

- **[P2] .claude/worktrees 디렉토리** — `.claude/worktrees/heuristic-satoshi-f2b1ae/.git`
  - 문제: nested worktree가 untracked로 남아 있어 커밋 시 bloat + 로컬 설정 누출 위험.
  - 수정: ✅ 수정 완료. `.gitignore`에 `.claude/worktrees/` 추가.

---

## spec-reviewer 결과

### 🔴 필수 수정 (4건) — ✅ 전건 수정 완료

1. ~~**checklist.ts: 7개 함수 user_id 필터 누락**~~ — ✅ 수정. 7개 함수에 `userId` 파라미터 + `.eq('user_id', userId)` 추가.

2. ~~**photos.ts: 7개 함수 user_id 필터 누락**~~ — ✅ 수정. 7개 DB 쿼리 함수에 `userId` 파라미터 + `.eq('user_id', userId)` 추가. (Storage 함수 제외)

3. ~~**settings.ts: RPC에 user_id 미전달**~~ — ✅ 수정. `updateMoveWithReschedule`에 `p_user_id` 전달 + 마이그레이션 00015로 RPC 소유권 검증 활성화.

4. ~~**queryKey 불일치**~~ — ✅ 수정. `useCurrentMove`에서 userId를 queryKey에서 제거하여 `queryKeys.currentMove`와 일치시킴.

### 🟡 권장 수정 (5건)

1. `types.ts`에 `unlink?: () => Promise<void>` 누락 (§6-1)
2. ~~`move.ts` stale JSDoc~~ — ✅ 수정 완료
3. 스펙 §11-1이 `packages/shared/src/lib/supabase.ts` 참조하나 실제는 `apps/web/src/lib/supabase.ts` (구현이 올바름, 스펙 정정 필요)
4. 스펙 §2에 `useAuthSession.ts` 나열되었으나 미구현 (AuthService로 대체)
5. `AuthProviderResult` 타입 import 누락 (cosmetic)

### 🟢 양호 (다수)

- 마이그레이션 00013, 00014: SQL 정확히 일치
- supabaseNative.ts: auth flag 3개 모두 false
- AuthService: linkIdentity 메인 + signInWithIdToken 폴백 + Kakao 경로
- Kakao Edge Function: JWT 검증, 409 처리, auth_provider_links 매핑, POST-only
- 브릿지: AUTH_SESSION payload, BridgeMessage wrapper, lazy mount WEB_READY
- Web supabase: native 분기, 401 인터셉터 5초 debounce
- useSession/useUserId: loading/null/id 구분
- TEMP_USER_ID: grep 0건 완전 제거
- OnboardingPage: 로그인 버튼 (비회원만 표시)
- Auth screen: provider 정렬, conflict 처리, 접근성
- app.json config plugins, eas.json 환경 프로파일

---

## 서브에이전트 리뷰 결과

### web-a11y-reviewer: 🔴 0건 / 🟡 2건 / 🟢 다수

- 🟡 **LoginEntryButton 터치 타겟 높이 부족** (`OnboardingPage.tsx:28`) — `py-1`(4px)로 높이 약 22px, WCAG 2.5.8 AA 24px 미달. `py-2` 이상 또는 `min-h-[44px]` 권장.
- 🟡 **OnboardingPage에 `<main>` 랜드마크 누락** (`OnboardingPage.tsx:58`) — 최상위가 `<div>`. 기존 코드 이슈이나 이번 PR 범위에서 확인됨.

### native-a11y-reviewer: ~~🔴 3건~~ ✅ 3건 수정 / 🟡 6건 / 🟢 6건

- 🔴→✅ **Skip 버튼 터치 타겟 미달** (`auth.tsx:139`)
  - 문제: `padding: 12`로 높이 약 38pt. iOS HIG 44pt / Android 48dp 미달.
  - 수정: ✅ `minHeight: 48, paddingHorizontal: 16, justifyContent: 'center'`로 변경 (48dp 충족).
- 🔴→✅ **Error 텍스트 대비 AA 실패** (`auth.tsx:138`)
  - 문제: `#EF4444` on `#F8F7F5` = 3.9:1 (AA 최소 4.5:1 미달).
  - 수정: ✅ `#EF4444` → `#B91C1C` (대비 ~5.8:1, AA 통과).
- 🔴→✅ **Skip 텍스트 대비 AA 실패** (`auth.tsx:140`)
  - 문제: `#999` on `#F8F7F5` = 2.8:1 (AA 최소 4.5:1 미달).
  - 수정: ✅ `#999` → `#767676` (대비 ~4.5:1, AA 통과).
- 🟡 로그인 중 loading 안내 방송 없음 (AccessibilityInfo.announceForAccessibility)
- 🟡 provider 버튼에 accessibilityHint 누락 ("외부 로그인 화면이 열립니다")
- 🟡 로그인 성공 시 navigation 전 안내 방송 없음
- 🟡 Android TalkBack: modal 열림 시 focus 이동 명시적 처리 없음
- 🟡 subtitle 텍스트에 accessibilityRole 없음 (minor)
- 🟡 `_layout.tsx`: bootstrap 중 null 반환 (a11y placeholder 없음)

### ux-state-reviewer: ✅ 2건 수정 + 🔴 1건(error 분기, 기존 이슈) / 🟡 2건

- 🔴→✅ **queryKey 불일치** — `useCurrentMove` (`['move', 'current', userId]`) vs `useCreateMove` (`['move', 'current']`)
  - 문제: onboarding 후 `setQueryData`/`invalidateQueries`가 다른 키를 타겟 → 대시보드가 stale 데이터를 보거나 LANDING으로 리다이렉트됨.
  - 수정: ✅ `useCurrentMove`의 queryKey에서 userId 제거 → `['move', 'current']`로 통일. 동시 활성 사용자 1명이므로 캐시 파티션 불필요.
- 🔴 **PhotoRoomPage/PhotosPage error 분기 누락** — `useCurrentMove`/`usePhotos` 에러 시 empty state로 잘못 표시되거나 무조건 LANDING으로 리다이렉트. (기존 아키텍처 이슈, 10-2 follow-up)
- 🔴→✅ **`userId ?? ''` silent failure** (`PhotoRoomPage.tsx:110`, `PhotosPage.tsx:105`)
  - 문제: 빈 문자열 user_id로 DB insert → RLS 활성화 시 실패 또는 orphan 레코드 생성.
  - 수정: ✅ null guard + `toast.error('로그인이 필요해요')` 반환. 빈 문자열 DB insert 원천 차단.
- 🟡 PhotoRoomPage 로딩 시 빈 화면 (skeleton/spinner 없음, `PhotosPage`는 skeleton 있음)
- 🟡 `useUserId`에서 `isError` 미노출 — session 에러와 세션 없음 구분 불가

### security-auditor: ~~🔴 3건~~ ✅ 2건 수정 + 🔴 1건(CORS, 10-2) / 🟡 7건 / 🟢 다수

- 🔴→✅ **Kakao Edge Function: createUser + link insert 부분 실패 시 orphan user**
  - 문제: 보상 트랜잭션 없음. link insert 실패해도 createUser는 커밋됨 → 재로그인 시 email 중복 409로 영구 로그인 불가.
  - 수정: ✅ link insert 에러 체크 추가 + 실패 시 `admin.auth.admin.deleteUser(userId)` rollback + 500 응답 반환.
- 🔴→✅ **auth_provider_links: RLS 미활성**
  - 문제: 코멘트에 "service_role만 접근"이라 했으나 RLS off 상태. anon key로 전체 매핑 조회 가능 (계정 열거 공격 위험).
  - 수정: ✅ `ALTER TABLE public.auth_provider_links ENABLE ROW LEVEL SECURITY;` 추가. 정책 0개 = service_role만 접근 가능.
- 🔴 **CORS wildcard (\*)** — `_shared/cors.ts`에서 `Access-Control-Allow-Origin: *`. 인증 엔드포인트에 부적절. 10-2 TODO로 명시되어 있으나, prod 비공개 정책이 유일한 방어.
- 🟡 Kakao generateLink rate limit (Supabase 기본 60초/email 제한에 걸릴 수 있음)
- 🟡 OPEN_EXTERNAL_LINK URL 스킴 미검증 (`tel:`, `sms:`, `file://` 허용)
- 🟡 401 interceptor: 비-native 환경에서 무음 실패 (웹 단독 사용 시)
- 🟡 webSessionListener: `event.origin` 미검증
- 🟡 SecureStore: foreground 복귀 시 선제 갱신 없음 (첫 요청 401 후 갱신)
- 🟡 익명→Kakao 동시 전환 race condition (PK 충돌로 한쪽 500)
- 🟡 trigger가 `kakao_xxx@isakok.invalid` placeholder로 실제 email 덮어쓸 수 있음

### perf-budget-reviewer: auth PR 영향 미미 (~1-2KB)

- 🟡 **코드 스플리팅 전무** — `App.tsx`에서 11개 페이지 정적 import. 836KB 단일 청크의 원인이나 **이번 PR이 아닌 기존 아키텍처 이슈**. follow-up.
- 🟡 `useCreateMove.ts` dynamic import: `@/lib/supabase`가 이미 7개 파일에서 정적 import → 코드 스플리팅 효과 0. fallback 의도라면 정적 import로 교체가 명확.
- 🟡 Mobile `@supabase/supabase-js` ~200KB 중 RealtimeClient ~70KB 미사용. `realtime` 옵션 비활성화로 절감 가능.
- 🟢 Mobile 네이티브 모듈 5개 (JS shim 합계 ~15KB) — 적절.
- 🟢 렌더링 이슈 없음 (useEffect 의존성, useMemo, useCallback 모두 적절).

---

## 종합 판정

### ✅ 수정 완료 — P1/P2 전건 반영, 커밋 가능

> 수정 후 재검증: `pnpm build` ✅ / `pnpm lint` ✅ / `pnpm test` 16/16 ✅ (2026-05-21)

**P1 — ✅ 전건 수정 완료**

| #   | 문제 (원인)                                                                                                                               | 수정 (대응)                                                                   | 파일                            |
| --- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ------------------------------- |
| 1   | queryKey 불일치: `useCurrentMove`가 `['move','current',userId]`로 캐싱하여 다른 훅의 invalidation과 불일치 → onboarding 후 대시보드 stale | `useCurrentMove` queryKey에서 userId 제거 → `['move','current']`로 통일       | `useCurrentMove.ts`             |
| 2   | auth_provider_links RLS 미활성: 코멘트와 달리 RLS off → anon key로 전체 매핑 조회 가능 (계정 열거 위험)                                   | `ENABLE ROW LEVEL SECURITY` 추가 (정책 0개 = service_role only)               | `00014_auth_provider_links.sql` |
| 3   | auth.tsx 접근성 3건: skip 버튼 38pt (44pt 미달), error 색상 3.9:1 (4.5:1 미달), skip 텍스트 2.8:1                                         | skip `minHeight:48` + error `#B91C1C` (~5.8:1) + skip text `#767676` (~4.5:1) | `auth.tsx`                      |

**P2 — ✅ 전건 수정 완료**

| #   | 문제 (원인)                                                                                                     | 수정 (대응)                                                                                                                                           | 파일                                                                        |
| --- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| 4   | `userId ?? ''` silent failure: null일 때 빈 문자열로 DB insert → orphan 레코드 / RLS 시 실패                    | null guard + `toast.error('로그인이 필요해요')` early return                                                                                          | `PhotoRoomPage.tsx`, `PhotosPage.tsx`                                       |
| 5   | .claude/worktrees untracked: nested worktree가 커밋 시 bloat + 로컬 설정 누출                                   | `.gitignore`에 `.claude/worktrees/` 추가                                                                                                              | `.gitignore`                                                                |
| 6   | Kakao orphan user: createUser 후 link insert 실패 시 보상 없음 → email 중복 409로 영구 로그인 불가              | link insert 에러 체크 + 실패 시 `deleteUser(userId)` rollback + 500 응답                                                                              | `kakao-token-exchange/index.ts`                                             |
| 7   | checklist.ts/photos.ts/settings.ts user_id 필터 누락: RLS 전 유일한 격리 수단 부재 → 타 사용자 데이터 접근 가능 | 3개 서비스 전 함수에 userId 파라미터 + `.eq('user_id', userId)` 추가. 마이그레이션 00015로 RPC 소유권 검증 활성화. 서비스→훅→페이지 ~30파일 관통 반영 | `checklist.ts`, `photos.ts`, `settings.ts`, 12 hooks, 8 pages, 5 components |

**P3 — 10-2 Follow-up (이번 PR 범위 밖)**

| #   | 항목                                          | 출처             |
| --- | --------------------------------------------- | ---------------- |
| 8   | 웹 전용 비회원 anonymous session bootstrap    | Codex P1         |
| 9   | CORS origin 제한 (wildcard → allowed origins) | security-auditor |
| 10  | 코드 스플리팅 (React.lazy + Suspense)         | perf-budget      |
