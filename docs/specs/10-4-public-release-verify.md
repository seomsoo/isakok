# 10-4 정식 출시 준비 — 검증 리포트

> 검증일: 2026-05-29
> 스펙: `docs/specs/10-4-public-release.md` (Phase A + §1~§8, ADR-076~083)
> 브랜치: `feat/10-4-public-release`
> 종합 판정(검증 시점): **❌ 수정 필요** — 빌드/린트/타입체크/테스트는 전부 통과하나, 출시 전 닫아야 할 P0/P1 결함(보안 1, best-effort 깨짐 1, orphan 유발 재시도 누락, 동시 업로드 가드, 조회 에러 미처리)이 존재.
> **수정 반영 (2026-05-29)**: 위 🔴 5건 + dead code 1건 **코드 수정 완료**, 빌드/린트/타입체크/테스트(16/16) 재통과. 남은 것은 🟡(a11y·perf·게이트 자동 재개)와 운영 대기(콘솔/배포/secret). 상세는 맨 아래 **"수정 반영"** 섹션.

---

## 완료 확인 기준 결과 (스펙 §11)

표기: `[x]` 코드 구현 완료 / `[~]` 부분 구현 / `[ ]` 미완(누락 또는 운영 대기). "운영 대기"는 스펙 §0·§12에서 코드 외 작업으로 명시한 콘솔/배포 항목.

### Phase A — 스키마/공통

- [x] `auth_provider_links.apple_refresh_token` 컬럼 (service_role only, pgsodium 불요) — `00021_apple_refresh_token.sql` (RLS 활성 + 정책 0개 유지, provider CHECK를 kakao→kakao/apple 확장)
- [x] `_shared/deleteUserData.ts` 삭제 코어 (delete-account/cleanup/kakao 3곳 재사용 확인, chunk retry + 잔여 0건 검증 + stage별 에러)
- [x] 마이그레이션 prod 적용 — ✅ **2026-05-30** `supabase db push` (00021/00022 적용)

### §1 사진 게이트

- [x] `PhotoUploadFab` onClick `is_anonymous` 분기 (`PhotoUploadFab.tsx:24-31`, `PhotoEmptyState.tsx:20-26`)
- [x] 익명 → `REQUEST_LOGIN` 로그인 시트 (파일 선택 전, `source:'photo_gate'`)
- [x] 회원 → 미디어 피커 진입 (`OPEN_MEDIA_PICKER`)
- [x] 사진 탭 진입·기존 사진 보기 익명 허용 (본인 `auth.uid()` 한정 — usePhotos userId 필터 + getSignedUrls ownership 가드)
- [ ] 계정 삭제 후 새 anon user.id 이전 사진 미표시 검증 — **운영 대기** (코드상 RLS로 자동 보장, 실측 미실시)
- [~] 로그인 성공 후 linkIdentity → 데이터 승계 → **업로드 재시도** — linkIdentity/데이터 승계 ✓, **막혔던 업로드 자동 재시도 ✗** (로그인 후 `router.replace('/')`만, 재개 경로 없음)
- [x] 6단계 `console.log('TODO: 가입 유도')` 제거 (전체 grep 0건)

### §2 네이티브 미디어

