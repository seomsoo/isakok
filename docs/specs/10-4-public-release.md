# 10-4: 정식 출시 준비 (공개 전 하드닝 + 부가 기능)

> **버전**: v2 (GPT 심층 리뷰 반영 — pgsodium 철회, Kakao 검증 정정, 삭제 코어 통합, cleanup 기준 고정 등)
> **한 줄 요약**: 외부 공개 직전 닫아야 할 구멍(사진 게이트·cleanup·인증 마무리)과 부가 기능(네이티브 카메라·충돌 점검·RLS CI)을 한 단계로 묶어 코드/구현을 완료한다. 실제 외부 공개(External TestFlight·App Store 제출·Android 프로덕션 승격·대중 URL 공개)는 **스펙 외 "다음 단계"로 분리** — 이 스펙은 "코드 완료 + 본인 폰 Internal 검증"까지가 완료 조건이다.

> **선행 조건 / 진행 중 사항**
>
> - Android **비공개 테스트(closed testing) 12명, 14일 카운트 진행 중** (2026-05-29 시작, ~06-12 14일 충족 예정). 코드 작업과 병렬.
> - Apple Developer Program 계정 등록·인증 완료.
> - dev=prod 단일 Supabase 프로젝트 유지(ADR-075). 분리하지 않음.

---

## 0. 범위 / 작업 순서

### 0-1. 하는 것 / 안 하는 것

**하는 것 (스펙 본체)**

- **(묶음 1 — 공개 전 닫아야 할 구멍)**: 사진 게이트(ADR-074 구현) / 익명 cleanup + 휴지통 + orphan(Supabase Cron) / Apple token revoke / Kakao 연결 끊기 웹훅
- **(묶음 2 — 콘솔/법무)**: Data Safety·App Privacy 폼 / 제3자 OSS 고지 / iOS TestFlight **Internal까지만**
- **(부가)**: 네이티브 미디어 입력(카메라+갤러리) / 충돌 conflict-pending 유지 + Alert 점검 / RLS CI

**안 하는 것 (→ §12 다음 단계로 분리)**

- iOS External TestFlight / App Store Review 제출 / Android 프로덕션 승격·release / prod 대중 URL 공개
- UI/UX 폴리싱 (사용자 별도 일정)
- 익명→회원 merge(keep_both) / 충돌 발동률 영속 로깅 — 미도입(ADR-080)
- Apple S2S Notification / Google RISC — 제외, lazy detection(ADR-078)
- dev/prod 분리 (ADR-075)
- **pgsodium TCE 컬럼 암호화** — 신규 도입하지 않음(ADR-077, Supabase 비권장)

### 0-2. 작업 순서 (Phase) — 의존성 기준

**Phase A — 스키마/공통 기반**

- `auth_provider_links.apple_refresh_token` 컬럼(service_role only) + `_shared/deleteUserData.ts` 삭제 코어

**Phase B — 사진 파이프라인 (순서 엄격)**

1. **§1 사진 게이트** — 가장 먼저. 익명 신규 사진 0으로 만들어 프라이버시 공백 차단. 후속(cleanup) 전제.
2. **§2 네이티브 미디어 입력** — 게이트 통과 후 업로드 경로를 네이티브로 교체.
3. **§3 cleanup** — §1·§2가 남기는 잔여·orphan·휴지통 정리(앞 둘이 cleanup 대상을 만들기 때문에 마지막).

**Phase C — 인증 마무리 (서로 독립)** 4. **§4 Apple token revoke** (Phase A 컬럼 선행) 5. **§5 Kakao 연결 끊기 웹훅** 6. **§6 익명→회원 충돌** — Alert 문구 점검만(가벼움)

**Phase D — 품질/인프라** 7. **§7 RLS CI** — 스키마가 다 바뀐 뒤 격리 검증 + CI 연결. **범위는 DB RLS 격리로 제한**.

**Phase E — 콘솔/법무 (코드와 병렬)** 8. **§8** — 코드 의존 적음. **App Store Connect 앱 생성은 가장 먼저 착수**(TestFlight·심사 리드타임).

### 0-3. 우선순위

- **P0 (공개 전 필수)**: §1 게이트, §3 cleanup, §4 Apple revoke, §5 Kakao 웹훅, §3-4 삭제 코어.
- **P1 (품질·기능)**: §2 네이티브 미디어, §7 RLS CI.
- **P2 (운영·점검)**: §6 Alert 점검, §8(단 App Store Connect 등록은 조기 착수).

---

## 1. 사진 저장 게이트 (ADR-074 구현)

### 1-1. 결정

- 비회원(익명)은 앱 전체를 쓰되 **사진 "저장(서버 업로드)"만 로그인 회원 전용**.
- 게이트 발동 = **업로드 버튼(촬영/갤러리) 탭 시점**(파일 선택 전). 익명이면 로그인 시트.
- 사진 탭 진입·기존 사진 보기는 익명도 허용(Apple 5.1.1(v)). 비회원 로컬 저장 없음.

### 1-2. 구현 방향

