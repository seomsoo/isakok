# 12단계 푸시 알림 — 검증 리포트 (/verify)

> 검증일: 2026-06-06 (구현과 별도 세션) · 스펙: `docs/specs/12-push-notifications.md` (v2, 681줄)
> 범위: 코드 구현 검증. 배포·콘솔(마이그레이션 push, 함수 배포, Vault/시크릿, EAS, Cron, DRY_RUN 실발송)은 운영 단계로 코드 검증 대상 외 — `[△]`로 표기.
> 체크 표기: `[x]` 코드 검증 완료 / `[△]` 코드 완료·배포/실측 대기 / `[ ]` 미구현
> (스펙 본문 §13은 계약/이력이라 원본 보존. 검증 체크는 이 파일에만 — 11단계 교훈)

---

## 수정 반영 (2026-06-06 후속 — 🔴 4그룹 전부 완료)

검증 직후 🔴 우선순위 4개 그룹을 수정하고 재검증(build/lint/test/mobile typecheck 전부 ✅ 재통과). 각 "문제" 설명은 아래 원 섹션에 보존(이력·회귀 방지).

1. **[Codex P1 / security W1] 로그아웃 토큰 unbind** ✅ — `supabase/migrations/00028_push_unregister_rpc.sql`에 `delete_my_push_tokens()`(DEFINER + `auth.uid()` + search_path, GRANT authenticated) 추가 · `registerPush.ts`에 `unregisterPush(session)`(토큰 삭제 + `set_push_enabled(false)`) · `AuthService.signOut()`이 **세션 clear 이전**(옛 user JWT 유효 시) 호출 → 발송 대상(`push_enabled=true` AND 토큰)에서 제외. 계정삭제는 기존 user CASCADE로 커버(변경 없음).
2. **[Codex P2] NAVIGATE 단건 전달** ✅ — `broadcast.ts`에 포커스 WebView 추적(`setFocusedWebView`/`clearFocusedWebView`/`sendToFocusedWebView`) · `notificationHandler.flushPendingRoute`가 활성 탭 1개에만 전달(활성 WebView 없으면 보류 유지 → WEB_READY/포커스 시 재flush로 콜드스타트 안전) · `WebViewScreen`의 `isFocused` effect로 등록/해제. 전체 broadcast 제거.
3. **[ux-state] 4상태** ✅ — `usePushSettings`가 `isError`/`refetch` 노출 + `disable` 실패 시 `toast.error` · `PushSettingRow`가 `isLoading` 스켈레톤 + `isError` 재시도 UI(`PushRowShell` 공통 셸로 3상태 공유).
4. **[web-a11y] PushPermissionSheet 모달 + 토글** ✅ — 열림 시 heading 포커스 이동 + Esc(=“나중에”, OS 다이얼로그 안 띄움) + Tab focus trap(`DeleteAccountSheet` 패턴 차용) · 토글 상태 텍스트 `aria-live="polite"` · 토글 hit area `h-11`(44px) + "설정에서 켜기"/"다시 시도" `px-3 py-2`(WCAG 2.5.8 충족).

재검증: `pnpm build` ✓(3.15s) · `lint` ✓ · `test` ✓(shared 21·web 15) · `mobile typecheck` ✓. (`notificationHandler` deprecated 경고 2건은 의도적 SDK 55 사용, typecheck/lint 비차단)

**남은 것**: 🟡 follow-up(soft-ask "온보딩 직후" 정합화 · send N+1 배치화 · Android 채널 description · denied 색대비 런타임 측정 · 푸시 딥링크 도착 후 웹 라우트 포커스/공지) + 배포·콘솔(코드 외 운영).

---

## 배포·실기기 검증 (2026-06-14)

위 검증(2026-06-06)은 코드 검증, 본 절은 **배포 + iOS 실기기** 검증으로 원래 `[△]` 항목을 해소. dev=prod 단일 프로젝트(ADR-075)에 실발송까지 완료. (EAS 빌드 정합 픽스는 ADR-097)