- [x] 브릿지 `OPEN_MEDIA_PICKER`(moveId/room/photoType/maxSelect) / `MEDIA_UPLOADED`(items/failed) — bridge.ts 정의 + WebViewScreen 핸들러 + mediaUpload.ts 일치
- [x] 네이티브 카메라/갤러리 (expo-image-picker)
- [x] EXIF·SHA-256 네이티브 추출 (`extractTakenAt`/`sha256Hex`)
- [x] 네이티브 Storage 직접 업로드 (ADR-057 경로 `{userId}/{moveId}/{room}_{ts}_{i}.{ext}`)
- [x] native/WebView user.id 일치 검증 → 불일치 시 AUTH_SESSION 재주입 + **재시도** — 검증·재주입·재시도 모두 ✓ (2026-05-29 `pendingRef` 재INSERT 추가, §2-3 충족)
- [x] 웹 DB INSERT (`insertUploadedPhotos` — useUploadPhoto의 DB 부분만 재사용, Storage 부분 제거) + invalidation
- [x] 리사이즈+압축 (긴 변 1920px / WebP 80% / JPEG 폴백, ADR-083), taken_at은 압축 전 EXIF 추출, image_hash는 압축본 SHA-256
- [x] iOS `NSPhotoLibraryUsageDescription` 제거 / `NSCameraUsageDescription` 유지 (`app.config.ts:26-28`, expo-image-picker photosPermission:false)
- [x] 웹 `<input capture>`/`<input multiple>` 제거 — `useUploadPhoto.ts`/`exif.ts`/`resizeImage.ts` + `PhotoUploadButton.tsx`(2026-05-29 삭제) 모두 제거, web `<input capture/multiple>` 0건
- [x] 다중 선택 부분 실패 toast (성공 N장/실패 M장 분리 토스트)

### §3 cleanup

- [x] `cleanup` Edge Function: 익명 user(`get_anonymous_cleanup_candidates`: last_activity_at 30일 AND 미래 active move 없음) + 휴지통 30일 + orphan 24h
- [x] `_shared/deleteUserData` 재사용
- [x] DRY_RUN 모드 + structured 실행 로그 (started_at/mode/anonymousUsersDeleted/trashPhotosDeleted/orphansDeleted/errors, 207 멀티상태)
- [x] Supabase Cron 스케줄 + Vault 토큰 + pg_net — ✅ **2026-05-30** 등록 (`daily-cleanup` active, Vault `cleanup_token`/`project_url`, 수동 호출 200·DRY_RUN 확인)
- [x] 회원 미대상 확인 (RPC `is_anonymous=true`만 선정)

### §4 Apple revoke

- [x] AppleProvider authorization code 수신 (`credential.authorizationCode ?? undefined`)
- [x] `apple-token-exchange` (client_secret JWT ES256, code 교환, refresh_token service_role only upsert)
- [x] token exchange 실패 시 로그인 성공 유지 + 재시도 + 로깅 (`AuthService.exchangeAppleToken` best-effort, 2회 시도, 3경로 모두 호출)
- [x] delete-account에서 revoke 호출 (best-effort 5s, invalid_grant 무시) — 호출 위치/invalid_grant 처리 ✓ + 2026-05-29 `revokeAppleToken`/호출부를 try/catch로 감싸 throw가 삭제를 막지 않게 수정 (Codex P1 해소)
- [x] `.p8` Edge Function secret + rotation 기준 — 코드/주석 ✓ + ✅ **2026-05-30** Apple 시크릿 4개 등록(식별자 해시 검증 일치) + 함수 배포

### §5 Kakao 웹훅

- [x] Kakao 콘솔 연결 해제 웹훅 URL 등록 — ✅ **2026-05-30** (도메인+경로 `/functions/v1/kakao-unlink-webhook`, GET. 엔드포인트·위조방어 curl 확인 → `skipped:auth`)
- [x] Authorization(KakaoAK) 검증 + app_id 검증 + Admin Key 재조회 — 2026-05-29 **Kakao가 콜백에 싣는 `Authorization: KakaoAK ${ADMIN_KEY}` 헤더 검증을 1차 방어로 추가**(공식 문서 확인, Admin Key는 비밀값) + 재조회에 id echo 체크 + GET/POST 파라미터 모두 지원 (security-auditor 🔴 해소)
- [x] 검증 확정 불가 시 삭제 보류 (`unlinked !== true` → held, 삭제 안 함)
- [x] provider count 분기 → kakao만이면 `deleteUserCompletely`, 아니면 매핑만 제거 (native identity + link 둘 다 확인)
- [x] idempotency + 3초 내 200 OK (항상 200, 실패도 200+로그)

### §6 충돌

