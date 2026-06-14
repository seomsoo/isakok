# 프로젝트 상태

> 마지막 업데이트: 2026-06-14 (12단계 푸시 알림 — **배포 + iOS 실기기 검증 완료, 운영 ON**. 마이그레이션 push(00023~00028)·Edge 배포·시크릿/Vault·Cron·EAS iOS&Android 빌드·DRY_RUN→EXECUTE 실발송·3상태(백그라운드/콜드스타트/포그라운드)+딥링크·Android FCM(Firebase isakok-bc157)·App Privacy/Data Safety 점검까지 완료. EAS 빌드 정합 픽스 ADR-097(RN 0.83.6 SDK 정렬+static framework+eas env=production). 미커밋 코드 12파일 커밋 진행 중. 잔여: on-device 반영(토글 CSS 웹 재배포·Android 채널 HIGH 다음 빌드)·토큰 재할당 field test(deferred·비차단)·🟡 follow-up + 11 배포후 실측 + 10-4 잔여 콘솔 → "다음 할 것")

## 현재 단계

12단계: 푸시 알림 (일정 기반 리마인더) — **배포 + iOS 실기기 검증 완료(2026-06-14), 운영 ON(EXECUTE + 매일 09:00 KST Cron). 코드 12파일 커밋 진행 중**

Expo Push로 데일리 다이제스트 + D-day 마일스톤(7/3/1/0)을 09:00 KST Cron 발송(회원·익명, 권한 수락 시). 구현: DB(00023~00028 — push*tokens·notification_log claim 모델·users push 컬럼·set_push*\*/claim/kst_today/delete_my_push_tokens RPC) · Edge(register-push-token, send-notifications + cron-setup) · 네이티브(expo-notifications 권한/토큰/Android 채널/포그라운드·응답·콜드스타트, WebView·\_layout 배선) · 웹(soft-ask 모달·설정 토글 effective status·NAVIGATE 딥링크·privacy Expo 수탁 고지) · ADR-090~096. `pnpm lint`/`typecheck` 통과, `test` shared 21·web 15. Edge(Deno)는 로컬 deno 미설치라 배포 시 검증. 스펙 `docs/specs/12-push-notifications.md`(+`12-push-notifications-verify.md`).

> 구현 중 스펙 보정 4건(상세 ADR-091~094 보완): ① claim은 부분 유니크 인덱스라 supabase-js upsert 불가 → RPC로(00027) ② 네이티브는 `createAuthedClient(access_token)`(supabaseNative 세션없음) ③ current move = getCurrentMove 실제기준(`status='active'`+`created_at desc`) ④ DB 기준 날짜 `kst_today()` RPC. `getLastNotificationResponseAsync` SDK55 deprecated→버퍼링 구조상 유지+`clearLast...`.

> 검증(/verify) 후 🔴 4 수정: ① Codex P1 로그아웃 토큰 unbind(00028 `delete_my_push_tokens` RPC + signOut에서 호출 — 옛 user 알림이 새 익명 유저에게 가던 누출) ② P2 NAVIGATE 활성탭 단건 전달(비활성 탭 오염 방지) ③ ux 4상태(loading/error/toast) ④ a11y 모달(포커스/Esc/trap)+토글 aria-live·터치타깃. 상세 `docs/specs/12-push-notifications-verify.md`(코드 판정 ✅).