### 배포 (전부 완료 ✅)

- [x] DB 마이그레이션 push `00023`~`00028` (`migration list`로 Remote applied 확인)
- [x] Edge 배포 `register-push-token` · `send-notifications` (config.toml `verify_jwt=false` 반영)
- [x] 함수 시크릿 `PUSH_CRON_TOKEN`(`openssl rand -hex 32`) · `PUSH_DRY_RUN`
- [x] Vault `push_cron_token`(=함수 시크릿 동일값) · `project_url`
- [x] Cron `send-notifications-daily` `0 0 * * *`(09:00 KST) active=true
- [x] EAS iOS preview 빌드 + APNs 키(EAS 자동관리) — 빌드 깨짐 3건 해소(ADR-097: RN 0.83.6 SDK 정렬 / static framework / `eas.json` environment=production)

### iOS 실기기 (전부 통과 ✅)

- [x] 앱 진입(크래시 없음 — `EXPO_PUBLIC_*` env 주입 후), soft-ask 시트 → OS 권한 허용
- [x] 토큰 등록(`register-push-token`→`push_tokens` 1행) — DRY_RUN `targetUsers:1/targetTokens:1` 확인
- [x] **DRY_RUN → EXECUTE 전환** — `PUSH_DRY_RUN=false`, 실발송 `messages:1, claimed:2(마일스톤+디지스트 병합), sent:2, failed:0`
- [x] 백그라운드/잠금 수신
- [x] 콜드스타트(앱 종료) 탭 → 딥링크 대시보드 이동
- [x] 포그라운드 배너
- [x] 병합 카피("이사 D-0" + "오늘 챙길 일 33개 '전입신고 서류준비' 외 32건…") 정상

### 잔여 → 2026-06-14 콘솔·코드 추가 처리 반영

오늘 추가 완료 ✅:

- [x] **Android FCM** — Firebase 프로젝트(`isakok-bc157`) + google-services.json(EAS 파일 시크릿 `GOOGLE_SERVICES_JSON` + gitignore + `android.googleServicesFile`) + FCM V1 service account EAS 업로드. Android 빌드·실기기 설치·**푸시 도착 확인**(push_tokens 2개=iOS+Android). 채널 importance `HIGH` + description 코드 반영(heads-up 팝업).
- [x] **App Privacy / Data Safety** — 11단계에서 기기 식별자 이미 선언됨 + 푸시 토큰이 같은 "기기 ID" 범주라 기존 선언에 포함(점검 완료, `/privacy`와 일치).
- [x] **soft-ask "온보딩 직후" 정합화** — 동작 불변, 컴포넌트+DashboardPage 마운트 주석을 스펙 §6-1과 정합(첫 진입 1회 + `push_prompt_seen_at` 영구가드 근사). → 아래 "누락" 🟡 해소.

남은 잔여:

- [△] **토큰 재할당 실측**(재설치/계정전환 시 user_id 갱신) — 코드(`onConflict:token` + 로그아웃 `unregisterPush`)는 구현·리뷰(Codex P1/W1) 완료. 익명 계정이라 소셜 로그인→로그아웃 시나리오 실측은 deferred(비차단)
- [ ] **on-device 반영 대기** — 토글 CSS 썸 위치 수정(웹)은 커밋+Vercel 재배포 후 / Android 채널 `HIGH` 팝업은 채널 immutable이라 다음 빌드·재설치 후 (둘 다 코드 완료)
- 🟡 follow-up(비차단): send N+1 배치화 · denied 색대비 측정 · 푸시 딥링크 도착 후 웹 라우트 포커스/공지

---

## 검증 환경 결과