- [x] auth.tsx Alert 문구 (`auth.tsx:46-47` "사라지고 되돌릴 수 없어요...취소하면...보관해요" — 3요소 충족)
- [x] destructive 스타일 유지 (`style:'destructive'`)

### §7 RLS CI

- [x] `.github/workflows/rls-ci.yml` (PR/push → supabase start → 마이그레이션+seed → rls-smoke.ts → non-zero exit)
- [x] PR required check 등록 — ✅ **2026-05-30** main ruleset `main-protection`에 `RLS isolation (Supabase local stack)` 추가 (기존 `Verify` + 2개 필수)
- [x] CI 범위 = DB RLS 격리만 (Cron/Vault/외부 provider 제외 주석 명시)
- [x] `auth_provider_links`(apple_refresh_token 포함) 격리 테스트 (`rls-smoke.ts:165-182` — service_role 시드 후 anon 차단 검증, false-positive 방지)

### §8 콘솔/법무

- [ ] App Store Connect 앱 생성 + App Privacy(Tracking None) — **운영 대기**
- [ ] EAS iOS production 빌드 + Submit + TestFlight Internal 본인 폰 검증 — **운영 대기**
- [ ] Data Safety(Google) 폼 — **운영 대기**
- [x] OSS 고지 페이지(`/oss-licenses`, web+mobile+shared) — OssLicensesPage + 라우트 등록 + SettingsMenuList 메뉴 + gen-oss-licenses.mjs(production deps만, devDeps 제외)

### 빌드/린트/테스트

- [x] `pnpm build` 통과 (web 2935 modules, dist 785KB/gzip 227KB)
- [x] `pnpm lint` 통과 (web/mobile/shared 3/3)
- [x] `pnpm typecheck` 통과 (web/mobile 2/2)
- [x] `pnpm test` 통과 (**16/16** — progress 5, photoHash 3, urgencyMode 8)

---

## 누락 (스펙에 있는데 구현 안 됨)

> 운영 대기 항목(콘솔/배포/Cron 등록/secret/prod 마이그레이션/PR required check/실측 검증)은 스펙 §0·§12에서 코드 외로 명시했으므로 "누락"이 아닌 **운영 대기**로 분리(아래 종합 판정 참조). 아래는 코드 누락만.

1. **세션 불일치 시 INSERT 재시도 누락 (§2-3)** — `useMediaUploadListener.ts:38-43`. 불일치 감지 시 `REQUEST_SESSION_REFRESH` 송신 + `toast.error` + `return`으로 payload(items)를 드롭. 스펙 §2-3/§11 §2가 명시한 "AUTH_SESSION 재주입 후 **재시도**"의 재시도가 없다. 네이티브는 이미 Storage 업로드를 마친 상태라 DB INSERT만 누락 → **orphan 발생**(cleanup이 24h 후 청소 = eventual 손실). Codex P2 #3 / spec-reviewer 🔴 / ux-state-reviewer 🔴 공통 지적. → **✅ 수정 완료 (2026-05-29)**: `pendingRef`에 payload 보관 + 세션 재주입(`userId` 변경) 감지 시 1회 재INSERT(useMediaUploadListener).
2. **로그인 성공 후 막혔던 업로드 자동 재개 누락 (§1-2)** — 게이트로 차단된 업로드가 로그인 성공(linkIdentity·데이터 승계는 동작) 후 자동으로 재시도되지 않음. `auth.tsx:70` `router.replace('/')`로 홈 복귀만 → 사용자가 사진 탭에 다시 들어가 수동 재시도해야 함. → **⏳ 미반영 (🟡 follow-up)**: 게이트 차단 핵심(익명 업로드 불가)은 동작하고 데이터 무결성 이슈가 아님(로그인 후 사진 탭에서 다시 누르면 되고 기존 사진은 보존). 1번(broadcast race orphan, 데이터 손실)과는 **별개 흐름**(게이트→네이티브 로그인 왕복 후 picker 의도 복원)이라 UX 폴리시 단계로 분리.
3. **웹 `<input multiple/capture>` 제거 미완 (§2)** — `apps/web/src/features/photos/components/PhotoUploadButton.tsx`가 `capture="environment"`(L25) + `multiple`(L38)을 그대로 보유. **어디서도 import되지 않는 dead code**라 기능 위험은 없으나 스펙 §11 §2 "제거" 글자 그대로는 미충족 + 향후 오용 소지. → **✅ 수정 완료 (2026-05-29)**: `PhotoUploadButton.tsx` 삭제(외부 참조 0건 확인). 이제 web에 `<input capture/multiple>` 0건.