- `PhotoUploadFab` onClick에서 `is_anonymous` 분기: 익명 → `REQUEST_LOGIN`(로그인 시트, 파일 핸들링 전) / 회원 → 미디어 피커(§2).
- 판정 기준은 `delete-account`의 `is_anonymous`와 동일.
- 가치 노출: `EmptyState`/`RoomTipCard` 문구가 "보증금 분쟁 증거 보관" 전달.
- 로그인 성공: `linkIdentity`로 익명→회원 승격(user.id 유지) → 데이터 자동 승계 → 업로드 재시도.
- 6단계 `console.log('TODO: 가입 유도')` placeholder 교체.

### 1-3. 주의 / 엣지케이스

- 게이트 적용 순간부터 신규 익명 사진 0. 과도기 익명 사진은 §3 cleanup이 처리.
- 익명도 **본인 `auth.uid()`에 속한 기존 사진만** 봄. **계정 삭제 후 새 anon user.id로 바뀌면 이전 사진은 보이지 않아야 함**(RLS로 자동, verify에서 실측).

---

## 2. 네이티브 미디어 입력 (카메라 + 갤러리)

### 2-1. 결정

- 카메라·갤러리 **모두** `expo-image-picker`. 웹 `<input capture>`/`<input multiple>` 제거.
- 데이터 전달 = **네이티브 직접 Storage 업로드 + 웹에서 DB INSERT**(파일이 WebView 미통과).
- **용량 최적화 (ADR-083으로 추가/정정)**: 네이티브에서 **리사이즈(긴 변 1920px) + 압축(WebP 80%, JPEG 폴백)** → 장당 ~300KB. (초안의 "무압축 원본 보존"을 무료 티어 스토리지 현실로 정정 — 아래 2-3 참조.)

### 2-2. 구현 방향

- 브릿지:
  - `OPEN_MEDIA_PICKER { kind: 'camera' | 'gallery', multi: boolean, moveId, room, photoType: 'move_in' | 'move_out' }` (web → native — 네이티브가 Storage 경로 생성에 필요)
  - `MEDIA_UPLOADED { items: { storage_path, taken_at, hash }[] }` (native → web)
- 네이티브: `expo-image-picker` → EXIF 촬영일시 **추출(압축 전)** → **리사이즈+압축(긴 변 1920px / WebP 80% / JPEG 폴백, ADR-083)** → 압축본 SHA-256 해시 → Storage 직접 업로드(`{userId}/{moveId}/{room}_{ts}`, ADR-057) → `MEDIA_UPLOADED`. (`expo-image-manipulator` 컨텍스트 API)
- 웹: 수신 → 기존 `useUploadPhoto`의 **DB INSERT 부분만 재사용**(Storage 부분 제거) → `property_photos` INSERT → TanStack Query invalidation 유지.
- iOS PHPicker(iOS 14+): 사진 라이브러리 접근 권한 불필요 → `NSPhotoLibraryUsageDescription` 제거. 카메라 `NSCameraUsageDescription` 유지. Android는 expo-image-picker가 권한/피커 자동 처리.

### 2-3. 주의 / 엣지케이스

- **세션 일치 검증**: native는 session owner, WebView는 broadcast(AUTH_SESSION)로 세션 공유(10-1). 정상 흐름엔 일치하나 broadcast race로 일시 불일치 가능 → `MEDIA_UPLOADED` 처리 전 **native user.id와 WebView user.id 일치 확인**. 불일치면 INSERT 중단 + `AUTH_SESSION` 재주입 후 재시도(RLS 실패/orphan 방지).
- **다중 선택 부분 실패 UI**: 성공 N개 저장, 실패 M개는 toast 안내 + 재시도/다시 선택.
- **파일 크기 (ADR-083으로 정정)**: 리사이즈+압축 도입 — 긴 변 1920px + WebP 80%(JPEG 폴백) ≈ 300KB. 촬영일시(taken_at)는 압축 전 EXIF에서 추출해 DB 보존, image_hash는 압축본 SHA-256. 10MB 상한은 방어용으로 유지(압축 후엔 사실상 안 걸림).
  - ~~초안: 원본 보존(증거력) 유지·압축/리사이즈 안 함, 10MB 초과 시 안내 + 재촬영/재선택~~ → **ADR-083으로 뒤집음**. 사유: 무압축(3~5MB) 시 무료 티어 1GB가 사용자 ~8명에 소진(ADR-075 dev=prod) → 사실상 Pro 강제. 증거력 핵심(촬영일시·식별성·무결성)은 1920px/80% + DB taken_at + 압축본 해시로 충족.
- **orphan 위험**: Storage 성공 + 웹 INSERT 실패 시 "장부 없는 파일" → §3 cleanup orphan 청소가 사후 커버(eventual consistency).
- EXIF: 촬영일시(taken_at)는 **압축 전에 추출해 DB에 보존**(증거력 핵심). ~~파일 내 EXIF 압축/strip 금지~~ → ADR-083: 리사이즈 시 파일 내 EXIF는 strip되나 taken_at은 DB 보존, 부가 EXIF(GPS·기기모델)는 분쟁 기록 수준에서 손실 수용.

---

## 3. 익명 cleanup + 휴지통 + orphan (Supabase Cron)

### 3-1. 결정