- [x] `pnpm build` — ✓ built in 3.02s (web 1 successful). chunk size 경고는 기존 follow-up(manualChunks, 스펙 11 §10 품질레인)
- [x] `pnpm lint` — ✓ 3 successful (web/mobile/shared)
- [x] `pnpm test` — ✓ shared 21/21 (4파일, **pushRoutes 5케이스 포함**) · web 15/15 (scrub 11 + events 4)
- [x] `pnpm --filter @moving/mobile typecheck` — ✓ exit 0
- [x] Edge(Deno) — 배포로 검증 (`register-push-token`·`send-notifications` 배포 성공 + 실행 정상, 2026-06-14 §배포·실기기 검증)

---

## 완료 확인 기준 결과 (스펙 §13)

### DB / RPC

- [x] `push_tokens` service_role only (RLS enable + 정책 0개 = anon/authenticated 완전 차단, token UNIQUE, user_id ON DELETE CASCADE, set_updated_at 트리거) — `00023`
- [x] `notification_log` claim 모델 (status `claimed/sent/failed`, digest 부분유니크 `(user_id, sent_date)`, milestone 부분유니크 `(move_id, milestone_day, milestone_date)`, RLS 정책 0) — `00024`
- [x] `users.push_enabled` default false + `push_prompt_seen_at` — `00025`
- [x] `set_push_enabled` / `set_push_prompt_seen`: DEFINER + `SET search_path=public` + `auth.uid()` 본인검증 + REVOKE PUBLIC + GRANT authenticated — `00026`
- [x] (스펙 보정) `kst_today` / `claim_milestone_notification` / `claim_digest_notification`: service_role GRANT 한정 — `00027`. 스펙은 4개 마이그레이션이나 실제 5개 — **정당한 보정** (부분 유니크 인덱스는 PostgREST `onConflict`로 arbiter를 못 맞춰 claim을 SQL RPC로 내림. 근거 3곳 일관 기록: `00027` 헤더 주석 / STATUS.md:11,51)
- [x] cascade 정리: `push_tokens`/`notification_log` 둘 다 `user_id ... ON DELETE CASCADE` → `_shared/deleteUserData`(cleanup ADR-076 · delete-account ADR-082 · kakao-unlink 공용)의 user 삭제 시 자동 정리 (spec-reviewer 확인)

### Edge Functions

- [x] `register-push-token`: config.toml 블록 없음 = 기본 verify_jwt=true 유지, anon client `getUser()` 검증(직접 decode 아님), `isExpoPushToken` 정규식 + platform 화이트리스트, service_role `onConflict:'token'` upsert, 500은 일반코드(`REGISTER_FAILED`)·detail은 서버 로그만, CORS allowlist
- [x] `send-notifications`: **config.toml `verify_jwt=false`**, `PUSH_CRON_TOKEN` 내부검증(미설정=fail-closed 401), DB `kst_today()`, current move 1개(`status='active'`·`deleted_at IS NULL`·`created_at desc` — 웹 `getCurrentMove` 정본과 동일), claim ON CONFLICT, milestone_date 기록, 병합 skip(둘 다 신규일 때만 1건), 전송 후 sent/failed UPDATE, ticket-level 무효토큰(`DeviceNotRegistered`/`InvalidCredentials`) 삭제, 처리상한(MAX_USERS=500/MAX_TOKENS=1000 + truncated), structured log
- [x] **DRY_RUN 검증 → EXECUTE 전환** — DRY_RUN(`targetTokens:1`) 후 `PUSH_DRY_RUN=false` 실발송 `sent:2` 확인, 운영 ON (2026-06-14 §배포·실기기 검증)

### 네이티브