---

## 스코프 크립 (구현했는데 스펙에 없음)

- 없음. (spec-reviewer 확인 — `maxSelect` 등 브릿지 추가 필드는 모두 스펙 의도 내 보강으로 스코프 크립 아님.)

---

## 컨벤션 위반

- 없음 (CLAUDE.md TypeScript/React 규칙 위반 없음. `AuthService.tryLinkIdentity`의 `as any`는 ADR-043 검증된 예외로 주석 문서화됨).
- 단, `PhotoUploadButton.tsx` 미사용 dead code는 "파일당 하나의 책임" 정신·§2 input 제거 미완으로 **누락 3**에 기록(삭제 권장).

---

## Codex 코드리뷰 결과

> `/codex:review` (working tree diff) 결과. **검증 시점엔 전부 ⏳ 미반영**이었고, **2026-05-29 모두 ✅ 수정 완료**. 각 항목은 회귀 방지·이력 추적을 위해 원래 **문제 설명을 지우지 않고** 그 아래에 **수정 내용**을 덧붙여 양쪽 모두 보존한다.

- **[P1] `supabase/functions/delete-account/index.ts:98-100` — Apple revoke가 best-effort가 아님**
  - 문제: Apple 연동 계정 삭제 시 `revokeAppleToken` 호출이 `deleteUserCompletely`보다 먼저 `await`되는데, `revokeAppleToken`(`_shared/apple.ts:121-148`)은 `createAppleClientSecret`(env 누락 시 throw) 또는 `fetch`(네트워크 실패/5s timeout abort)에서 예외를 던질 수 있고 `try/finally`만 있고 catch가 없다. delete-account에도 revoke 호출 주위에 try/catch가 없어, 예외가 바깥 `catch (err)`로 전파되어 **500 반환 + `deleteUserCompletely` 미실행** → Apple 엔드포인트/설정이 일시 장애일 때 계정 삭제가 통째로 막힘. best-effort 정책(ADR-067/077) 위배.
  - 수정: ✅ **수정 완료 (2026-05-29)**. `_shared/apple.ts`의 `revokeAppleToken` 본문 전체를 try/catch로 감싸 `createAppleClientSecret`(secret 누락)·`fetch`(네트워크/timeout abort) 등 모든 예외를 흡수하고 `{ ok:false, error }`만 반환(절대 throw 안 함). `delete-account`의 revoke 블록(링크 조회 포함)도 try/catch로 감쌈. 이제 revoke 실패가 `deleteUserCompletely`를 막지 못함.

- **[P2] `apps/web/src/pages/PhotoRoomPage.tsx:79-80` — 업로드 진행 중 동시 미디어 선택 미차단**
  - 문제: `OPEN_MEDIA_PICKER` 송신 후 FAB이 계속 활성이고 `photos.length`는 네이티브 압축/업로드 + DB INSERT가 끝나야 갱신된다. 그 사이 사용자가 피커를 또 열면 두 요청이 동일한 잔여 `maxSelect: roomMeta.maxCount - photos.length`를 사용 → 방이 `roomMeta.maxCount`를 초과할 수 있다. 6단계의 `uploadingCount > 0` 조기 리턴 가드가 네이티브 비동기 전환으로 사라짐.
  - 수정: ✅ **수정 완료 (2026-05-29)**. `useMediaUploadListener`가 `requestPicker`(동기 `uploadingRef` 가드 + `isUploading` 상태)를 노출. PhotoRoomPage/PhotosPage가 `OPEN_MEDIA_PICKER` 직접 전송 대신 `requestPicker` 사용 → 왕복 중 재진입 차단(가드 1개라 같은 페이지의 모든 방 add 버튼에 적용). PhotoRoomPage FAB은 `isUploading` 시 disabled. 가드 해제는 `MEDIA_UPLOADED` 수신 시(취소·실패·성공 모두) — 취소 무신호 방지 위해 WebViewScreen이 취소/에러에도 빈 `MEDIA_UPLOADED`를 회신하도록 변경.