- 실행 = **Supabase Cron → cleanup Edge Function**(호출 토큰 Vault). 단일 Edge Function이 3가지 처리:
  1. **익명 user 파기**: 아래 §3-3 기준.
  2. **휴지통 사진 30일 영구삭제**: `deleted_at` 30일 경과분 hard delete(06단계 daysLeft 실현).
  3. **orphan 파일 청소**: Storage에 있으나 `property_photos.storage_path` 매칭 없고 24h 경과한 파일.

### 3-2. 구현 방향

- **삭제 코어는 `_shared/deleteUserData.ts`로 통합**(§3-4) — 세 함수가 재사용.
- `supabase/functions/cleanup`(service_role): 익명 user → 대상 목록 → 각각 `deleteUserCompletely`. 휴지통 → 30일 경과 사진 remove + DB delete. orphan → 차집합 24h 유예 후 remove.
- **DRY_RUN 모드**: `DRY_RUN=true`면 삭제 대상만 로그 출력(실제 삭제 X). 첫 수동 실행/첫 1주는 DRY_RUN으로 후보 검증 후 EXECUTE 전환.
- **실행 로그**: 매 실행 structured log(started_at, mode, anonymousUsersDeleted, trashPhotosDeleted, orphansDeleted, errors). Cron이 조용히 실패하면 cleanup이 멈추므로 점검용.
- Supabase Cron(Integrations > Cron): 매일 1회 → `pg_net`으로 Edge Function POST(Vault 토큰).

### 3-3. 익명 cleanup 기준 (고정)

- `last_activity_at = greatest(auth.users.last_sign_in_at, max(moves.updated_at), max(user_checklist_items.updated_at), max(property_photos.updated_at))` ← 실제 컬럼명은 스키마로 확인.
- 대상 = `provider='anonymous'` AND `last_activity_at < now() - interval '30 days'` AND **이사일 도래**.
- **이사일 도래** = 해당 익명 user의 모든 active `moves.moving_date < current_date`. 미래 이사 일정이 하나라도 있으면 제외. active move가 없으면 충족으로 본다.
- 회원은 cleanup 대상 아님(계정 삭제로만 — ADR-066).
- 게이트(§1)와 동시 적용이라 cleanup이 다루는 익명 사진은 과도기 잔여뿐. orphan 24h 유예 = 방금 업로드분 오삭제 방지.

### 3-4. 삭제 코어 통합 (`_shared/deleteUserData.ts`)

- delete-account / cleanup / kakao-unlink-webhook은 삭제 로직을 **중복 구현하지 않고** 공통 모듈 재사용.
- 함수: `listUserStoragePaths` / `deleteUserStorage` / `deleteUserDatabaseRows` / `deleteUserCompletely(admin, userId, options)`.
- 호출자별 역할:
  - delete-account: JWT 검증 → userId → `deleteUserCompletely` → provider revoke/unlink best-effort → 새 anon session.
  - cleanup: 대상 익명 userId 목록 → 각각 `deleteUserCompletely`.
  - kakao-unlink-webhook: payload 검증 → userId 매핑 → provider count 분기 → 필요 시 `deleteUserCompletely`.
- 이렇게 Storage prefix 삭제·chunk retry·protect_delete 대응·`auth_provider_links` 삭제·사후 검증이 한 곳에서 유지됨.

---

## 4. Apple token revoke

### 4-1. 결정

- 계정 삭제 시 Apple revoke endpoint 호출로 Apple 정책 충족(App Store 출시 전 필수).
- 그러려면 사용자의 **refresh_token 보관** 필요 → 로그인 흐름에 authorization code 단계 추가.
- refresh_token은 `auth_provider_links.apple_refresh_token`에 **service_role only 컬럼**으로 저장(클라이언트 SELECT/UPDATE 불가, Edge Function만 읽음). **pgsodium TCE는 신규 도입하지 않음** — Supabase가 신규 사용을 비권장(deprecation 예정), TCE는 운영 복잡도·오설정 위험이 높고, Supabase는 기본 at-rest 암호화를 제공하므로 service_role only로 충분. `.p8` 서명 키는 Edge Function secret(env).
- revoke 실패 정책은 ADR-067 그대로: best-effort + 5s timeout + warn 로그(PII 금지).

### 4-2. 구현 방향

- **Phase A 선행**: `auth_provider_links.apple_refresh_token` 컬럼 추가(service_role only — users/links RLS는 SELECT 정책 0개 유지, ADR-062 정신). pgsodium 불요.
- 모바일 `AppleProvider`: `signInAsync` 시 `authorizationCode`도 수신 → `apple-token-exchange` Edge Function 전달.
- `apple-token-exchange`(service_role): `.p8`로 client_secret JWT(ES256) 생성 → Apple token endpoint(`/auth/token`)와 code 교환 → refresh_token 수신 → `auth_provider_links` 저장.
- `delete-account`: 대상이 Apple user면 client_secret JWT + refresh_token으로 `https://appleid.apple.com/auth/revoke` POST(best-effort, 5s).

### 4-3. 주의 / 엣지케이스