- [x] expo-notifications ~55.0.23 / expo-device ~55.0.17 / expo-constants ~55.0.16 (package.json), `app.config.ts` plugin 추가, Android `default` 채널
- [x] registerPush: projectId fallback(`expoConfig.extra.eas.projectId ?? easConfig.projectId`), register-push-token 호출, 성공 시 `set_push_enabled(true)`, **hasToken=등록 성공 여부**
- [x] 포그라운드 핸들러(`shouldShowBanner/List/PlaySound`, badge false), 응답 리스너(route normalize→NAVIGATE), 콜드스타트 보류→WEB_READY flush
- [x] SDK 55 재확인 흔적: `getLastNotificationResponseAsync` deprecated 인지 + 버퍼링 위해 의도적 유지 + `clearLastNotificationResponseAsync`로 stale 재진입 방지 (주석)
- [x] 실기기 토큰 발급 (iOS, `targetTokens:1`, 2026-06-14) — [△] 토큰 재할당(재설치/계정전환) user_id 갱신은 코드 구현됨·시나리오 실측만 잔여

### 웹

- [x] soft-ask `push_prompt_seen_at` persistent 가드(받기/나중에 모두 `set_push_prompt_seen`)
- [x] 설정 토글 `set_push_enabled` RPC만 사용(직접 `.update()` 없음), effective status 표 5조합 정확 반영, OS denied 안내 + `OPEN_APP_SETTINGS`
- [x] NAVIGATE `normalizePushRoute` allowlist (네이티브 1차 + 웹 2차 + 발송 route 고정 = 3중, 외부URL/`javascript:`/protocol-relative 차단, 테스트 5케이스)

### Cron / 운영

- [x] `cron-setup.sql`: `0 0 * * *`(00:00 UTC=09:00 KST), Vault `push_cron_token`/`project_url`, upsert(재실행 안전), timeout 120s. 같은 날 중복발송 0은 claim 멱등 보장
- [x] 발송 실패 시 failed 기록(영구 skip 아님) — claim 모델
- [x] EAS **APNs**(iOS) + **FCM**(Android, Firebase isakok-bc157) 자격증명 + 빌드·실발송 검증 (2026-06-14) + **App Privacy/Data Safety** 점검 완료 (`/privacy` 코드 반영: 기기 푸시 토큰 + Expo 수탁 + 국외이전) — 상세 §배포·실기기 검증

---

## 누락 (스펙에 있는데 구현 안 됨)

- **🟡 (경미) soft-ask 노출조건 "온보딩 완료 직후"가 명시적 체크 아님** — 스펙 §6-1은 4조건(`push_prompt_seen_at IS NULL` AND `push_enabled=false` AND `isNativeWebView()` AND 온보딩 직후). 구현은 앞 3개만 검사하고 "온보딩 직후"는 **DashboardPage에만 마운트**하는 것으로 갈음. `push_prompt_seen_at` persistent 가드라 실질 무해(1회 응답 시 영구 차단)이나 스펙 문구와 1:1 아님 → 주석/스펙 정합화 권장 (spec-reviewer). **→ ✅ 해소 (2026-06-14): 동작 불변, 컴포넌트+마운트 주석을 스펙 §6-1과 정합(근사 방식 명시)**
- (그 외 §13 코드 항목 누락 없음. `[△]`는 누락이 아니라 배포·실측 대기)

## 스코프 크립 (구현했는데 스펙에 없음)

- **없음** (spec-reviewer 확인). 추가분은 전부 정당: `OPEN_APP_SETTINGS` 브릿지(스펙 §6-2 denied 안내 구현에 필수, 본문 코드예시엔 타입 누락) · register-push-token CORS/구조화로그/client-safe 에러(10-2 보안패턴 답습) · `kst_today`/claim RPC(보정) · expoPush malformed/네트워크 오류 시 error ticket 채우기(claim 멱등 전제)

## 컨벤션 위반 (CLAUDE.md 규칙 대비)