- **[P2] `apps/web/src/features/photos/hooks/useMediaUploadListener.ts:38-42` — 세션 새로고침 후 보류 업로드 재시도 누락**
  - 문제: WebView 세션이 네이티브 세션보다 뒤처질 때(broadcast race) 네이티브는 이미 Storage 업로드를 마쳤는데, 이 분기는 새로고침만 요청하고 단일 `MEDIA_UPLOADED` payload를 드롭한다. 재주입된 세션이 도착해도 `property_photos`에 넣을 것이 남아있지 않아 **업로드 파일이 orphan**으로 남고 사용자는 재선택을 강요받음.
  - 수정: ✅ **수정 완료 (2026-05-29)**. 불일치 시 payload를 `pendingRef`에 `failedUserId`와 함께 보관 + `REQUEST_SESSION_REFRESH` 전송. `userId` 변경(세션 재주입 완료)을 감지하는 effect가 보관 payload를 1회 재INSERT(재시도 후에도 불일치면 토스트 1회 후 종료 — 무한 루프 방지). Storage orphan 방지 = 스펙 §2-3 "재주입 후 재시도" 충족.

---

## spec-reviewer 결과

스펙 §11 체크리스트 전수 대조. P0(게이트·cleanup·Apple revoke·Kakao 웹훅·삭제 코어)는 모두 코드 존재 + ADR 의도 일치. 차이는 "재시도 2건 + dead code 1건"에 집중. 스코프 크립 0건.

- 🔴 **필수 수정 (3)**
  1. `useMediaUploadListener.ts:38-43` 세션 불일치 시 재주입 후 **INSERT 재시도 누락** (items 유실 → orphan). 스펙 §2-3 핵심 요구. (= 누락 1)
  2. §1/§2 로그인·세션 재주입 후 **막혔던 업로드 자동 재시도 부재** (스펙 §11 §1 "업로드 재시도", §2 "재주입 후 재시도"). (= 누락 2)
  3. `PhotoUploadButton.tsx` 웹 `<input capture/multiple>` 잔존 dead code → 삭제. (= 누락 3)
- 🟡 **권장 수정 (4)**
  - `deleteUserCompletely` 시그니처가 스펙의 `(admin, userId, options)`와 달리 2-인자 (기능 영향 없음, 표기 정합).
  - `gen-oss-licenses.mjs`가 top-level dependencies만 수집(전이 의존성 미포함) — 법무 고지 완전성 출시 전 점검.
  - `PhotoEmptyState` 익명/회원 문구 하드코딩 + 게이트 분기 로직 2곳 중복(향후 3번째 진입점 시 추상화).
  - §7 "PR required check 등록"은 워크플로 파일 외 GitHub 브랜치 보호 설정 필요(운영).
- 🟢 **양호**: 삭제 코어 통합(ADR-082), cleanup 3종+DRY_RUN+Cron 구성(ADR-076), Apple revoke 전 흐름(ADR-077), Kakao 웹훅 검증·보류·분기(ADR-078), 네이티브 미디어 리사이즈/압축/EXIF(ADR-079/083), 충돌 Alert(ADR-080), RLS CI + apple_refresh_token 격리(ADR-081), OSS 페이지/라우트/메뉴. 컴포넌트 설계(presentational/container 분리, Props 인터페이스) 양호.

---

## 서브에이전트 리뷰 결과