- client_secret JWT는 만료가 있어 매 호출 생성(또는 단기 캐시).
- refresh_token이 없으면 revoke 불가 → auth code 흐름이 반드시 선행.
- **token exchange 실패 정책**: authorization code는 1회성·단명이라 교환 실패 시 재확보가 어려움. 단 revoke가 best-effort이므로 **로그인 자체는 성공 유지**(UX) + token exchange 실패 시 즉시 재시도 + 다음 로그인 때 새 code로 재확보 + 실패 로깅. (로그인을 실패 처리하지는 않음 — Apple은 합리적 노력을 요구하고, token 없는 user는 삭제 시 revoke를 건너뛰되 삭제는 진행.)
- **`.p8` key rotation**: `APPLE_PRIVATE_KEY(.p8)`/`TEAM_ID`/`KEY_ID`/`CLIENT_ID`는 Edge Function secret으로 관리. 유출 의심 시 Apple Developer에서 key revoke → 새 key 발급 → secret 교체.
- `invalid_grant`(사용자가 Apple 측에서 이미 해제)는 best-effort라 무시하고 삭제 진행.
- refresh_token은 백엔드 전용(클라이언트 절대 미수신). `auth_provider_links` service_role only.

---

## 5. Kakao 연결 끊기 웹훅 (역방향)

### 5-1. 결정

- 사용자가 카카오 측(카카오계정 > 연결된 서비스 관리)에서 우리 앱 연결을 끊을 때 카카오가 보내는 **연결 끊기 웹훅** 수신.
- ⚠️ **검증 방식 (2차 정정 2026-05-29, 공식 문서 확인)**: 카카오 연결 끊기 콜백은 **GET 또는 POST**(파라미터 `app_id`/`user_id`/`referrer_type` = 쿼리스트링 또는 form body)로 오고 **3초 내 200 OK**를 요구한다. HMAC/SET 같은 본문 서명은 없으나, **Kakao가 `Authorization: KakaoAK ${SERVICE_APP_ADMIN_KEY}` 헤더를 함께 보낸다**(Admin Key는 비밀값). 1차 정정의 "별도 서명 헤더가 없다"는 서술을 다시 정정 — 이 Admin Key 헤더가 핵심 위조 방어가 된다.
- 위조 방어(다단계): (0) **`Authorization: KakaoAK ${ADMIN_KEY}` 헤더 검증**(핵심 — 비밀값을 모르면 통과 불가) → (1) `app_id` 검증 → (2) **Kakao Admin Key로 해당 user의 연결 상태를 재조회**(반환 id가 대상과 일치하는지 echo 확인)해 실제로 끊겼는지 확정한 뒤에만 삭제. 확정 불가하면 **삭제하지 않고 보류**.
- 처리 = provider count 확인 후 분기(아래). idempotency 필수.

### 5-2. 구현 방향

- Kakao Developers 콘솔: 카카오 로그인 > 연결 끊기 알림(콜백) URL 등록 + Web 플랫폼 등록.
- `supabase/functions/kakao-unlink-webhook`(service_role):
  - `app_id`/`user_id`(카카오 회원번호)/`referrer_type` 파싱 → `app_id` 검증.
  - (위조 방어) Admin Key로 user 연결 상태 재조회 → 실제 끊김 확인. 확정 불가 시 보류.
  - `user_id` → `auth_provider_links`(provider='kakao')로 우리 user_id 매핑.
  - **provider count 분기**: 남은 provider 조회 → kakao만 있으면 `_shared/deleteUserData.deleteUserCompletely`, 다른 provider(apple/google)가 있으면 **kakao 매핑만 삭제 + user 보존**.
  - idempotency: 이미 삭제/매핑 없음이면 200 OK.
  - 3초 내 200 OK.

### 5-3. 주의 / 엣지케이스

- **검증 수단(Admin Key 재조회 등)이 구현 시 확정되지 않으면 user 삭제를 보류** — 서명 없는 웹훅만으로 삭제 금지. 정확한 콜백 규격은 구현 직전 Kakao Developers 최신 문서로 재확인.
- 빠른 응답 기대(3초) → 동기 처리(큐 미도입).
- Kakao provider-level rate limit은 10-3에서 선반영됨(추가 작업 없음).
- Apple S2S / Google RISC는 제외(ADR-078).

---

## 6. 익명→회원 충돌 (conflict-pending 유지)

### 6-1. 결정

- 현재 `conflict-pending` + OS destructive Alert 동작 유지(UI-POLISH §8).
- merge(keep_both) 및 발동률 영속 로깅 **미도입**(ADR-080 — ADR-060 종결). **Alert 문구 점검만**.

### 6-2. 구현 방향 (점검)

- `apps/mobile/src/app/auth.tsx` conflict Alert 문구가 "기존 계정으로 로그인하면 **이 기기에서 작성한 내용이 사라지고 되돌릴 수 없음** + 취소하면 보존됨"을 명확히 전달하는지 확인/보강. "로그인" 버튼 `style: 'destructive'` 유지.

### 6-3. 근거 (안 만든 이유)

- conflict는 정의상 "기존 계정 보유자"에게만 발생(linkIdentity 실패 = 이미 가입).
- 현재 선택권 동작이 "신경 안 쓰면 로그인 / 중요하면 취소"로 두 케이스 커버.
- 사진 게이트로 익명 손실 데이터가 저민감 데이터로 축소.
- 드문 반례(예전 계정 잊고 익명으로 새 이사 준비)는 merge가 아니라 Alert 문구 명확성으로 커버.