- **🔴 mutation 실패 시 toast 없음** — `usePushSettings.disable()` 실패가 `console.error`만. apps/web/CLAUDE.md "mutation 실패 시 toast.error" 위반 (ux-state)
- **🔴 4상태 loading 미처리** — `PushSettingRow`가 훅이 노출한 `isLoading`을 구조분해조차 안 함 → 초기 토글 OFF→ON 깜빡임. apps/web/CLAUDE.md UI 패턴(로딩 Spinner/Skeleton) + ux-state 4상태 위반
- **🔴 4상태 error 미처리** — `usePushSettings`가 `isError`/`error` 미노출 → 조회 실패가 `?? false`로 "OFF"에 흡수. (STATUS "웹 8개 페이지 Error 분기 누락" 기존 패턴의 신규 인스턴스)
- **🟡 a11y 최소기준(키보드 내비게이션)** — `PushPermissionSheet`가 `role="dialog" aria-modal` 선언만 하고 Esc 닫기·포커스 이동·focus trap 미구현. apps/web/CLAUDE.md "접근성 최소기준: 키보드 내비게이션" 위반. 같은 레포 `DeleteAccountSheet`에 정답 패턴 존재 (web-a11y)

---

## Codex 코드리뷰 결과

> `/codex:review` (working tree). P1 1건 / P2 1건. **둘 다 코드 머지 전 미반영 ⏳** (이번 세션은 검증만).

- **[P1] `apps/mobile/src/auth/AuthService.ts` signOut (토큰 unbind 누락)** — 로그아웃/계정전환 시 옛 user 알림이 같은 기기의 새 익명 유저에게 전달
  - 문제: `signOut()`(259-266)이 provider signOut → `supabase.auth.signOut()` → `ensureAnonymousSession()`만 하고 **push_tokens 정리도 `set_push_enabled(false)`도 안 함**. ExpoPushToken은 재설치 전까지 동일 → push_tokens row가 옛 user A에 매핑된 채 잔존 + A의 `push_enabled=true` 유지 → 다음 Cron이 A를 발송대상에 넣어 **A의 이사 알림(D-day·항목 제목)을 지금 그 기기를 쓰는 새 익명 user B에게 전달**. 또 새 세션은 자기 토큰이 없어 알림 0. (`registerPush.ts:49-50`에서 등록한 매핑이 signOut으로 끊기지 않음)
  - 보안 재평가(security-auditor W1): 누출 본문은 master 항목 **앱 작성 제목 + D-day 숫자**뿐(주소/연락처/이메일은 발송 경로에 미포함, Grep 0건)이라 직접 PII는 아님 → **Critical 아님**. 단 "A가 이사 중 + 잔여 항목" 활동사실 누출 + 부분 자가치유(B가 푸시 켜면 `onConflict:token`으로 재할당)라 **공개 출시 전 수정 권장(High)**
  - 수정: ✅ 완료 (2026-06-06) — `00028_push_unregister_rpc.sql`의 `delete_my_push_tokens()` RPC + `registerPush.unregisterPush()` + `AuthService.signOut()`이 세션 clear **이전** 호출(토큰 삭제 + `set_push_enabled(false)`). 원래 제시한 방향과 동일. 상단 "수정 반영" 1번. (deleteAccount 정상경로는 user CASCADE로 안전, 500 부분실패 W2도 W1 해결로 완화)