- **security-auditor**: 🔴 1 / 🟡 4 / 🟢 다수
  - 🔴 **kakao-unlink-webhook `confirmKakaoUnlinked`의 Admin Key 재조회 규격 미검증** (`index.ts:31-38`). 서명 없는 GET 콜백이라 위조 방어 전체가 이 재조회 한 점에 걸려 있는데, `/v2/user/me`에 `target_id_type/target_id`를 POST form body로 보냄. 카카오 관리자 키 조회 규격과 어긋나면 `target_id`가 무시되어 **임의 user_id에 대해 -101(끊김 확정)이 떨어질 수 있고 → 공개값인 app_id만 알면 타인 계정 삭제 가능**. 코드 주석도 "구현 직전 카카오 최신 문서 재확인" 경고. → **✅ 수정 완료 (2026-05-29)**: 공식 문서 확인 결과 **Kakao는 콜백에 `Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY}`(비밀값)를 실어 보냄** — auditor가 "서명 없음"으로 가정한 전제가 사실과 달랐다(스펙 §5-1/ADR-078의 "별도 서명 헤더 없음"도 정정 필요). 이 헤더 검증을 **1차 방어로 추가**(위조 요청은 admin key를 모르므로 차단). 추가로 재조회에 **id echo 체크**(반환 id가 대상과 일치할 때만 "연결됨" 확정, 불일치/누락은 보류)로 대상 혼동 차단. 위조 user_id 회귀 테스트는 Kakao 콘솔 콜백 등록 후 manual smoke로 권장(운영 대기).
  - 🟡 apple-token-exchange `provider_user_id` upsert 충돌 키 의미(sub 결손 시 userId fallback로 Apple 행 중복 가능) / delete-account 탈퇴 userId가 rate_limit_log에 최대 2일 잔존 + revoke 실패 메트릭 부재 / cleanup orphan 삭제 서킷브레이커 부재(DB 부분조회 시 정상 파일 오삭제 위험) / apple.ts `pemToDer`가 표준 base64를 base64url 디코더로 이중 변환(키 파싱 견고성).
  - 🟢 **Apple refresh_token 클라이언트 유출 경로 없음**(authorizationCode만 송신 → 서버 교환 → service_role only 저장 → 응답 `{ok:true}`만, 로그에 토큰/PII 없음). RLS smoke의 apple_refresh_token 실제 시드 후 차단 검증. cleanup CLEANUP_TOKEN fail-closed + RPC SECURITY DEFINER+search_path=''+grant 최소화. 삭제 코어 Storage→DB 순서 + 잔여 검증. delete-account 익명 403 + rate limit 503 fail-closed. config.toml verify_jwt 노출 적정.
- **web-a11y-reviewer**: 🔴 3 / 🟡 5 (터치 타겟은 신규분 8/8 44×44 충족 🟢)
  - 🔴 PhotoUploadFab 메뉴 열림 시 포커스 미이동 + `aria-expanded`/`aria-haspopup` 누락 / Esc 닫기 불가 + 닫힘 후 포커스 복귀 없음 / **게이트 차단(익명→로그인) 결과가 SR·시각 피드백 없이 네이티브 시트로만 전환**(WCAG 4.1.3, 흐름 분석 영역).
  - 🟡 FAB 백드롭 `role="button"` 오용 + 포커스 트랩 부재 / EmptyState 버튼 라벨("촬영"/"갤러리")↔실제 동작(로그인) 불일치 / 피커 버튼 게이트 예고 부재 / OSS `<h1>`이 헤더 바 뒤 / PhotoInfoBanner 닫기 24px(기존 코드).