---

## 7. RLS CI

### 7-1. 결정

- 기존 수동 `scripts/verify/rls-smoke.ts`를 GitHub Actions에 연결.
- 실행 DB = **임시 Supabase local stack**(dev=prod라 실제 DB 사용 불가).
- **PR required status check**(통과 못 하면 머지 차단).
- ⚠️ **CI 범위는 DB RLS 격리 테스트로 제한**. Supabase Cron / Vault / pg_net / Apple revoke / Kakao 웹훅 같은 외부·확장 요소의 실동작은 CI 필수 검증에서 **제외**(별도 manual smoke). CI에서 전부 재현하면 불안정해짐.

### 7-2. 구현 방향

- `.github/workflows/rls-ci.yml`: PR open/push → `supabase start`(Docker) → 마이그레이션 적용 → `rls-smoke.ts` → 실패 시 non-zero exit.
- 브랜치 보호 규칙에 required check 등록.
- 테스트 유저 A/B: 로컬 익명 세션 또는 service_role 생성.
- **검증 대상**: users/moves/checklist/photos RLS 격리, `auth_provider_links` 직접 접근 차단(`apple_refresh_token` 포함), `rate_limit_log` 차단, Storage 정책 기본 격리.

### 7-3. 주의

- 스키마 변경(§4 컬럼) 후 진행해 그 격리까지 검증.
- local stack 부팅 시간(수십초~1분). GitHub Actions cron 지연 이슈와 무관(PR 이벤트 트리거).

---

## 8. 콘솔 / 법무 (운영 체크리스트)

> 결정거리 없음. **App Store Connect 앱 생성은 가장 먼저 착수**(TestFlight·심사 리드타임).

- **App Store Connect 앱 생성**: Bundle ID(`com.isakok.app`), 이름/카테고리/등급, 스크린샷, 지원 URL, 개인정보처리방침 URL(`isakok.vercel.app/privacy`). **App Privacy** = §3-1 인벤토리(10-3), Tracking = None.
- **EAS iOS production 빌드 + Submit** → **TestFlight Internal**(본인 폰 검증, 베타 심사 없음).
- **Data Safety(Google Play 콘솔)**: §3-1 인벤토리 반영.
- **제3자 OSS 고지**: 설정 메뉴 "오픈소스 라이선스" + `license-checker`류 자동 생성 → 정적 페이지(`/oss-licenses`). **apps/web + apps/mobile + packages/shared 전체** 의존성 포함(출시 앱 번들 항목 중심, devDependencies 제외 판단).

---

## 9. 마이그레이션 정리

- **신규**: `auth_provider_links.apple_refresh_token` 컬럼(service_role only, pgsodium 불요) (예: `00021_apple_refresh_token.sql`).
- **공통**: `_shared/deleteUserData.ts`(Edge Function 공통 모듈, 마이그레이션 아님).
- **cleanup**: Edge Function(`cleanup`) + Supabase Cron 스케줄(대시보드 또는 마이그레이션 + `pg_net`).
- **충돌(§6)**: 신규 DB 없음.
- 신규 마이그레이션 prod 적용.

---

## 10. ADR (DECISIONS.md 복붙용)

### ADR-076: 익명 cleanup = Supabase Cron + Edge Function + Vault

- 결정: 익명 user 파기 + 휴지통 30일 + orphan 청소를 단일 cleanup Edge Function이 처리. 스케줄은 **Supabase Cron**(pg_cron + pg_net), 호출 토큰은 **Vault**.
- 이유: cleanup은 DB/Storage 삭제(데이터 작업)라 데이터 플랫폼에 가까운 Supabase Cron이 관심사 일치 + 호출 토큰 외부 노출 0(Vault). 약관 §3-5 보유/파기 정책을 코드로 이행. 조건은 약관 "+" 표현 그대로 AND.
- 보완: 익명 기준 고정(last_activity_at = greatest(last_sign_in_at, max updated_at들); 이사일 도래 = 모든 active move.moving_date < current_date). orphan 삭제는 DRY_RUN으로 첫 검증 후 EXECUTE. 매 실행 structured log.
- 대안: GitHub Actions cron(기존 백업 패턴 일관) — 호출 토큰 외부 보관 + 관심사 분리라 미채택.

### ADR-077: Apple token revoke — refresh_token은 service_role only 컬럼에 보관

- 결정: 로그인 흐름에 authorization code 단계 추가해 Apple refresh_token 수신, `auth_provider_links.apple_refresh_token`에 **service_role only 컬럼**으로 저장(클라이언트 접근 불가, Edge Function만 읽음). `delete-account`에서 client_secret JWT + refresh_token으로 revoke를 best-effort 호출(5s). `.p8`는 Edge Function secret. token exchange 실패 시 로그인 성공 유지 + 재시도 + 로깅.
- 이유: per-user OAuth 토큰은 DB + service_role only RLS가 표준. **pgsodium TCE는 신규 도입하지 않음** — Supabase가 pgsodium 신규 사용을 비권장(deprecation 예정)하고 TCE는 운영 복잡도·오설정 위험이 높으며, Supabase는 기본 at-rest 암호화를 제공하므로 service_role only로 충분. (초안에서 pgsodium TCE를 검토했으나 Supabase 공식 비권장 확인 후 철회.)
- Follow-up: client_secret JWT 캐시, `.p8` key rotation, Apple S2S notification(ADR-078).