- **[P2] `apps/mobile/src/push/notificationHandler.ts:45` (NAVIGATE 전체 브로드캐스트)** — 푸시 탭이 비활성 탭 WebView 상태까지 오염
  - 문제: `flushPendingRoute()`가 `broadcastToWebViews({type:'NAVIGATE'})` 호출 → `broadcast.ts:35-45`가 **등록된 모든 활성 WebView**(탭별 `registerWebView`, `WebViewScreen.tsx:258)에 주입. 여러 탭 방문 후 알림 탭 시 Home/Timeline/Photos 세 WebView가 전부 푸시 route로 이동. 이후 그 탭 선택 시 탭 루트가 아닌 푸시 화면이 뜸(`WebViewScreen`tabPress 리셋은`isFocused`일 때만이라 미발동)
  - 수정: ✅ 완료 (2026-06-06) — `broadcast.ts`에 focused WebView 추적 + `flushPendingRoute`가 활성 탭 1개에만 단건 전달(활성 없으면 보류 유지로 콜드스타트 lazy-mount 안전) + `WebViewScreen` isFocused effect. 상단 "수정 반영" 2번.

---

## spec-reviewer 결과

- 일치: 요청 핵심 7항목(claim 멱등, milestone_date, 병합 skip, current move 1개, effective status 5조합, soft-ask 가드, allowlist 양측, DRY_RUN) + §13 DB/RPC/Edge/네이티브/웹/Cron **전부 정확 구현**
- 차이/누락: 위 "누락" 🟡 1건(soft-ask "온보딩 직후" → DashboardPage 마운트 갈음)
- 스코프 크립: 없음
- 5번째 마이그레이션(00027): 정당한 보정(근거 3곳 일관)
- 등급: 🔴 필수 **0건** / 🟡 권장 **1건** / 🟢 양호(컴포넌트 단일책임·레이어 규칙 준수·normalizePushRoute shared 승격·카피 런타임 경계 분리)

---

## 서브에이전트 리뷰 결과

- **security-auditor**: 🔴 0 / 🟡 2 / 🟢 다수
  - 🟡 W1 = Codex P1(로그아웃 토큰 unbind 누락, High·출시 전 권장) · 🟡 W2(deleteAccount 500 부분실패 시 토큰 잔존, W1 해결 시 완화)
  - 🟢 RLS default-deny(정책0=의도적 service_role only) 정합 · 00026 본인검증/00027 service_role GRANT로 위조 INSERT 차단 · register-push-token getUser 검증·에러 비노출 · send-notifications fail-closed·service_role 비노출 · 딥링크 이중 정규화(소비처가 react-router navigate뿐이라 오픈리다이렉트/스킴 표면 없음)
- **web-a11y-reviewer**: 🔴 5 / 🟡 5
  - 🔴 `PushPermissionSheet` 3건(열림 시 포커스 이동 없음 / Esc 닫기 없음 / focus trap 없음 — `aria-modal` 선언과 실제 동작 불일치, `DeleteAccountSheet`에 정답 패턴) · `PushSettingRow` 2건(토글 상태전이 `aria-live` 미전달 = "켜는 중→완료"·실패 롤백 무성 / "설정에서 켜기" 버튼 padding 0 → 터치 24px 미만 WCAG 2.5.8 위반)
  - 🟡 시트 닫힘 후 포커스 복원 · denied 경고 아이콘 · 토글 hit area 28px(44px 권장) · heading 레벨 검증 · `text-critical`(#EF4444 on white ≈3.76:1) 대비 런타임 측정
- **ux-state-reviewer**: 4상태 완전 **1/4**
  - 🔴 `usePushSettings` Error 분기 부재(`?? false`로 흡수) · 🔴 `PushSettingRow` Loading 미처리(isLoading 미사용, 토글 깜빡임) + Error 미처리 · 🟡 disable 실패 toast 없음(스냅샷 복원 아닌 invalidate 롤백) · 🟡 empty 모호(null/OFF/error 모두 false 수렴) · ⏱️ `enable()` 후 PUSH_STATUS 무응답 시 "켜는 중" 무한지속(타임아웃 없음)
  - 🟢 `PushPermissionSheet`는 로딩/에러 시 null 폴백이 soft-ask 특성상 적절(안 보이는 게 안전) → 실질 완전 인정. 브라우저 직접접속은 `isNativeWebView()` 게이트로 미렌더 → UI 차단 없음
- **native-a11y-reviewer**: 🔴 0 / 🟡 1 / 🟢
  - 🟡 Android 채널 `description` 추가 시 설정화면 스크린리더 친화(선택, 채널명 이미 명확) · 🟢 채널명 '이사 알림' 명확 · 포그라운드 배너/리스트/사운드 OS 공지 적절 · NAVIGATE 포커스/공지는 웹 SPA 라우팅 소관(네이티브가 추가하면 이중공지 → 안 하는 게 맞음). **유일 잔여 a11y는 웹**(푸시 딥링크 도착 후 react-router 전환 시 라우트 포커스/공지 — 기존 이슈)
- **perf-budget-reviewer**: 🔴 0 / 🟡 1 / 🟢
  - 🟢 웹 번들 **+0KB**(신규 npm 의존 0, expo-\* 는 모바일 전용·브릿지 위임이라 Vite 미유입), shared 추가 ~50줄 순수상수, `isNativeWebView()` 게이트·`staleTime:60s`·`enabled:!!userId` 렌더 가드, Expo 100청크·MAX 상한·무효토큰 정리
  - 🟡 send-notifications 유저당 N+1(moves 1 + checklist 1, 직렬 await) — 인덱스는 전부 히트라 인디 규모 사실상 🟢, 성장 시 `.in()` 배치/`Promise.all` 병렬화(주석에 "분산 후속" 명시된 의도적 MVP 트레이드오프)
  - 🟢 `getPushStatus` self-heal은 permission 가드 + 로컬캐시 토큰 + 설정진입 한정이라 과하지 않음

---

## 종합 판정

**최종 코드 판정: ✅ 통과** (2026-06-06) — build/lint/test/mobile typecheck green, spec-reviewer 🔴 0건, 스펙 §13 코드 항목 전부 구현, 스코프 크립 없음, 보안 핵심 경계(RLS·RPC GRANT·딥링크·fail-closed) 정합. **검증 시점 🔴 4그룹(버그 2 + a11y/4상태)은 같은 날 전부 수정 완료** → 출시 차단 잔여 0.

검증 시점 우선순위와 처리 결과 (각 항목 문제 설명 + 수정 보존 — 이력·회귀 방지):

1. **[P1/W1] 로그아웃 토큰 unbind 누락** (보안·프라이버시, High) — 문제: `signOut`이 토큰/토글을 안 끊어 옛 user 알림이 같은 기기의 새 익명 유저에게 감(dev=prod 실발송이라 출시 전 필수). → ✅ `00028` `delete_my_push_tokens()` RPC + `unregisterPush()`를 세션 clear 이전에 배선
2. **[P2] NAVIGATE 전체 브로드캐스트** (UX 버그) — 문제: 멀티탭 방문 후 알림 탭 시 비활성 탭까지 오염. → ✅ 포커스 탭 1개에만 단건 전달(활성 없으면 보류 유지)
3. **[ux] 4상태** — 문제: `PushSettingRow` Loading/Error 미처리·`usePushSettings` isError 미노출·disable 무성 롤백. → ✅ 스켈레톤+재시도 UI + isError 노출 + 실패 `toast.error`
4. **[a11y] `PushPermissionSheet` 모달 + 토글** — 문제: `aria-modal` 선언만(포커스/Esc/trap 부재)·토글 무성 전이·"설정에서 켜기" 터치 24px 미만. → ✅ 포커스 이동·Esc·trap + `aria-live` + 44px hit area
5. **🟡 권장 (미처리 — follow-up, 출시 비차단)** — soft-ask "온보딩 직후" 스펙 정합화 · N+1 배치화(성장 트리거) · Android 채널 description · denied 색대비 런타임 측정 · 토글 hit area 44px(토글은 처리됨, 측정만 잔여) · 푸시 딥링크 도착 후 웹 라우트 포커스/공지(기존 이슈)

> 🔴 1~4 수정 상세는 상단 "수정 반영" 섹션 참조 — 재검증(build/lint/test/mobile typecheck) 통과, 마이그레이션 `00027`→`00028` 1개 추가(로그아웃 토큰 정리 RPC).
>
> **남은 것**: 5(🟡) follow-up + 배포·콘솔(마이그레이션 push·함수 배포·Vault/시크릿·EAS·Cron·DRY_RUN 실발송)은 코드와 무관한 운영 단계로 STATUS "다음 할 것"에 유지. 커밋은 작업단위 분할 권장.