- **native-a11y-reviewer**: 🔴 2 / 🟡 3 / 🟢 다수 (`auth.tsx`)
  - 🔴 로딩(ActivityIndicator) 상태가 SR에 미전달(`accessibilityState busy` 또는 announce 부재 — 소셜 로그인 수초 대기 "응답 없음" 오인) / 화면 진입 직후 비동기로 나타나는 provider 버튼 목록 변동 미고지.
  - 🟡 파괴적 Alert 버튼 라벨 비대칭(특히 Android는 destructive 스타일 미반영 → "로그인" 중립 단어만 들림) / iOS 에러 announce 부재 + 동일 메시지 재낭독·포커스 미이동 / 스킵 버튼 라벨↔표시 텍스트 불일치(음성 제어).
  - 🟢 터치 타겟(48), role/label/state(disabled), USER_CANCELLED 무음, Alert 본문 비가역성 경고 문구.
- **ux-state-reviewer**: 4상태 완전 **0 / 2 UI 컴포넌트** (PhotoRoomPage·PhotosPage 모두 Error 분기 0)
  - 🔴 `usePhotos`/`useCurrentMove`/`useSignedUrls`의 `isError`/`error` 미사용 → **조회 실패가 빈 배열(`data=[]`)로 흡수돼 빈 상태로 위장**(사진 있는 사용자에게 "없음" 표시, 재시도 수단 0). 공통 `ErrorMessage` 컴포넌트 자체가 앱에 부재. → **✅ 수정 완료 (2026-05-29)**: 공통 `ErrorMessage`(role=alert + 다시 시도) 신설, PhotoRoomPage/PhotosPage가 `usePhotos`의 `isError`/`refetch`를 읽어 에러≠빈상태로 분기.
  - 🔴 네이티브 피커 왕복 ~ INSERT 완료 사이 **진행/대기 표시 없음**(중복 트리거 여지 — Codex P2와 연결). → **부분 수정 (2026-05-29)**: `isUploading`으로 PhotoRoomPage FAB을 disabled 처리 + `requestPicker` 동기 가드로 중복 트리거 차단. 명시적 스피너/optimistic placeholder는 🟡 follow-up.
  - 🔴 세션 불일치 payload 드롭 후 재시도 없음(= 누락 1). → **✅ 수정 완료 (2026-05-29)**: `pendingRef` 재시도(누락 1 참조).
  - 🟡 PhotoRoomPage 목록 로딩 스켈레톤 없음 / 업로드 실패 토스트에 "다시 시도" 액션 없음.
  - 🟢 성공 토스트(저장 N장/실패 M장 분리) + invalidation, isAtMax 가드.
- **perf-budget-reviewer**: 🔴 1(기능 정상) / 🟡 4 / 🟢 다수
  - 🔴 다중 선택 업로드가 **완전 직렬 처리**(`for` 루프 내 압축+해시+업로드 await) → N장 선형 누적 지연. 단 직렬이 base64/ArrayBuffer 메모리 피크를 장당 1벌로 억제(병렬 전환 시 저사양 OOM 위험) — 개선은 동시성 2~3 제한 또는 점진적 회신 권장.
  - 🟡 `MAX_BYTES` 10MB 안전망이 300KB 목표 대비 헐거움(JPEG 폴백 시 용량 급증 가능) / OSS 등 저빈도 라우트 코드 스플리팅 부재(앱 전반 React.lazy 0건) / base64 메모리 오버헤드(~1.33배) / OSS 37항목 map(무해, 가상화 불요).
  - 🟢 신규 mobile 의존성 웹 번들 영향 0 + named import 트리셰이킹 / 파일 WebView 미통과(브릿지 병목 회피) / 압축 파라미터 ~300KB 부합 / WebP+JPEG 폴백 + EXIF 압축 전 추출 / 부분 실패 격리.

---

## 종합 판정

**검증 시점: ❌ 수정 필요.** 빌드/린트/타입체크/테스트(16/16)는 전부 통과하고 P0 기능의 코드 골격·ADR 의도는 모두 충족하나, 출시 전 닫아야 할 결함이 다수 채널(Codex·spec-reviewer·security·ux)에서 중복 확인됨. **→ 2026-05-29: 아래 🔴 1~5 + dead code 정리 모두 코드 수정 반영, 재검증(빌드/린트/타입체크/테스트 16/16) 통과.** 남은 것은 🟡(아래 follow-up) + 운영 대기.