(11단계 관측: #70 머지 완료. 10-4: 코드 머지 PR #61·핵심 배포 완료, 잔여 콘솔은 아래. dev=prod ADR-075.)

## 진행 중인 것

- **12단계 푸시 알림**: **배포·iOS 실기기 검증 완료(2026-06-14), 운영 ON.** 마이그레이션·Edge·시크릿/Vault·Cron·EAS iOS&Android·DRY_RUN→EXECUTE 실발송·3상태+딥링크·Android FCM·App Privacy/Data Safety 점검 끝(상세 `12-push-notifications-verify.md` §배포·실기기 검증). 배포 중 EAS 빌드 정합 픽스(ADR-097) + 토글 CSS·채널 HIGH·soft-ask 주석 정합. **다음: 미커밋 코드 12파일 커밋(작업단위 분할) → 토글 CSS 웹 재배포(Vercel).** 잔여(비차단): 토큰 재할당 field test(deferred), Android 채널 HIGH 팝업 on-device(다음 빌드 재설치 시).
- (11단계 관측 #70 머지 완료, 10-4 follow-up #68/#69 머지 완료)
- (10-4 잔여 콘솔/운영은 아래 "다음 할 것")

## 다음 할 것

1. **12단계 마무리** (배포·검증 ✅ 완료, `12-push-notifications-verify.md` §배포·실기기 검증) — 남은 건: (a) **미커밋 코드 12파일 커밋**(작업단위 분할: 모바일 빌드정합 app.config/package/lock → eas.json → 채널 → 웹 토글 CSS → soft-ask 주석 → docs) + 적절한 브랜치/PR (b) **토글 CSS 웹 재배포**(Vercel — PR 머지 시 자동) (c) 비차단 잔여: 토큰 재할당 field test(소셜 로그인→로그아웃 시나리오, deferred) · Android 채널 HIGH 팝업 on-device(다음 빌드 재설치) · 🟡 follow-up(N+1 배치화·denied 색대비·웹 라우트 포커스). **테스트로 바꾼 이사일 원복 필요**(D-0 → 실제 날짜, 안 하면 매일 디지스트).
2. **11단계 배포 후 실측** (verify 리포트 ⏳잔여) — `VITE_APP_ENV`/`environment` 태그 의도값 · Sentry 알림 `environment=production` 필터 · 대시보드 실 페이로드 PII 육안검증 · Sentry retention 콘솔 확정.
3. **10-4 잔여 콘솔/운영** — Kakao 콘솔 콜백 URL + 위조 user_id smoke · 나머지 시크릿(CLEANUP_TOKEN/DRY_RUN/KAKAO_APP_ID/KAKAO_ADMIN_KEY) · cron-setup.sql(cleanup 스케줄) · 브랜치 보호 RLS CI required check · App Store Connect·EAS production·TestFlight·Data Safety · `npx expo prebuild --clean`

## 완료된 것 (요약 인덱스 — 상세는 각 단계 spec/verify + ADR.md)

> 단계별 디테일(컴포넌트·훅·서비스·마이그레이션·Codex 이력·설계 결정)은 아래 정본 문서에 보존. 이 섹션은 회상용 인덱스다. 설계 의사결정 전반은 `docs/ADR.md`(ADR-001~), 초기 기획 맥락은 `docs/DECISIONS.md`, UI 폴리싱은 `docs/UI-POLISH.md`.

- **0단계 프로젝트 세팅** ✅ — Turborepo 모노레포·Vite·Tailwind v4·Vitest. 📄 `specs/00-project-setup.md`(+verify)
- **1단계 Supabase 세팅** ✅ — 스키마·RPC·RLS·Storage·시드. 📄 `specs/01-supabase-setup.md`(+verify)
- **2단계 온보딩** ✅ — 4단계 폼 → 체크리스트 생성(RPC 트랜잭션). 📄 `specs/02-onboarding.md`(+verify)
- **디자인 시스템** ✅ — OKLCH 토큰·타이포 6종·토스 톤. 📄 `DESIGN.md`·`specs/component-design-spec.md`
- **3단계 대시보드+타임라인+설정** ✅ — 오늘 할 일·전체 타임라인·설정. 📄 `specs/03-dashboard-timeline.md`(+verify)
- **4단계 항목 상세+체크 토글+메모** ✅ — 낙관적 토글·메모 자동저장(lastSavedRef). 📄 `specs/04-detail.md`(+`04-detail-verify.md`)
- **5단계 스마트 재배치** ✅ — 5모드 그룹핑/재배치. 📄 `specs/05-smart-reschedule.md`(+verify)
- **6단계 집 상태 기록+리포트** ✅ — 사진 업로드(EXIF·SHA-256·리사이즈)·방별 기록·리포트·휴지통. 📄 `specs/06-property-photo.md`(+verify)
- **7단계 AI 맞춤 가이드** ✅ — Edge Function + Claude(Haiku) 캐시·인플라이트 잠금. 📄 `specs/07-ai-guide.md`(+verify) · ADR-009·015~022
- **8단계-1 하네스 코어** ✅ — 로컬 커밋훅 + CI + /auto-fix. 📄 `specs/08-1-harness-core.md`(+`08-1-verify.md`) · ADR-023~033
- **8단계-2 하네스 CI 봇** ✅ — PR 요약 + dry-run 분석 + 서브에이전트 6종. 📄 `specs/08-2-harness-ci-bot.md`(+`08-2-verify.md`)
- **8단계-3 하네스 실동작 검증 + 프롬프트 튜닝** ✅ — GitHub Secrets/Variables(`ANTHROPIC_API_KEY_HARNESS`·`AUTO_FIX_BOT_TOKEN`·`AUTO_FIX_MODE=dry-run`·`HARNESS_LLM_MODEL=claude-sonnet-4-6`), 워크플로 버그 수정(PR #23/#25/#26), 프롬프트 튜닝(PR #27~#29), Dependabot 정리, 실동작 검증(PR #24). _(전용 spec 없음 — 핵심 보존; 참고 `harness-ops.md`)_
- **9↔10 단계 스왑 문서 반영** ✅ — 아키텍처상 Expo 셸(9) 먼저·인증(10) 나중으로 스왑, 23개 파일 번호 정리 + native-a11y-reviewer 활성화. PR #31. _(전용 spec 없음 — 핵심 보존)_
- **9단계 Expo 셸 + WebView 래핑** ✅ — WebView 래핑·네이티브 탭바·스플래시·브릿지 프로토콜. 📄 `specs/09-expo-shell.md`(+verify) · ADR-034~040
- **10-1 네이티브 인증 + 세션 브릿지** ✅ — Anonymous 우선·linkIdentity/폴백·Kakao Edge exchange·세션 브로드캐스트. 📄 `specs/10-1-native-auth.md`·`10-1-spike-result.md`·`10-1-manual-setup.md`(+`10-1-verify.md`) · ADR-041~054
- **10-2 RLS + Edge Function/Storage 보안** ✅ — RLS 활성화(00016~00020)·storage 정책·rate limit·익명 마이그레이션·RPC ownership 가드. 📄 `specs/10-2-rls-security.md`(+verify)
- **iOS 실기기 테스트 + UI 폴리시** ✅ — 네이티브 탭바·SSGOI 전환·스와이프백·브릿지 확장·소셜 버튼 브랜드. 📄 `UI-POLISH.md`
- **10-3 계정 삭제 + 약관 + release-gate** ✅ — 계정 삭제 흐름·약관·dev=prod 하드닝. 📄 `specs/10-3-internal-test-release.md`(+verify) · ADR-075 · PR #59
- **10-4 정식 출시 준비** ✅(코드) — 사진 게이트·네이티브 미디어·cleanup·Apple/Kakao 인증·RLS CI·WebView 콜드로드 견고화. 📄 `specs/10-4-public-release.md`(+verify) · ADR-075~084 · PR #61 _(배포·콘솔 잔여는 위 "다음 할 것")_
- **11단계 관측(Observability)** ✅(#70 머지) — Sentry(웹 에러+브릿지 실패 로깅·PII 스크럽(exception/message/stack 포함)·소스맵)·PostHog(이벤트만·autocapture off·단일 프로젝트+`environment` 태그)·업타임(health Edge Function + UptimeRobot)·개인정보처리방침 수탁자 추가 + apps/web vitest 셋업. 📄 `specs/11-observability.md`(+verify) · ADR-085~089 _(스펙 본문 ADR 084~088 ↔ 실제 085~089)_ _(배포후 실측 잔여는 "다음 할 것")_
- **12단계 푸시 알림** ✅(코드+검증 — 커밋·배포·콘솔 대기) — Expo Push 데일리 다이제스트 + D-day 마일스톤(claim 모델 멱등)·soft-ask/설정 2레이어 토글·딥링크(allowlist)·register-push-token(service*role)·send-notifications(Cron+DRY_RUN). 📄 `specs/12-push-notifications.md`(+verify, 코드 판정 ✅) · ADR-090~096 *(스펙 4 마이그레이션 → 실제 00023~00028: claim/kst*today/unregister RPC. 검증 후 Codex P1/P2 + a11y/4상태 수정)*

## 알려진 문제

- urgent/critical 모드 격려 문구는 사용자 상황별 맞춤 교체 검토 (Follow-up)
- previousMode는 현재 세션 단위. 10단계 인증 후 서버 영속 검토 (Follow-up)
- CLAUDE.md import 별칭 `@shared/` vs 실제 `@moving/shared` 불일치 (빌드 문제 없음, 정리 필요)
- shared/constants/aiGuide.ts dead code (VALID_HOUSING_TYPES 등 미사용 상수)
- 10-2 폴백 발동(linkIdentity 실패→signInWithIdToken) 영속 로깅 미구현 — 현재 console.warn만, DB 카운트 테이블 추가 검토 필요
- 웹 8개 페이지에서 Error 분기 누락 (ux-state-reviewer 지적, 기존 이슈, 별도 단계)
- EAS CLI `eas env:list` 실행 시 Google Sign-In iosUrlScheme 누락으로 실패 — EAS Secrets 등록은 Expo dashboard 웹 UI로 완료. CLI 이슈는 별도
- **gitleaks 17건 노출 흔적 잔존** (apps/mobile/eas.json, apps/mobile/app.json, .gitleaksbaseline) — rotation으로 노출 키는 무효화. git filter-repo 정리는 Task #21 (PR 머지 직후 작업 마지막 단계)
- **delete-account rate limit 429 동적 검증 미실시** (P1) — 같은 user JWT로 4회 호출 불가(1회 시 user 삭제). 코드 review로 충분
- ~~**Apple Sign in with Apple token revoke 미구현** — 10-4 deferred~~ → **✅ 구현·배포 완료 (2026-06-05 확인)**: 마이그레이션 00021(apple_refresh_token) prod 적용, `delete-account` v7가 `_shared/apple.ts`의 `revokeAppleToken()`로 `appleid.apple.com/auth/revoke` 호출, APPLE\_\* 시크릿 설정 완료. 계정 삭제 시 Apple 측 연결도 서버에서 해제됨
- **Kakao Developers 콘솔 web 플랫폼 등록 미실시** — native SDK + Edge Function exchange 흐름이라 영향 없음. 10-4 Kakao 웹훅 단계에서 함께 마무리
- **service_role 키 이번 세션 chat 컨텍스트 노출** — Legacy JWT-based API keys disable로 즉시 무효화됨. 새 sb*secret*... 키도 chat에 잠시 노출 — 향후 보안 강박 시 dashboard에서 "+ New secret key" 발급 + 옛 secret disable로 재정리 가능
- **익명 cleanup 작업 미구현** — 30일 미활동 + 이사 일정 도래 시 자동 파기 정책. 약관엔 명시되어 있지만 cron job 미구현. 사진 저장 게이트(ADR-074, 10-5+) 적용 전까지 익명 사진이 서버에 쌓일 수 있음
- **Custom domain 미구매** — `isakok.vercel.app` 사용. WebView 앱이라 도메인 가시성 작아 지금은 ROI 낮음. 10-4 폐쇄 테스트 전 또는 GitHub README 강조 시점에 재검토 (ADR-075 분리 트리거 일부)
- **DB 백업 워크플로우 첫 실행 검증 미실시** — workflow_dispatch는 default branch 필수라 PR 머지 후 검증. 머지 직후 또는 다음날 KST 03:00 cron 자동 실행으로 확인
- **EAS Secrets visibility 분류** — 7개 변수 중 SUPABASE_ANON_KEY + KAKAO_NATIVE_APP_KEY는 Sensitive, 나머지는 Plain text 권장. 사용자가 모두 Sensitive로 통일했어도 안전한 default (동작은 동일)
- **(10-4 코드 해결)** Apple revoke(§4)·익명 cleanup(§3)·Kakao 웹훅(§5) 구현 완료 → 위 "Apple token revoke 미구현"·"익명 cleanup 작업 미구현"·"Kakao 콘솔 web 등록" 항목의 코드 부분 해소. **콘솔 등록·함수 배포·cron 설정은 사용자 액션 잔존**
- **10-4 §2 네이티브 미디어·압축은 EAS 빌드 실기기 검증 필요** — 로컬은 typecheck/lint만 통과. iOS WebP 인코딩은 JPEG 폴백으로 방어하나 실기기 확인 권장
- **Kakao unlink 웹훅 Admin Key 연결 재조회 규격(/v2/user/me + target_id) 미확정** — 구현 직전 Kakao 최신 문서 재확인 필요. 확정 불가 시 보류(안전 기본값)라 미확인이면 삭제 미발생(보수적)
- **Deno Edge Function 6종 로컬 deno check 미실시** (deno 미설치) — 배포/deno check로 타입 검증 필요. IDE의 Deno/npm: 진단은 false positive
- **cleanup orphan 청소는 전체 버킷 스캔** — 대규모에서 비용. 현재 인디 규모 OK, ADR-075 분리 시점 재검토
- **10-4 사용자 액션 미완**: db push(00021,00022) / 함수 4종 배포(+secrets) / cron-setup.sql / Kakao·Apple 콘솔 / App Store Connect·App Privacy / 브랜치 보호 RLS CI required / npx expo prebuild --clean
- **11단계 관측 🟡 (검증 권장, 비차단 — 상세 `specs/11-observability-verify.md`)**: **✅ 2026-06-06 후속 처리 완료** — (H-1) Sentry `scrubEvent`가 exception value·`event.message`·stack `filename`·breadcrumb 미스크럽(에러 메시지에 박힌 주소/메모가 새는 최대 PII 경로) → `redactText`(URL query strip+이메일 마스킹) 추가 / (H-2) 1-depth 스크럽 → 재귀(중첩 PII 차단) / (Codex P2) `getEnv()` fallback prod 오분류 → `development`로 / photo_gate source 통일 / ESLint posthog 직접 import 차단 / 관측 순수로직 단위테스트(scrub 11·filterProps 4). **잔여(비차단)**: (H-3) PostHog IP 차단이 콘솔 "Discard client IP"에만 의존 — 코드 강제는 IP가 서버측 부여라 client 옵션 부재로 선택 하드닝 보류 / (perf) 새 SDK ~80-95kB gzip 렌더 차단 → PostHog 지연로드·라우트 스플리팅·manualChunks (스펙 §10 품질레인 12+) / (a11y) 뒤로가기 44px·라우트 진입 포커스·text-muted 대비 (기존 이슈, 별도)

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 — `IS DISTINCT FROM` 사용
- Tailwind v4 font-size 토큰: `--text-*` 네임스페이스 사용
- 커밋: 작업 단위(파일 1~3개) 분리 — 한 번에 몰아서 커밋 금지
- ActionSection 뱃지: 제목 위 배치 어색 → 같은 줄 인라인
- 상세페이지 섹션 제목에 text-caption uppercase 금지 → text-h3 semibold
- TipCard에 보더+배경 둘 다 약하게 쓰지 말 것 → 좌측 bar + bg-tertiary/50
- YYYY-MM-DD를 `new Date()`에 직접 넣지 말 것 → `parseLocalDate` 사용
- 디바운스 자동저장에서 mutate 즉시 호출 금지 → in-flight ref + pending ref 직렬화
- 디바운스 자동저장의 변경 판별에 서버 prop(예: `photo.memo`)을 쓰지 말 것 — 비동기 fetch 전 stale prop이라 빠른 편집 시 저장 누락. 대신 `lastSavedRef`로 마지막 전송 값 추적
- 필터 UI에서 선택된 항목의 데이터가 0건이 되면 자동으로 전체 필터로 리셋할 것 — 칩이 숨겨져 사용자가 빈 목록에 갇힘
- `noUncheckedIndexedAccess` 켜진 packages/shared에서 `arr[n].field` 직접 접근 금지 → optional chaining
- verify 리포트의 Codex 리뷰 항목을 갱신할 때 원래 "문제" 설명을 지우지 말 것 → "문제 + 수정" 두 줄 구조 유지
- `is_skippable` 같은 nested 필드는 `master_checklist_items.is_skippable` 경로로 추출해 progress util에 넘길 것 — 최상위로 가정 시 모두 undefined 처리되어 과대 계산
- 모드 전환 배너의 dismissed 플래그는 모드 변경 시 반드시 리셋 (`setPreviousMode`에서 같이 처리)
- CI 워크플로우에서 `execSync`로 사용자 제어 가능한 값(브랜치명 등)을 쉘 보간하지 말 것 → `execFileSync` + argument array 사용 (GH_TOKEN 환경에서 command injection 위험)
- auto-fix-bot 워크플로우에서 trusted tools를 `tools/` 경로에 체크아웃하면, `gh` CLI 명령어는 git repo 컨텍스트가 필요하므로 `working-directory: workspace` 지정 필수 (pnpm setup도 `package_json_file: tools/package.json` 명시 필요)
- Claude API 단일 응답(비-에이전트)에서 중간 사고 출력을 막으려면 프롬프트에 "최종 마크다운만 출력, 추가 파일을 읽으려 하지 마라" 명시 필요 — 에이전트 정의만으로는 부족, user prompt에도 중복 지시
- Android WebView 무한 스피너 디버깅 시 네트워크 레이어만 의심하지 말 것 — 에뮬레이터 브라우저에서 접속 되면 네트워크는 정상. 앱 코드의 로딩 상태 해제 경로(onLoadEnd, onMessage의 WEB_READY 처리)를 먼저 확인
- Android 에뮬레이터에서 adb reverse는 에뮬레이터 재시작/ADB 재연결 시 풀림 — 10.0.2.2 + Vite `--host 0.0.0.0` 조합이 더 안정적 (adb reverse 불필요)
- Vite dev server를 `--host 0.0.0.0` 없이 기동하면 IPv6 `[::1]`에서만 리슨 — Android 에뮬레이터의 10.0.2.2는 IPv4 전용이라 접속 불가
- iOS 26.3 시뮬레이터 런타임은 부팅 불안정 (SimRuntime 검사에서 무한 대기) — 안정 버전(iOS 18.x) 사용 권장
- `@react-native-seoul/kakao-login` config plugin을 `app.json`에 누락하면 `RNKakaoLogins.init()` assertionFailure로 앱 크래시 — prebuild 전 config plugins 목록 반드시 확인
- iOS 시뮬레이터에서 앱 삭제해도 WebView localStorage는 안 지워짐 — SecureStore도 앱 컨테이너와 별개로 유지될 수 있음. 세션 초기화 필요 시 `xcrun simctl erase <device-id>` 사용
- `supabase.ts` 모듈 레벨에서 `isNativeWebView()` 호출하면 `window.__IS_NATIVE_WEBVIEW__`가 아직 설정 안 된 시점에 평가될 수 있음 — `typeof window !== 'undefined' && window.__IS_NATIVE_WEBVIEW__ === true`로 직접 체크
- WebView `injectedJavaScriptBeforeContentLoaded`로 localStorage 정리해도 native SecureStore에 세션이 남아있으면 `WEB_READY` 응답 시 다시 주입됨 — localStorage 정리만으로는 세션 초기화 불충분
- PostgreSQL `CREATE OR REPLACE FUNCTION`은 동일 시그니처만 대체 — 파라미터 수가 다르면 별개 함수(overload)로 생성됨. SECURITY DEFINER 함수 시그니처 변경 시 반드시 `DROP FUNCTION IF EXISTS`로 옛 버전 제거 (안 하면 RLS 우회 가능)
- Edge Function 레거시 CORS export(`corsHeaders = { 'Access-Control-Allow-Origin': '*' }`)를 남겨두면 새 함수가 실수로 import할 위험 — origin 제한 패턴(`resolveCorsOrigin`/`makeCorsHeaders`)으로 통일 후 레거시 export 즉시 제거
- RLS smoke test에서 `data.length === 0` 단독 assertion은 "접근 거부"와 "빈 테이블"을 구분 못함 — service_role로 시드 행 삽입 후 authenticated로 읽기 시도하거나 error 존재 여부로 판정
- `supabase db push` 시 원격에만 있는 타임스탬프 마이그레이션(직접 적용한 것)이 로컬 마이그레이션과 충돌 — `migration repair --status reverted`로 원격 정리 후 `--status applied`로 이미 적용된 로컬 버전 동기화
- 웹앱을 브라우저에서 직접 열면 세션이 없어 온보딩에서 "session missing" 에러 — 네이티브 Expo가 세션을 주입하는 구조이므로, 브라우저 테스트 시 수동으로 `signInAnonymously()` 호출 후 새로고침 필요
- WebView에서 브릿지 메시지를 보내는 컴포넌트를 파일명으로 추측하지 말 것 — PhotoDetailSheet에 SET_TAB_BAR를 추가했으나 실제 화면은 PhotoFullscreenViewer였음. `grep -r 'import.*Component' src/` 등으로 import 그래프를 확인 후 작업
- Expo Metro 서버를 `--host lan` 없이 시작하면 실기기에서 Metro에 접속 불가 — `npx expo start --host lan` 필수
- `navigation.getParent().setOptions({ tabBarStyle })` 는 Stack navigator를 타겟하므로 탭바 제어 불가 — Tabs 화면에서는 `navigation.setOptions()` 직접 호출이 올바름
- iOS WebView에서 `-webkit-user-select: none`과 `-webkit-touch-callout: none`을 CSS body에만 걸면 일부 하위 요소에서 long-press 메뉴가 새는 경우 있음 — `*` 셀렉터 + `!important` + JS 이벤트 차단(contextmenu/selectstart/dragstart capture) 세 겹 방어 필요
- **Supabase Edge Runtime의 `jsr:@supabase/supabase-js@2`에서 `admin.auth.admin.updateUserById()`가 `unexpected_failure` 반환하는 회귀** — 같은 호출이 Node.js 스크립트로는 정상 동작. **해결책**: (a) import를 `npm:@supabase/supabase-js@2`로 변경 (b) admin SDK 대신 raw `fetch`로 `PUT /auth/v1/admin/users/{id}` 직접 호출 (apikey + Bearer service_role 헤더). kakao-token-exchange가 이 두 패턴 모두 적용
- **Kakao 익명→permanent 전환 시 placeholder 이메일 고정값 사용 금지** — `kakao_${kakaoId}@isakok.invalid` 고정이면 옛 테스트 잔재 orphan user가 같은 placeholder 점유 시 409 email duplicate. **해결책**: `kakao_${kakaoId}_${anonymousUserId}@isakok.invalid` 같은 고유값
- **Edge Function 500 응답에 server 내부 에러 메시지 노출 금지** — `errorResponse(500, err.message)` 형태로 client에 server detail 전달하면 prod 부적합. **해결책**: client 응답은 일반 코드(`'KAKAO_USER_UPDATE_FAILED'` 등), server는 `console.error('[label]', { code, status, message, ... })`로 상세 logging. dashboard logs에서만 보임
- **service_role 키를 chat에 직접 export 금지** (가능하면) — Claude bash에서 `SUPABASE_SERVICE_ROLE_KEY=eyJ...` inline export하면 chat history에 평문 노출. 대신 사용자가 .env.local에 추가 후 Claude는 process.env로 읽기. 단 진단·검증에 효율 우선이면 risk acceptance + 작업 후 rotation
- **`listUsers({ perPage: 200 })`는 anonymous 사용자를 default exclude** — 새 supabase-js 버전 동작. 모든 user 보려면 raw HTTP (`GET /auth/v1/admin/users`) 또는 `getUserById(id)` 직접 호출
- **`git filter-repo`는 작업 도중 실행 금지** — working tree 변경 + stash → filter → unstash 충돌 위험 + 모든 commit hash 변경으로 진행 흐름 꼬임. **해결책**: PR 머지 직후 작업 마지막 단계에서 진행 (Task #21). branch 정리도 함께
- **아이콘/스플래시 에셋 교체 후 반드시 `npx expo prebuild --clean`** — icon.png, adaptive-icon.png 등 변경 시 "prebuild 안 해도 된다"는 틀린 조언. 양 플랫폼 모두 prebuild 필요
- **Android adaptive-icon.png에 흰 배경 금지** — 풀 사이즈 로고+흰 배경이면 OS 마스크 후 아이콘 전체를 덮어버림. 투명 배경 + 40% 캔버스 크기 권장
- **`expo-splash-screen` imageWidth 설정은 양 플랫폼 공통** — iOS만 줄이려고 설정하면 Android도 같이 줄어듦. 플랫폼별 분리는 `ios.splash`/`android.splash` 사용
- **`npx expo run:ios --device` 설치 실패 시 xcodebuild + xcrun devicectl 대안** — `LockdowndClient TypeError: Cannot convert object to primitive value` 에러 발생 시 `xcodebuild -workspace ... -scheme ... -destination 'id=...'` 빌드 + `xcrun devicectl device install app --device ... --path ...` 설치로 우회
- **dev=prod 결정 시 파괴적 스크립트(dev-wipe.sql 등) 즉시 삭제** — project-ref 가드가 이제 prod를 가리켜 실행하면 prod 와이프. "단순 잔재 정리"가 아니라 "dev→prod 하드닝 게이트"로 인식 필요
- **Supabase Free tier project limit은 owner 계정 기준** — `seomsoo (Limit: 2 free projects)` — 같은 계정이 owner/admin인 모든 org를 합쳐 활성 2개. 새 free org 만들어도 동일 카운트. 회피책: 다른 사람 owner의 org에 collaborator(그레이존), Pro upgrade, 또는 dev=prod 통합(ADR-075)
- **WebView 앱에서 custom domain은 사용자 가시성 작아 ROI 낮음** — 도메인은 약관 페이지 클릭/Play Console privacy URL/면접관 GitHub README 등 부수 시점에만 노출. 마케팅·SEO 본격화 또는 10-4 폐쇄 테스트 시점에 검토
- **EAS Environment variables Visibility = `Secret`은 `EXPO_PUBLIC_*`에 부적합** — `Secret`은 빌드 worker만 접근, client bundle에 inline 안 됨 → `process.env`로 못 읽음. publishable·URL 같은 `EXPO_PUBLIC_*`는 `Plain text` 또는 `Sensitive`만
- **GitHub Actions의 `workflow_dispatch`는 default branch에 workflow 파일 필수** — feature branch에만 있으면 404. PR 머지 후 트리거 또는 default branch에 일부 cherry-pick 필요
- **expo-image-picker `quality: 1`은 "최고 화질=압축 최소"라 파일이 오히려 큼** (12MP JPEG ~3-5MB, base64는 JPEG 데이터). 작게 하려면 quality를 낮추거나(압축) expo-image-manipulator로 리사이즈. 증거 사진도 무압축은 무료 티어 1GB를 ~8명에 소진 → 6단계처럼 리사이즈+압축 필수 (ADR-083)
- **사진 압축 시 EXIF "깨짐"은 파일 내 EXIF 블록 strip을 의미** — 촬영일시(taken_at)를 압축 전 picker EXIF에서 추출해 DB 보존하면 증거력 핵심 유지(6단계 동일). 압축 = 증거력 전면 포기 아님
- **원본+압축썸네일 병행 / Supabase 이미지 변환은 스토리지 절감에 역효과** — "원본을 그대로 저장"해 정작 저장 용량을 못 줄임(변환은 대역폭만 + Pro 전용). 무료 티어 저장 목표엔 부적합
- **expo-image-manipulator `manipulateAsync`는 deprecated** (★ 경고) — 신규 컨텍스트 API `ImageManipulator.manipulate().resize().renderAsync().saveAsync()` 사용. deprecation은 lint/typecheck를 깨진 않으나 신규 API가 깔끔
- **Expo 패키지는 SDK 55에서 통합 버전(55.0.x)** — `pnpm --filter @moving/mobile exec expo install <pkg>`로 SDK 호환 버전 자동 선택 (추측 버전 수기 입력 금지)
- **Expo 프로젝트에서 `react-native`를 SDK가 고정한 버전보다 올리지 말 것** — `babel-preset-expo`가 `@react-native/babel-preset`을 정확히 고정 의존(SDK 55=0.83.6)이라, RN만 앞서면(드리프트 0.85.3) production 번들에서 코드젠이 새 네이티브 컴포넌트(`VirtualView`의 `onModeChange`) 파싱 실패. dev Metro는 지연 변환이라 우회돼 안 보이고 `expo export`(EAS 번들)에서만 터짐. precompiled 프레임워크·네이티브 모듈 ABI도 어긋남. RN 생태계(`react`·`react-native`·`react-native-*`)는 `expo install`로만 갱신 + Dependabot ignore. (ADR-097)
- **EAS `EXPO_PUBLIC_*`는 빌드 프로필이 가리키는 environment에 등록돼 있어야 번들에 인라인됨** — 변수를 `production` 환경에만 넣고 `--profile preview`로 빌드하면 빈 환경 참조 → 실기기 즉시 크래시(`[supabaseNative] EXPO_PUBLIC_SUPABASE_URL/ANON_KEY missing`). dev=prod라 `eas.json` 3개 프로필 모두 `environment: production` 명시. google pod는 autolinking이라 env 무관(혼동 주의). Secret visibility는 번들 미인라인(Sensitive는 됨). (ADR-097)
- **supabase/functions/\*\*(Deno)는 ESLint/tsc 대상 외** (apps/web·mobile·packages/shared만) — IDE의 "Cannot find name 'Deno'/Cannot find module 'npm:'·'https:'" 진단은 false positive. 실검증은 deno check 또는 supabase functions deploy
- **기존 파일을 cat(Bash)으로만 봤으면 Edit 전 Read 도구로 다시 읽어야 함** — Edit는 conversation 내 Read 이력 필수 (routes.ts 편집 시 1회 실패)
- **스펙의 "완료 확인 체크리스트"(§8)를 직접 `[x]`로 체크하지 말 것** — 스펙 본문은 계약/변경이력이라 원본 보존. **검증 결과 체크는 `docs/specs/{단계}-verify.md`에** 기록(설정 완료 vs 배포 후 실측을 `[x]`/`[△]`/`[ ]`로 구분). 11단계에서 스펙 §8을 잘못 체크했다가 원복
- **신규 ADR 번호는 스펙 작성 시점 가정과 실제 `docs/ADR.md` 최대번호가 어긋날 수 있음** — 추가 직전 ADR.md 최대번호 확인 후 +1. (11단계: 스펙 본문은 ADR-084~088로 썼으나 084 선점 → 실제 085~089로 시프트, 양 문서에 매핑 노트)
- **apps/web에 vitest 추가 시 `tsconfig.app.json`의 `include:["src"]`가 `*.test.ts`까지 tsc(build) 대상으로 잡아 vitest 전역(describe/it/expect) 타입 에러** — build tsconfig에 `exclude:["src/**/*.test.ts"]` 추가 + eslint flat config에 `*.test.ts` `no-undef:off` 블록으로 분리(테스트 전역은 vitest 런타임이 주입). packages/shared는 build에 tsc 단계가 없어 무관, web만 해당
- **Sentry PII 스크럽을 user/request/breadcrumb 구조화 필드만 막으면 불충분** — 실무 최대 누수 경로는 `event.exception.values[].value`(에러 메시지에 박힌 주소/이메일)·`event.message`·stack frame `filename` 쿼리. `beforeSend`에서 이 자유 텍스트까지 redact(URL query strip + 이메일 마스킹) 필요. 한글 주소·메모는 패턴화 불가라 "메시지에 PII 미보간" 호출부 규율이 1차 방어, 스크럽은 마지막 그물