### ADR-078: provider 역방향 통지는 Kakao 웹훅만 구현

- 결정: 역방향 연결 해제 통지는 **Kakao 연결 끊기 웹훅만** 구현. Apple S2S Notification / Google RISC는 제외, lazy detection(다음 로그인 시 invalid 처리).
- 검증 방식 (정정): Kakao 연결 끊기 웹훅은 **HMAC 서명이 없고 GET + 쿼리 파라미터**(app_id, user_id, referrer_type)로 오며 3초 내 200 OK 요구. 서명이 없으므로 app_id 검증 + **Admin Key로 user 연결 상태 재조회** 후에만 삭제, 확정 불가 시 보류(서명 없는 웹훅만으로 삭제 금지). provider count 확인 후 전체 삭제/매핑 제거 분기. (초안의 'HMAC 서명 검증'은 Kakao 실제 규격과 달라 정정.)
- 이유: 세 provider 모두 역방향 메커니즘이 있으나 한국 인디 서비스 규모에선 Kakao 웹훅만이 표준. Apple S2S·Google RISC는 글로벌 중대형 패턴이라 1인 일정 대비 ROI 낮음.
- Follow-up: 1000+ MAU 시 Apple S2S 재검토. 콜백 규격은 구현 직전 Kakao 최신 문서 재확인.

### ADR-079: 네이티브 미디어 입력 — 네이티브 직접 Storage 업로드 + 웹 DB INSERT