### 우선순위 (수정 권장 순) — 결과

1. ✅ **[보안] Kakao 웹훅** — (원지적: 재조회 규격 미검증으로 타인 삭제 가능) **공식 문서 확인 결과 Kakao가 `Authorization: KakaoAK ${ADMIN_KEY}`(비밀값) 헤더를 보냄** → 이 헤더 검증을 1차 방어로 추가 + id echo 체크 + GET/POST 지원. 위조 user_id 회귀 테스트는 콘솔 콜백 등록 후 manual smoke(운영 대기).
2. ✅ **[Codex P1] Apple revoke best-effort 복구** — `revokeAppleToken` 전체 try/catch(never throw) + `delete-account` revoke 블록 try/catch.
3. ✅ **[Codex P2 / 스펙 §2-3] 세션 불일치 재시도** — `useMediaUploadListener`가 payload 보관 후 세션 재주입 시 1회 재INSERT (orphan 방지). (로그인 후 자동 재개=누락 2는 🟡 follow-up으로 분리)
4. ✅ **[Codex P2] 동시 업로드 가드** — `requestPicker`(`uploadingRef`+`isUploading`) 재진입 차단 + WebViewScreen 취소/에러 빈 회신으로 가드 해제 보장.
5. ✅ **[ux] 사진 조회 Error 상태 처리** — 공통 `ErrorMessage`(role=alert+재시도) 신설 + `usePhotos` `isError`/`refetch` 와이어(에러≠빈상태).
6. ✅ **[정리] dead code** — `PhotoUploadButton.tsx` 삭제(§2 web `<input capture/multiple>` 0건).

### 남은 작업 (follow-up)

- 🟡 **로그인 성공 후 업로드 자동 재개** (누락 2) — 게이트 차단 핵심은 동작·데이터 무결성 이슈 아님(재탭 시 동작). UX 폴리시 단계로 분리.
- 🟡 **a11y** — 게이트 차단 SR/시각 피드백, FAB `aria-expanded`/포커스/Esc, 소셜 로그인 로딩 announce(`accessibilityState busy`), 파괴적 Alert 버튼 라벨(특히 Android).
- 🟡 **perf** — 다중 업로드 직렬→동시성 제한(2~3)/점진적 회신, JPEG 폴백 용량 2차 임계, 저빈도 라우트 `React.lazy`.
- 🟡 **gen-oss 전이 의존성** 포함 여부 출시 전 점검 / revoke 실패 메트릭·orphan 서킷브레이커 DECISIONS 기록.
- 📄 **문서 정정 필요**: 스펙 §5-1 / ADR-078의 "Kakao unlink 콜백은 별도 서명 헤더 없음" 서술 → 실제로 `Authorization: KakaoAK` 헤더가 존재하므로 정정(이번 보안 수정의 근거).

### 운영 배포 (2026-05-30 진행 / 코드 외 — 스펙 §0·§12)

**완료 ✅**: ① 마이그레이션 prod 적용(`db push`) · ② Edge Function 4개 배포(apple-token-exchange·delete-account·cleanup·kakao-unlink-webhook) · ③ 시크릿 8개(cleanup·Apple·Kakao, 식별자 해시 검증) · ④ Supabase Cron+Vault(`daily-cleanup`, 200·DRY_RUN 확인) · ⑤ Kakao 연결 해제 웹훅 등록(엔드포인트·위조방어 확인) · ⑥ RLS CI required check(main ruleset)

**남음**:

- cleanup `DRY_RUN=true`→`false` 전환 (첫 주 후보 로그 확인 후 — 안 바꾸면 후보만 보고 실삭제 안 함)
- §8 출시 트랙: App Store Connect 앱 생성·App Privacy / EAS iOS production 빌드·Submit·TestFlight Internal(본인 폰) / Data Safety(Google) 폼
- 계정 삭제 후 새 anon user.id 이전 사진 미표시 실측 검증