- 결정: 카메라·갤러리 모두 `expo-image-picker`로 통일(웹 `<input>` 제거). 사진 파일은 **네이티브가 Storage에 직접 업로드**(EXIF·해시 네이티브 추출), 메타데이터만 WebView로 전달해 **웹이 DB INSERT**. 파일은 WebView 미통과.
- 이유: 하이브리드 앱에서 파일을 WebView로 통과시키는 것(base64/file:// URI)은 메모리·안정성·iOS WKWebView 제약으로 함정이 많음 → 네이티브 직접 업로드가 표준. DB 작업을 웹에 모으는 건 책임 분리(네이티브=미디어, 웹=DB)와 기존 코드 재사용에 부합. iOS PHPicker로 사진 라이브러리 권한 자체가 불필요해져 Privacy 개선.
- 보완: native user.id와 WebView user.id 일치 검증(broadcast race 방어) 후 INSERT. 업로드 전 리사이즈+압축(ADR-083). 다중 선택 부분 실패는 성공분 저장 + 실패 안내.
- 약점: Storage 성공 + 웹 INSERT 실패 시 orphan → cleanup(ADR-076)의 orphan 청소로 사후 정리(eventual consistency).

### ADR-080: 익명→회원 충돌은 conflict-pending 동작 유지, merge/로깅 미도입

- 결정: 현재 `conflict-pending` + OS destructive Alert 동작 확정 유지. merge(keep_both)와 발동률 영속 로깅은 만들지 않음. Alert 문구 명확성만 점검. (ADR-060 종결.)
- 이유: conflict는 정의상 기존 계정 보유자에게만 발생하고, 현재 선택권 다이얼로그가 두 케이스를 이미 커버. 사진 게이트로 익명 손실 데이터가 저민감 데이터로 축소. 드문 반례는 merge가 아니라 Alert 문구 명확성으로 커버. 발동률 데이터 없이 merge 충돌 규칙·선택 UI를 짓는 건 오버엔지니어링.
- 대안: merge 풀 구현 — 발동률 측정 후 빈번할 때만 정당. 현재 미도입.

### ADR-081: RLS CI — rls-smoke를 GitHub Actions PR required check로

- 결정: 수동 `rls-smoke.ts`를 GitHub Actions에 연결. 실행은 임시 Supabase local stack(dev=prod라 실제 DB 사용 불가). PR open/push + **required status check**(통과 못 하면 머지 차단). **CI 범위는 DB RLS 격리 테스트로 제한** — Cron/Vault/pg_net/Apple revoke/Kakao 웹훅 실동작은 CI 필수에서 제외(별도 manual smoke).
- 이유: RLS는 깨지면 개인정보(주소·사진) 유출로 이어지는 치명적 보안 경계라, 마이그레이션 변경에 의한 격리 회귀를 수동 검증에 의존하지 않고 CI로 자동 차단. CI required check는 표준 기본기, RLS 격리 자동 테스트는 그 위 모범 사례. 외부·확장 요소까지 CI에서 재현하면 불안정해지므로 범위 제한.
- Follow-up: `auth_provider_links.apple_refresh_token` 격리도 rls-smoke에 포함.

### ADR-082: 사용자 삭제 로직은 `_shared/deleteUserData.ts`로 통합

- 결정: delete-account / cleanup / kakao-unlink-webhook이 삭제 로직을 중복 구현하지 않고 `supabase/functions/_shared/deleteUserData.ts`(`deleteUserCompletely` 등)를 재사용.
- 이유: 세 경로가 같은 삭제(Storage prefix 정리·chunk retry·protect_delete 대응·auth_provider_links 삭제·사후 검증)를 수행하므로, 중복 구현 시 세 곳이 서로 다른 삭제 로직으로 갈라져 누락/불일치 위험. 단일 코어로 유지보수성·일관성 확보(DRY).

### ADR-083: 사진 업로드 = 네이티브 리사이즈+압축 (무료 티어 스토리지 우선, 초안 "무압축" 정정)

- 결정: 네이티브 업로드 시 **긴 변 1920px 다운스케일 + WebP 80% 압축(JPEG 폴백)** → 장당 ~300KB로 저장. §2-3 초안과 ADR-079의 "원본 보존·압축 안 함"을 **정정**. 촬영일시(taken_at)는 압축 전 EXIF에서 추출해 DB 보존, `image_hash`는 압축본 SHA-256.
- 배경: §2 초안은 증거력 위해 무압축(quality 1) → 장당 3~5MB. Supabase Free 1GB + dev=prod(ADR-075)에서 사용자당 ~30장이면 **~8명**에 한도 도달 → 사실상 Pro 강제. 6단계 웹은 원래 리사이즈(1920px/WebP 80%, ~300KB)였고 그 설정이 **~110명** 수용.
- 근거:
  - 증거력 핵심은 **촬영일시 + 시각적 식별성 + 무결성**: taken_at는 DB 보존, 1920px/80%면 방 상태(흠집·곰팡이·얼룩) 식별 충분, SHA-256은 저장본 무결성 증명. 리사이즈가 줄이는 "원본 해상도"는 분쟁 기록 용도엔 과잉.
  - 대안 비교: 원본+압축썸네일 병행·Supabase 이미지 변환은 **원본을 그대로 저장**해 정작 스토리지를 못 줄임(변환은 대역폭만 + Pro 전용) → 무료 티어 목표에 역효과. 스토리지 백엔드 교체(R2 등)는 인프라 추가라 스코프 외(향후 레버).
  - WebP 우선 + JPEG 폴백 → iOS WebP 인코딩 미지원 시에도 업로드 실패 방지.
- 트레이드오프: 파일 내 부가 EXIF(GPS·기기모델) 손실 + 재인코딩 — 분쟁 기록 수준에선 수용. 법적 포렌식급 원본이 필요해지면 유료 전환 후 원본 병행(10-5+) 재검토.
- 구현: `expo-image-manipulator` 컨텍스트 API(`manipulate().resize().renderAsync().saveAsync()`). taken_at은 picker EXIF에서 압축 전 추출.

---

## 11. 완료 확인 체크리스트

### Phase A — 스키마/공통

- [ ] `auth_provider_links.apple_refresh_token` 컬럼 (service_role only, pgsodium 불요)
- [ ] `_shared/deleteUserData.ts` 삭제 코어 (delete-account/cleanup/kakao 재사용)
- [ ] 마이그레이션 prod 적용

### §1 사진 게이트

- [ ] `PhotoUploadFab` onClick `is_anonymous` 분기
- [ ] 익명 → `REQUEST_LOGIN` 로그인 시트 (파일 선택 전)
- [ ] 회원 → 미디어 피커 진입
- [ ] 사진 탭 진입·기존 사진 보기는 익명 허용 (본인 auth.uid() 한정)
- [ ] 계정 삭제 후 새 anon user.id에서 이전 사진 미표시 검증
- [ ] 로그인 성공 후 linkIdentity → 데이터 승계 → 업로드 재시도
- [ ] 6단계 `console.log('TODO: 가입 유도')` 제거

### §2 네이티브 미디어

- [ ] 브릿지 `OPEN_MEDIA_PICKER`(moveId/room/photoType 포함) / `MEDIA_UPLOADED`
- [ ] 네이티브 카메라/갤러리 (expo-image-picker)
- [ ] EXIF·SHA-256 네이티브 추출
- [ ] 네이티브 Storage 직접 업로드(ADR-057 경로)
- [ ] native/WebView user.id 일치 검증 → 불일치 시 AUTH_SESSION 재주입
- [ ] 웹 DB INSERT (useUploadPhoto DB 부분 재사용, Storage 부분 제거)
- [ ] 리사이즈+압축 (긴 변 1920px / WebP 80% / JPEG 폴백, ADR-083) — 장당 ~300KB, taken_at은 압축 전 추출
- [ ] iOS `NSPhotoLibraryUsageDescription` 제거 / `NSCameraUsageDescription` 유지
- [ ] 웹 `<input capture>` / `<input multiple>` 제거
- [ ] 다중 선택 부분 실패 toast + 재시도

### §3 cleanup

- [ ] `cleanup` Edge Function: 익명 user(last_activity_at 30일 AND 모든 active move.moving_date 도래) + 휴지통 30일 + orphan 24h
- [ ] `_shared/deleteUserData` 재사용
- [ ] DRY_RUN 모드 + structured 실행 로그
- [ ] Supabase Cron 스케줄 + Vault 토큰 + pg_net
- [ ] 회원 미대상 확인

### §4 Apple revoke

- [ ] AppleProvider authorization code 수신
- [ ] `apple-token-exchange` (client_secret JWT ES256, code 교환, refresh_token service_role only 저장)
- [ ] token exchange 실패 시 로그인 성공 유지 + 재시도 + 로깅
- [ ] delete-account에서 revoke 호출 (best-effort 5s, invalid_grant 무시)
- [ ] `.p8` Edge Function secret + rotation 기준

### §5 Kakao 웹훅

- [ ] Kakao 콘솔 연결 끊기 콜백 URL + Web 플랫폼 등록
- [ ] GET app_id/user_id/referrer_type 파싱 + app_id 검증 + Admin Key 연결 상태 재조회 (서명 없음)
- [ ] 검증 확정 불가 시 삭제 보류
- [ ] provider count 분기 → kakao만이면 `deleteUserCompletely`, 아니면 매핑만 제거
- [ ] idempotency + 3초 내 200 OK

### §6 충돌

- [ ] auth.tsx Alert 문구 점검("사라짐+되돌릴 수 없음+취소 시 보존")
- [ ] destructive 스타일 유지

### §7 RLS CI

- [ ] `.github/workflows/rls-ci.yml` (local stack + 마이그레이션 + rls-smoke)
- [ ] PR required check 등록
- [ ] CI 범위 = DB RLS 격리만 (Cron/Vault/외부 provider 실동작 제외)
- [ ] `auth_provider_links`(apple_refresh_token 포함) 격리 테스트

### §8 콘솔/법무

- [ ] App Store Connect 앱 생성 + App Privacy(Tracking None)
- [ ] EAS iOS production 빌드 + Submit + TestFlight Internal 본인 폰 검증
- [ ] Data Safety(Google) 폼
- [ ] OSS 고지 페이지(`/oss-licenses`, web+mobile+shared)

### 빌드/린트/테스트

- [ ] `pnpm build` / `pnpm lint` / `pnpm test` 통과

---

## 12. 다음 단계 (스펙 외 — 별도 진행)

- **UI/UX 폴리싱** — 다듬기 기간.
- **iOS** — TestFlight External(Beta App Review 1회) 또는 바로 App Store Review 제출(강제 기간 없음, 심사 1~2일~며칠 변동).
- **Android** — 비공개 테스트 14일 충족(~06-12) 시 **프로덕션 승인 먼저 신청**(12명 중 1명만 빠져도 카운트 리셋되는 드롭아웃 리스크 방지). 승인은 자격, release는 별도 결정.
- **prod 대중 URL 공개** (release-gate, ADR-061).

---

## 13. 면접 대비 핵심 포인트

- **"cleanup을 왜 Supabase Cron으로?"** — 데이터 정리는 데이터 플랫폼에 가까운 게 관심사 일치 + 호출 토큰을 외부로 안 내보내고 Vault에 격리. 트레이드오프(운영 가시성 통합 vs 관심사 일치)를 따져 후자 선택.
- **"OAuth refresh_token을 왜 평문 컬럼에?"** — per-user 토큰은 DB + service_role only RLS가 표준. pgsodium TCE는 Supabase가 신규 사용을 비권장(deprecation)하고 at-rest 암호화가 기본 제공이라 service_role only로 충분. (초안에서 pgsodium을 검토했다가 공식 문서 확인 후 철회 — 외부 리뷰를 근거로 결정을 정정한 사례.)
- **"하이브리드 앱 사진 업로드를 왜 네이티브 직접 + 웹 INSERT?"** — 파일을 WebView로 통과시키는 건 함정. 네이티브 직접 업로드 + 책임 분리(네이티브=미디어, 웹=DB). orphan 약점은 cleanup으로 사후 정리. 추가로 native/web 세션 race를 user.id 일치 검증으로 방어.
- **"Kakao 웹훅을 어떻게 신뢰하나?"** — 연결 끊기 콜백은 서명이 없는 GET이라, 웹훅만으로 삭제하지 않고 Admin Key로 연결 상태를 재조회해 확인한 뒤 삭제. 검증 불가 시 보류.
- **"삭제 로직 중복은?"** — delete-account/cleanup/kakao가 같은 삭제를 하므로 `_shared/deleteUserData.ts` 단일 코어로 통합(DRY).
- **"merge는 왜 안 만들었나?"** — conflict는 기존 계정 보유자에게만 생기고 현재 선택권 다이얼로그가 두 케이스를 커버. 데이터 없이 merge를 짓는 대신 안 만드는 게 맞다고 판단. 안 만든 것도 설계.
- **"RLS를 왜 CI로? 범위는?"** — 보안 경계라 회귀를 수동 검증에 의존하지 않고 required check로 자동 차단. 단 외부·확장 요소(Cron/Vault/외부 provider)까지 CI에 넣으면 불안정해져 범위를 DB RLS 격리로 제한.
- **"공개를 왜 코드 완료와 분리?"** — 코드 완료와 출시(심사·운영·다듬기)는 리스크 성격이 다름. Android 14일은 병렬, iOS는 강제 기간 없어 다듬은 뒤 제출. release-gate 분리(ADR-061)와 일관.
