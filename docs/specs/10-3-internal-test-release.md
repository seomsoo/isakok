# 10-3단계: 계정 삭제 + 약관 + release-gate (내부 테스트 게이트) 스펙 (SDD)

> 목표: **Google Play 내부 테스트 트랙에 AAB를 업로드하고, 실기기(엄마 폰)에서 핵심 플로우(온보딩~집기록~계정삭제)를 검증할 수 있는 상태**를 만든다. ① 계정 삭제, ② 개인정보처리방침·이용약관, ③ prod Supabase 신규 세팅 + Android 릴리스 빌드 + Play Console 내부 트랙.

> **완료 조건**:
>
> - 실기기에서 검증 체크리스트(§8) 통과
> - Google Play **내부 테스트 트랙**에 AAB 업로드 + opt-in 링크 생성
> - 최소 1명(엄마 폰 포함) 실기기에서 설치·핵심 플로우 성공
>
> **정식 출시·prod 대중 URL 공개·폐쇄 테스트(N명/14일 → 프로덕션 접근) 조건은 10-4로 분리한다.**

> **v1 → v2 변경 사항** (1차 리뷰 15건 반영): 내부/폐쇄 테스트 용어 정정, Storage 삭제 prefix 방식, deleteUser 중단 조건, auth_provider_links 명시 삭제, Data Safety/App content 분리, prod/internal URL 분리, WEB_APP_URL env 동기화, 카메라 fallback, 삭제 후 anon id 검증, provider unlink 순서, Kakao 웹훅 10-4 이동, AI 캐시 P1, 복사 허용/금지, 개인정보 표현 보정, 공개 라우트 강화, delete-account rate limit. (보류 #3 익명 삭제 경로.)

> **v2 → v3 변경 사항** (2차 타깃 리뷰 14건 반영, 1건 결정 대기):
>
> - **#1 Storage 경로 수집 — storage.objects 의존 제거** (P0): `.schema('storage').from('objects')`는 PostgREST exposed schema 제약으로 실패 가능. **재귀 Storage API `list()`**(public API, 마이그레이션 0)를 primary로. SECURITY DEFINER RPC는 대안으로 문서화. §2-2.
> - **#2 Storage 삭제 후 잔여 0건 재검증** (P0): chunk remove 1~3회 retry + 삭제 후 prefix 재조회로 잔여 0건 확인 → 0건일 때만 deleteUser. §2-2.
> - **#3 protect_delete 트리거 가정 강화** (P0): Storage API `remove()`에도 걸릴 수 있다고 **가정**(우회 단정 금지) + 대응책(A 트리거 예외 / B 삭제 전용 RPC / C 트리거 조건 재설계) + 해결 전 완료 금지. §2-2.
> - **#4 idempotency vs JWT-삭제-후-401 분리** (P0): 서버 idempotency는 유효 JWT일 때만. 클라는 네트워크오류/401 시 세션 정리 + 익명 복구. (delete_requests 테이블은 오버엔지니어링이라 미도입.) §2-2.
> - **#5 internal 웹 배포 = prod Supabase 빌드** (P0): URL만 internal이고 dev로 빌드되면 세션 주입 깨짐. `VITE_SUPABASE_URL`/`ANON_KEY`도 prod + `setSession`→`getUser().id=A` smoke. §4-6.
> - **#6 stable alias** (P0): `EXPO_PUBLIC_WEB_APP_URL`은 AAB에 박히므로 ephemeral Preview URL 금지 → 고정 alias. §4-6.
> - **#7 revoke 실패 상태 정의 + timeout** (P0): 5s timeout, 실패는 warn(provider/errorCode만, PII 금지), 삭제 유지, UI 안내. §2-3.
> - **#8 카메라 통과 기준** (P0): 갤러리 1경로라도 되면 진행 / 카메라 직접 촬영 실패는 10-5 defer / 사진 0경로면 10-3 실패. §5-2.
> - **#9 Play 서명 SHA vs dev/직접설치 SHA 구분** (P0): §5-3.
> - **#10 Google OAuth 실패 점검 순서** (P0): 패키지명·SHA·clientId·Play서명본·전파지연(5~30분). §5-3.
> - **#11 partial cleanup 상태 명시** (P1): links 삭제 후 deleteUser 실패 시 + 재시도. §2-2.
> - **#12 삭제 전/후 row count** (P1): 후속은 service_role. §2-2/§8.
> - **#13 internal URL을 CORS/Auth/Kakao/Google allowed에 추가** (P1): §4-5/§4-6.
> - **#15 CAMERA 권한 실기기 기준** (P1): §5-2.
> - **결정 대기 #3 익명 데이터 삭제 경로**: 1차·2차 리뷰 모두 "추가" 추천. v3는 회원 전용 유지, 각하 최종 결정 대기. §2-1.

> **v3 → v3.1 변경 사항** (사진 저장 게이트 결정):
>
> - **사진 저장 = 로그인 회원 전용 확정** (ADR-074): 비회원은 앱 전체를 쓰되 "사진 저장(서버 업로드)"만 게이트(저장 시점, 가치 노출 후). 소프트 넛지+IndexedDB 로컬 모델(DECISIONS §3-2) 대체. Apple 5.1.1(v) "계정 종속 기능(저장)엔 가입 요구 허용" 근거로 정책 적합. §7.
> - **결정 #3 = 회원 전용 확정**: 게이트로 익명 서버 사진이 0이 되므로 계정 삭제 회원 전용이 정합. 익명 직접 삭제 경로 미추가. §2-1.
> - **개인정보처리방침 인벤토리**: 게이트 적용 후 익명 서버 사진 없음(장기). 적용 전까지는 익명 사진이 서버에 존재(과도기). §3-1.
> - **Follow-up**: 사진 게이트는 공개 출시(10-4/10-5) 전 반드시 켜져 있어야 익명 사진 공백 방지. §9.

> **v3.1 → v4 변경 사항** (구현·검증 단계에서 결정·발견된 사항, 2026-05-26 ~ 2026-05-27):
>
> ### 핵심 결정 — ADR-075 dev=prod 단일 프로젝트
>
> - **§4-1 prod Supabase 신규 생성 → 미실시 (ADR-075)**: Supabase Free tier가 owner 계정 기준 활성 2개 한도(`seomsoo (Limit: 2 free projects)`)인데 이미 dev(isakok) + 다른 1개 활성. 새 free org 만들어도 같은 계정 owner라 동일 카운트. Pro $25/mo는 수익화 불확실한 1차 출시엔 부담. 1인 인디 + 12명 internal 단계의 dev/prod 분리 폭발 반경 작음.
> - **결정**: 기존 dev 프로젝트(`ybcqinanfcarhqkclvue`, Seoul)를 그대로 prod로 사용. `§4-2 마이그레이션·§4-3 secrets·§4-4 Edge Functions 배포·§4-7 RLS smoke`는 dev에서 이미 완료된 상태 그대로 활용.
> - **분리 트리거 정의** (다음 중 도달 시 Pro upgrade + 분리 검토): (1) 10-4 폐쇄 테스트 시작 직전 (2) DB 사용량 free 한도 50% (3) MAU 1000+ (4) 데이터 손상 가능성 있는 변경 필요 시.
> - **ADR-046/051 대체 표시**: DECISIONS.md에 "ADR-075로 대체" 한 줄씩 추가.
>
> ### 안전 게이트 (dev→prod 하드닝 — 다른 Claude 인계 분석 반영)
>
> dev=prod 결정과 함께 즉시 수행한 8개 게이트:
>
> 1. **마지막 클린 와이프 + `scripts/dev-wipe.sql` 삭제** (1순위) — project-ref 가드가 이제 prod를 가리켜 "장전된 총". service_role 직접 호출로 Storage 48 paths + auth.users 22명 + rate_limit_log 16건 cleanup. 보존: master_checklist_items 46, ai_guide_cache 4, system_config 1.
> 2. **자동 백업 워크플로우 신설** (2순위, `.github/workflows/db-backup.yml`) — Free tier는 자동 백업 없음. pg_dump → `actions/upload-artifact@v7` 90일 retention. cron KST 03:00 + workflow_dispatch. GitHub Secret `SUPABASE_DB_URL`. 실행 검증은 PR 머지 후 (workflow_dispatch는 default branch 필수).
> 3. **Supabase Legacy JWT-based API keys disable** + 새 publishable/secret 체계 전환 — git history 17건 + chat 노출분 모두 무효. `sb_publishable_Xl24...`로 client `.env` 3개(`/.env.local`, `apps/web/.env.local`, `apps/mobile/.env`) 갱신. supabase-js 2.106.1 호환 확인 (RLS smoke 16/16).
> 4. **kakao-token-exchange 에러 응답 트리밍** — `errorResponse(500, err.message)` 식 server 내부 정보 노출 제거. client는 일반 코드(`'KAKAO_USER_UPDATE_FAILED'`/`'KAKAO_LINK_FAILED'`/`'KAKAO_LOGIN_FAILED'`), server는 `console.error` 상세. delete-account도 동일 패턴.
> 5. **gitleaks 히스토리 전수 스캔** — `gitleaks detect --log-opts="--all"` 290 commits → 17건 누출 (3개 commit). rotation으로 무력화. **git filter-repo 정리는 Task #21 (PR 머지 후 작업 마지막)**.
> 6. **OAuth provider 콘솔 internal URL 등록** — Google Cloud Web Client + Supabase Auth URL Configuration에 `https://isakok.vercel.app` 등록. Edge Function CORS는 이미 ALLOWED_ORIGINS에 포함. Kakao 콘솔 web 등록은 native flow라 skip(10-4 Kakao 웹훅 단계에서). Apple은 native flow라 콘솔 작업 없음.
> 7. **internal Vercel 배포** — 기존 production Vercel을 internal alias로 사용 (dev=prod). 고정 alias `isakok.vercel.app`로 스펙 §4-6 stable alias 요구 충족. `VITE_SUPABASE_ANON_KEY` → publishable로 redeploy.
> 8. **EAS Secrets production scope 7개 등록** (Expo dashboard 웹 UI) — ADR-055 정신("eas.json env block 금지") 일관. WEB_APP_URL/SUPABASE_URL/ANON_KEY publishable/Google iOS/Android/Web client IDs/Kakao native app key. `apps/mobile/.env`는 dev LAN URL 그대로.
>
> ### 코드 변경 (스펙 본문 보강)
>
> - **§2-2 delete-account import** — `'jsr:@supabase/supabase-js@2'` → `'npm:@supabase/supabase-js@2'`. Edge Runtime의 jsr admin SDK 회귀 회피.
> - **§2-2 kakao-token-exchange Kakao placeholder 이메일** — `kakao_${kakaoId}@isakok.invalid` 고정 → `kakao_${kakaoId}_${anonymousUserId}@isakok.invalid` 고유값. 옛 orphan user의 placeholder 점유로 인한 409 email duplicate 방지.
> - **§2-2 kakao-token-exchange `updateUserById` 호출** — admin SDK 대신 raw `fetch`로 `PUT /auth/v1/admin/users/{id}` 직접 호출 (apikey + Bearer service_role). Supabase Edge Runtime의 admin SDK `unexpected_failure` 회귀 우회.
> - **§2-2 kakao-token-exchange `app_metadata`** — `{ provider: 'kakao', providers: ['kakao'] }` — providers 배열 추가 (새 GoTrue 형식).
> - **§2-3 mobile AuthService 409 처리** — 더 이상 conflict=true 성공처럼 처리 안 함. 명확한 에러("이미 다른 계정에 연결된 카카오 계정이에요").
> - **§5-2 Android CAMERA 권한** — `app.config.ts`의 `android.permissions: ['CAMERA']` 추가. WebView `<input accept="image/*" capture>`가 카메라 띄울 수 있게.
> - **eas.json production profile 보강** — `extends: 'base'` + `android.buildType: 'app-bundle'` + `autoIncrement: true` + `cli.appVersionSource: 'remote'` (versionCode EAS 서버 관리).
>
> ### 검증 결과 (실측, 스펙 §8 매트릭스)
>
> 3 provider(Apple/Kakao/Google)로 핵심 흐름 실측 완료:
>
> | 항목                                                              |              Apple               |         Kakao          |            Google            |
> | ----------------------------------------------------------------- | :------------------------------: | :--------------------: | :--------------------------: |
> | 로그인 → 사진 업로드(선택) → 계정 삭제 → onboarding 복귀          |                ✅                |   ✅ (Codex fix 후)    |              ✅              |
> | Edge Function `OK` + `removed_paths=N`                            |           ✅ (paths=2)           |           ✅           |              ✅              |
> | **§2-2 #3 `protect_delete` 트리거가 Storage `remove()`를 막는지** | ✅ **우회 성공 (대응책 불필요)** |           —            |              —               |
> | `auth_provider_links` CASCADE 정리                                |               N/A                |           ✅           |              ✅              |
> | `auth.admin.deleteUser` + public.\* CASCADE                       |                ✅                |           ✅           |              ✅              |
> | 새 anon id 발급 + AUTH_SESSION broadcast                          |                ✅                |           ✅           |              ✅              |
> | **revoke 동작** (warn 로그 유무)                                  |       N/A (10-4 deferred)        | **✅** `unlink()` 성공 | **✅** `revokeAccess()` 성공 |
> | JWT 없음 → Gateway 401                                            |            ✅ (curl)             |         (동일)         |            (동일)            |
> | anonymous → 403 가드                                              |         ✅ (코드 review)         |           —            |              —               |
>
> - 자동 검증: `scripts/verify/rls-smoke.ts` — 새 publishable key로 **16/16 통과** (A/B 격리, 공개 테이블, ai_guide_cache 차단, users UPDATE 차단, Storage signed URL 격리).
> - 미검증/deferred: Apple revoke(10-4), rate limit 429(P1, 같은 user JWT로 4회 호출 불가).
>
> ### Codex 인계 — Kakao 로그인 non-2xx 디버깅
>
> Apple 삭제 후 Kakao 시도 시 `status=500 / unexpected_failure`. 진단·수정을 Codex에게 인계.
>
> - **1차 원인**: Edge Runtime의 `jsr:@supabase/supabase-js@2`에서 `admin.auth.admin.updateUserById()`가 `unexpected_failure`. 같은 호출이 Node script로는 정상 (5가지 payload 격리 시도 모두 OK) → Edge Function 환경 회귀.
> - **2차 원인**: 옛 orphan auth user가 고정 placeholder 이메일 점유 → 409 email duplicate. UI의 "홈으로 돌아가기"는 conflict=true 처리지 진짜 성공이 아니었음.
> - **Codex 수정**: 위 "코드 변경" 4개 항목 (npm import + raw fetch + 고유 placeholder + providers 배열). 임시 디버그 `[KakaoExchange:DEBUG]` console.error 제거.
> - **검증**: Codex fix 후 6회 Kakao 시도 모두 통과(rate_limit_log count=1). `d46fda66` user 정상 anon=false 전환 + `auth_provider_links`에 (kakao, 4905562841) 매핑.
>
> ### 추가 ADR 후보 (DECISIONS.md 반영 필요)
>
> - **ADR-075**: dev=prod 단일 프로젝트 — Free 제약 + 분리 트리거 (이미 DECISIONS.md 등재 완료, ADR-046/051은 "ADR-075로 대체" 표시)
> - **ADR-066~074**: 스펙 §7에 정의된 항목들 — DECISIONS.md 등재는 PR 머지 시점에 일괄 (Task로 분리)
>
> ### 잔재 / Follow-up
>
> - **git filter-repo + branch 정리**는 작업 마지막(Task #21, PR 머지 직후). 노출 키는 rotation으로 이미 무효.
> - **자동 백업 워크플로우 첫 실행 검증**은 PR 머지 후 (workflow_dispatch default branch 필수).
> - **Kakao 콘솔 web 등록**, **Apple token revoke**, **Kakao 웹훅** 모두 10-4 deferred.
> - **사진 저장 회원 전용 게이트(ADR-074)**는 10-5+ 구현. 그전엔 익명 사진이 서버에 쌓일 수 있음.
> - **익명 cleanup cron** (30일 미활동 + 이사 일정 도래) 미구현.
> - **service_role 새 secret 발급** (현재 chat 노출된 `sb_secret_WCA2r...` 그대로 사용 — Legacy disable로 옛 service_role JWT는 무효. 보안 강박 시 dashboard에서 "+ New secret key" 후 옛 secret disable).
> - **Custom domain** 미구매 — `isakok.vercel.app` 사용. WebView 앱이라 ROI 낮음, 10-4 시점 재검토.

---

## 0. 들어가기 전 (전제)

### 0-1. 10-2에서 넘어온 상태

- RLS 활성화 완료(6 테이블 + `auth_provider_links`), Edge Function 보안(JWT/CORS/rate limit), Storage `{userId}/{moveId}/...` 경로, `migrate_anonymous_to_user` contract(`keep_target` no-op).
- **prod Supabase 미생성**(ADR-046). production Vercel은 dev Supabase에 임시 연결(ADR-051).
- `auth.users` 삭제 시 `public.users` → 하위 4개 테이블 FK `ON DELETE CASCADE`. **단 Storage objects는 CASCADE 안 됨.**
- `delete-account` 미구현. `AuthProvider.unlink?()` 시그니처만 존재. Kakao 연결 해제 웹훅 미설정.
- 약관 = placeholder URL.
- **Android**: 에뮬레이터 로딩만 확인. 실기기·릴리스 빌드·카메라 미검증.
- **iOS**: 본인 아이폰 실제 앱(WKWebView)에서 카메라·갤러리 검증됨.
- Google Play 개발자 계정: 등록/인증 완료.

### 0-2. 내부 테스트 트랙 vs 폐쇄 테스트 (용어 정리)

- **내부 테스트 트랙**: 빠른 QA용. 테스터 등록(최대 100명)만 하면 즉시 배포. **N명/14일 조건 없음.** ← 10-3 목표.
- **폐쇄 테스트**: 신규 개인 개발자 계정이 **프로덕션 접근 신청** 시 일정 인원·기간(N명/14일 연속 opt-in) 충족 필요. ← 10-4. _(정확한 인원/일수는 정책 변동 가능 → 10-4 진입 시 재확인.)_
- "엄마 폰 + 지인 12명"은 내부 테스트 트랙으로 충분.

### 0-3. 범위 분할 (확정)

- **10-3** = ① 계정 삭제 + ② 약관 + ③ release-gate.
- **10-4** = 폐쇄 테스트(N명/14일)→프로덕션 접근, Data Safety 폼, Apple 토큰 revoke, Kakao 연결 해제 웹훅, Kakao rate limit 하드닝, prod 대중 URL 공개, iOS TestFlight, 제3자 OSS 고지.
- **10-5+** = 가입 유도 CTA, 네이티브 카메라(expo-image-picker), migrate 본구현, RLS CI.

---

## 1. 하는 것 / 안 하는 것

### 하는 것

- **(①) 계정 삭제**: `delete-account` Edge Function(service_role) + 설정 UI + 확인 다이얼로그 + 삭제 후 익명 세션 복귀. Kakao `unlink()` + Google `revokeAccess()` best-effort.
- **(②) 약관**: 개인정보처리방침 + 이용약관, Vercel 공개 라우트 `/privacy`·`/terms`, 설정 링크 교체.
- **(③-a) prod Supabase**: Seoul + 마이그레이션 + seed + secrets + Edge Functions 배포 + OAuth provider 재설정 + 환경변수 스위치(internal 배포 + native) + prod RLS smoke.
- **(③-b) Android 릴리스**: production AAB, EAS 미해결 이슈 해결, WebView 카메라 권한, Play App Signing SHA-1 등록.
- **(③-c) Play Console**: 앱 생성 + 최소 App content + 내부 트랙 + 테스터 등록.
- **실기기 검증**(엄마 폰): 카메라·로그인·계정삭제·핵심 플로우.

### 안 하는 것

- 폐쇄 테스트(N명/14일)→프로덕션 접근 / prod 대중 URL 공개 / 공개 production 도메인 prod 스위치 → 10-4.
- Apple 토큰 revoke / Data Safety 폼 / Kakao 연결 해제 웹훅 / Kakao rate limit 하드닝 → 10-4.
- 익명 cleanup 작업 구현(방침엔 명시) → deferred.
- 가입 유도 CTA / 네이티브 카메라 / migrate / RLS CI → 10-5+.

### 우선순위

- **P0**: 계정 삭제 / 약관 / prod·internal 백엔드 세팅 / Android AAB / Play 내부 트랙 / 최소 1명 실기기 핵심 플로우.
- **P1**: AI 캐시 복사(optional) / delete-account rate limit.

---

## 2. 계정 삭제 (①)

### 2-1. 정책

- **즉시 hard delete**(유예기간 없음, UI 확인으로 방어).
- **회원(소셜 연결) 전용** — 설정 "계정 삭제"는 로그인 회원에게만 노출.

> **✅ 결정 #3 — 회원 전용 확정** (ADR-074 연계): 사진 저장을 로그인 회원 전용으로 게이트하기로 결정(ADR-074). 게이트가 적용되면 **익명 사용자의 서버 사진(가장 민감한 데이터)이 0**이 되고, 익명 서버 데이터는 이사정보·체크리스트·메모(저민감)뿐 → cleanup이 정리. 따라서 리뷰가 익명 삭제 추가의 최대 근거로 든 "익명도 사진/EXIF 보유"는 *과도기 구현 공백*이지 정상 상태가 아니므로, **계정 삭제는 회원 전용으로 확정**하고 익명용 별도 삭제 경로는 추가하지 않는다. (익명 사진 프라이버시의 정공법은 삭제 버튼이 아니라 게이트 — §9.)

### 2-2. `delete-account` Edge Function (신규)

`supabase/functions/delete-account/index.ts` — service_role admin client.

**순서 (v3, 엄격):**

```text
1. CORS (resolveCorsOrigin/makeCorsHeaders; 미허용 403, OPTIONS 204, POST 외 405)
2. rate limit (P1): increment_rate_limit(auth.uid() 분당 3회). 초과 429
3. JWT → anon client auth.getUser() → userId. 없음/무효 401
4. (선택) 삭제 전 DB row count 수집 (UX/로그용)
5. Storage path 수집 (재귀 list — 아래)
6. chunk(예: 100) remove + chunk당 1~3회 retry. 최종 실패 시 500 → deleteUser 진행 안 함
7. 삭제 후 prefix 재조회 → 잔여 > 0 이면 500 (deleteUser 진행 안 함)
8. auth_provider_links 명시 삭제 (deleteUser 전; partial cleanup 주의 — 아래)
9. auth.admin.deleteUser(userId) → DB CASCADE 자동
10. (선택) 사후 row count 0 검증 (service_role, user 이미 없음)
11. 200
```

**Storage 경로 수집 (v3 — 재귀 list, storage.objects 비의존):**

```ts
// 경로가 {userId}/{moveId}/{room}_{ts}.{ext} 중첩이므로
// list(userId)는 moveId 폴더만 반환 → 한 단계 더 재귀해야 파일이 나옴.
// public Storage API만 사용 (PostgREST storage schema 노출 불필요).
async function listStoragePathsByPrefix(userId: string): Promise<string[]> {
  const bucket = admin.storage.from('property-photos')
  const out: string[] = []
  const { data: lvl1 } = await bucket.list(userId, { limit: 1000 }) // moveId 폴더들
  for (const entry of lvl1 ?? []) {
    // 폴더(id=null)면 한 단계 더, 파일이면 바로 수집
    if (entry.id === null) {
      const { data: lvl2 } = await bucket.list(`${userId}/${entry.name}`, { limit: 1000 })
      for (const f of lvl2 ?? []) out.push(`${userId}/${entry.name}/${f.name}`)
      // (폴더 내 1000개 초과 시 offset pagination)
    } else {
      out.push(`${userId}/${entry.name}`)
    }
  }
  return out
}
```

```ts
const paths = await listStoragePathsByPrefix(userId)
for (const chunk of chunkArray(paths, 100)) {
  let ok = false
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { error } = await admin.storage.from('property-photos').remove(chunk)
    if (!error) {
      ok = true
      break
    }
    await sleep(300 * attempt)
  }
  if (!ok) return res(500, { stage: 'storage-remove' }) // (#2) 중단
}
const remaining = await listStoragePathsByPrefix(userId)
if (remaining.length > 0) return res(500, { stage: 'storage-verify', remaining: remaining.length })

await admin.from('auth_provider_links').delete().eq('user_id', userId) // (#6/#11)
const { error: delErr } = await admin.auth.admin.deleteUser(userId)
if (delErr) return res(500, { stage: 'delete-user' })
```

> **대안 (반복적으로 필요하면)**: `public.list_storage_paths_by_prefix(bucket, prefix)` SECURITY DEFINER RPC(`SET search_path = public, storage`, `GRANT EXECUTE ... TO service_role`). 단 이건 마이그레이션 1개 추가 → v3는 재귀 list 우선, RPC는 필요 시 승격.

> **⚠️ protect_delete 트리거 (v3 — #3)**: dev-wipe에서 `storage.objects` 직접 DELETE가 트리거에 막혔음. **Storage API `remove()`도 결국 `storage.objects` row를 삭제하므로 같은 트리거에 걸릴 수 있다고 가정**한다(우회된다고 단정 금지). 실측 후 막히면:
>
> - A. 트리거에 service_role / delete-account 함수용 예외 조건 추가
> - B. delete-account 전용 SECURITY DEFINER RPC로 storage object 삭제
> - C. 트리거 목적이 dev-wipe 보호면 prod 계정삭제 경로와 충돌 안 하게 조건 재설계
>
> **해결 전에는 계정 삭제 기능을 완료 처리하지 않는다.**

> **재시도/idempotency (v3 — #4)**: delete-account는 유효 JWT일 때만 서버 idempotency 보장. auth user가 이미 삭제돼 JWT 검증이 실패한 재시도는 서버가 동일 요청으로 식별 불가 → 401 가능. **따라서 클라이언트는** delete-account 중 네트워크오류/401이 나도 **로컬 세션 정리 + `signInAnonymously()`로 복구하는 "삭제 후 복구" 경로**를 제공한다. (서버 측 `delete_requests` 테이블은 1인 프로젝트엔 오버엔지니어링 — 미도입.)

> **partial cleanup (v3 — #11)**: `auth_provider_links` 삭제 성공 후 `deleteUser` 실패 시 — Supabase user는 살아있고 link mapping만 사라진 부분 정리 상태가 됨. 이 상태를 로그로 남기고 사용자가 재시도할 수 있게 한다(재시도는 idempotent하게 동작).

### 2-3. Provider 연결 해제 (v3 — 실패 상태/timeout)

- **Kakao**: 네이티브 `@react-native-seoul/kakao-login` `unlink()`. **Google**: `@react-native-google-signin` `revokeAccess()`. **Apple**: 10-4.

**클라이언트 순서:**

```text
1. delete-account Edge Function 호출 (코어, 반드시 성공)
2. 성공 시 Kakao unlink() / Google revokeAccess() best-effort  ← provider SDK 세션 살아있을 때
3. provider SDK signOut + 네이티브 로컬 세션 정리
4. SecureStore clear
5. signInAnonymously() → 새 익명 세션
6. WebView(들)에 새 AUTH_SESSION broadcast
```

**revoke 실패 정책 (v3 — #7):**

- revoke/unlink에 **timeout(예: 5s)**. 실패/timeout은 **warn 로그만**(provider, errorCode만 — **토큰/이메일/PII 로그 금지**).
- provider SDK signOut · SecureStore clear · 익명 재가입은 revoke 실패와 **무관하게 항상 진행**.
- revoke 실패 시 상태: Supabase user·앱 데이터는 삭제됨 / 소셜 측 앱 연결은 provider에 남을 수 있음 / 같은 provider 재로그인 시 새 익명 user에 다시 연결될 수 있음.
- UI 안내(선택): "앱 데이터는 삭제됐습니다. 소셜 연결 해제는 계정 제공자 설정에서 직접 하실 수 있습니다."

### 2-4. Kakao 연결 해제 웹훅 (역방향) → 10-4

- 10-3 제외. 인앱 삭제 + Kakao `unlink()` best-effort로 사용자 발기 삭제 커버. 웹훅(서명·replay·idempotency·매핑)은 10-4.

### 2-5. UI 플로우

- 설정 > 계정 > "계정 삭제"(회원만) → 안내 화면(무엇이 지워지나 + 되돌릴 수 없음) → 최종 확인 다이얼로그 → 실행. 로딩/실패 toast + §2-2의 "삭제 후 복구" 경로.

### 2-6. 삭제 후 흐름

- §2-3의 4~6. 익명 재발급 → 온보딩. 기존 `AUTH_LOGOUT`/`webSessionListener` 흐름 확장.

### 2-7. 테스트

- §8 참조. JWT 없음 401 / 본인 외 차단 / rate limit 429 / Storage 잔여 0건 검증 / 삭제 후 새 anon id 검증.

---

## 3. 개인정보처리방침 + 이용약관 (②)

### 3-1. 수집 데이터 인벤토리

| 항목                    | 목적           | 보유기간             | 비고                             |
| ----------------------- | -------------- | -------------------- | -------------------------------- |
| 소셜 식별자·이메일      | 본인 식별/인증 | 계정삭제 시까지      | 카카오 placeholder               |
| 이사 정보               | 서비스 제공    | 계정삭제 시까지      | 주소 현재 미수집                 |
| 사진·EXIF 촬영일시·해시 | 집상태 기록    | 계정삭제 시까지      | 원본 EXIF에 GPS 포함 가능 → 고지 |
| 메모                    | 사용자 메모    | 계정삭제 시까지      | AI 미전송                        |
| 익명 식별자·세션        | 디바이스 격리  | 30일 미활동+날짜규칙 | cleanup deferred                 |
| 해시 IP                 | rate limit     | 2일                  | 평문 미저장                      |

- **제3자(처리위탁)**: Supabase(Seoul) · Vercel(웹 호스팅) · Anthropic(AI) · Apple/Kakao/Google(인증).
- **개인정보 처리 표현 (보정)**: "Vercel·Anthropic에는 앱 기능 제공에 필요한 **최소 정보만** 처리." "Anthropic에는 주소·메모·사진·이메일을 전송하지 않고 이사 조건·체크리스트 항목만 전송." "Vercel은 호스팅 과정에서 접속 로그 등 기술 정보가 처리될 수 있음."
- **국외 이전**: Supabase = Seoul(국내). 해외 처리는 위 최소 정보 한정.
- **사진 보유 주체 (ADR-074)**: 사진 저장은 **회원 전용**(서버 업로드). 게이트 적용 후 **익명 사용자는 서버 사진 없음**. 위 표의 "사진" 항목은 회원 기준(보유=계정삭제 시까지). _게이트 적용 전 과도기에는 익명 사진이 서버에 존재할 수 있어, 그 기간엔 30일 미활동 cleanup 대상._

### 3-2. 개인정보처리방침 (하이브리드)

- PIPC "개인정보처리방침 만들기" 도구/작성지침 구조 + §3-1 인벤토리 내용. 필수: 목적/항목/보유기간/제3자제공/처리위탁/국외이전/정보주체 권리/파기/안전성 조치/보호책임자(`usnimoes@gmail.com`)/고지·변경. 만 14세 미만 제한.

### 3-3. 이용약관

- 서비스 설명, 회원 의무, **"정보 제공 목적·법률 자문 아님" 면책**, 책임 제한, 계정/해지, 준거법(대한민국), 변경 고지.

### 3-4. 호스팅 (공개 라우트)

- `/privacy`·`/terms` — 세션 게이트 바깥, 로그인/세션 없이 접근. **브라우저 직접 접근 + Play Console 접근 가능해야 함 → 인증/비공개 금지.** robots noindex는 선택, URL 접근 자체는 공개. 설정 placeholder URL → 실제 경로 교체.

### 3-5. 보유/파기

- 회원: 계정 삭제 시까지 → 즉시 파기. 익명: 30일 미활동 + 날짜규칙 → cleanup(deferred, 방침엔 명시). 해시 IP: 2일.

---

## 4. prod Supabase 신규 세팅 (③-a)

### 4-1. 프로젝트 생성

- 새 Supabase 프로젝트, 리전 **Seoul (ap-northeast-2)**.

### 4-2. 마이그레이션 + seed

```bash
supabase link --project-ref <PROD_REF>
supabase db push                                   # 00001~00020 일괄
psql "$PROD_DATABASE_URL" -f supabase/seed.sql     # master_checklist 46개
```

### 4-3. secrets

```bash
supabase secrets set \
  ANTHROPIC_API_KEY=<key> \
  ANTHROPIC_MODEL=claude-haiku-4-5-20251001 \
  RATE_LIMIT_SALT=$(openssl rand -hex 32) \
  --project-ref <PROD_REF>
```

### 4-4. Edge Functions 배포 + AI 캐시 복사 (P1)

```bash
supabase functions deploy generate-ai-guide kakao-token-exchange delete-account --project-ref <PROD_REF>
```

- **AI 캐시 복사 (P1, optional)**: 실패해도 내부 테스트 가능.
- **복사 허용/금지**:

```text
허용: ai_guide_cache (공용)
금지: users, auth.users, moves, user_checklist_items,
     property_photos, auth_provider_links, rate_limit_log, storage.objects
```

```sql
SELECT cache_key, master_version, jsonb_array_length(guides) FROM ai_guide_cache;  -- user-specific 아님 확인
```

### 4-5. OAuth provider 재설정 + allowed origin (v3 — #13)

- **Apple**: Client IDs(`com.isakok.app`), Secret 비움.
- **Google**: Client IDs(iOS/Android/Web). Android SHA-1은 §5-3.
- **Kakao**: prod Edge Function secrets.
- **internal URL을 아래 모두에 추가** (안 하면 CORS/redirect 막힘):

```text
- Edge Function CORS allowed origins (delete-account, kakao-token-exchange 등)
- Supabase Auth: Site URL / Redirect URLs
- Kakao Developers: allowed domain / redirect
- Google OAuth: authorized domains / redirect URI
```

### 4-6. 환경변수 스위치 — prod/internal URL (v3 — #5/#6)

> **모순 해소**: 공개 production 도메인을 바로 prod로 스위치하면 "10-4까지 미공개"와 충돌 → 내부 테스트용 별도 배포를 prod에 연결, 공개 도메인은 미스위치.

- **내부 테스트 웹 배포 (중요 — #5)**: 별도 Vercel 배포의 **`VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY`가 prod인 빌드**여야 함. URL만 internal이고 dev Supabase로 빌드되면, 네이티브가 주입한 prod 세션과 웹 Supabase client가 서로 다른 프로젝트를 봐서 `setSession()` 후 `getUser()`가 실패한다.
- **stable alias (#6)**: `EXPO_PUBLIC_WEB_APP_URL`은 AAB에 박히므로 **ephemeral Preview URL 금지** → `isakok-internal.vercel.app` 같은 고정 alias. 새 internal 배포 시 alias 재지정, 필요 시 AAB 재빌드.
- **네이티브 production 프로파일 (혼합 금지)**:

```text
EXPO_PUBLIC_SUPABASE_URL       → prod Supabase
EXPO_PUBLIC_SUPABASE_ANON_KEY  → prod Supabase
EXPO_PUBLIC_WEB_APP_URL        → prod로 빌드된 internal web 고정 alias
```

- **세션 주입 smoke (필수)**: AAB 실행 → WebView가 internal URL 로드 → (콘솔/브릿지 로그로) 웹 `VITE_SUPABASE_URL`이 prod인지 확인 → 네이티브 user.id=A → WebView `setSession()` 후 `getUser().id=A` 확인.

### 4-7. prod RLS smoke

- `rls-smoke.ts` prod 1회: A/B 격리, 공개 테이블, ai_guide_cache 차단, users UPDATE 차단, Storage signed URL 격리.

---

## 5. Android 릴리스 + 카메라 + Play Console (③-b, ③-c)

### 5-1. EAS 빌드

- `production` 프로파일(env=prod/internal), AAB. EAS `iosUrlScheme` 누락 이슈 해결. `versionCode` autoIncrement.

```bash
eas build --profile production --platform android
```

### 5-2. Android WebView 카메라 + 통과 기준 (v3 — #8/#15)

- `WebViewScreen`: `<input accept="image/*" capture>`가 Android에서 카메라를 띄우도록 핸들링.
- **CAMERA 권한 (#15)**: WebView capture가 카메라를 띄우는 데 CAMERA 권한이 필요한지 **실기기에서 확인** → 필요 시 `app.config.ts` Android `permissions`에 `CAMERA` 추가. Android 13+ 사진 선택 권한은 WebView/system picker 동작에 따라 다르므로 실기기 결과로 결정.
- **통과 기준 (#8)**:

```text
P0: 사진 업로드가 최소 1경로 이상 동작. 갤러리 선택 가능하면 내부 테스트 진행 가능.
P1: WebView capture 직접 촬영. 실패 시 known issue로 기록하고 10-5(네이티브 카메라)로 defer.
실패 판정: 사용자가 집기록을 전혀 만들 수 없으면(사진 0경로) 10-3 실패.
```

### 5-3. Play App Signing SHA-1 + 점검 순서 (v3 — #9/#10)

**등록 순서 (⚠️ 엄수):** AAB 최초 업로드 → Play Console App signing key SHA-1 확인 → Google Cloud OAuth(Android client) 등록 → Google 로그인 검증.

**서명 키 구분 (#9):**

```text
Play 내부 테스트로 설치한 앱: Play App Signing key SHA-1 필요 (10-3 핵심)
EAS local / dev build / 직접 설치: EAS upload key 또는 debug/dev key SHA-1 — 별도 Android OAuth client로 등록해야 그 빌드에서 Google 로그인 검증 가능
```

**Google 로그인 실패 시 점검 순서 (#10):**

```text
1. 패키지명 com.isakok.app 확인
2. Android OAuth client SHA-1 확인
3. webClientId / androidClientId 설정 확인
4. 설치본이 실제 Play 서명본인지 확인
5. 5~30분 전파 지연 가능성 두고 재시도
```

### 5-4. Play Console 내부 트랙 + App content

- 앱 생성: "이사콕", 한국어, 무료.
- App content(최소): 개인정보처리방침 URL(§3-4), 광고 없음, 콘텐츠 등급 → 전체이용가, 타깃 18+(아동 미포함) + Restrict Minor Access 끔, 정부앱/금융/뉴스 아니오.
- Data Safety: 내부 트랙 면제(10-3 완료 조건 제외). 폐쇄/공개/프로덕션은 10-4. **단 Play Console이 release error로 요구하는 항목은 10-3 즉시 처리.**
- 내부 트랙 → AAB 업로드 → 테스터 이메일/그룹 → opt-in 링크 → 최소 1명 설치 성공.

---

## 6. 마이그레이션

- **신규 DB 마이그레이션 없음** — 계정 삭제는 Edge Function(재귀 Storage list + Admin API) + 기존 FK CASCADE.
- prod에 00001~00020 일괄 적용(§4-2).
- **단**: protect_delete 대응을 트리거 수정/RPC로 한다면(§2-2 #3) 또는 Storage 경로 수집을 RPC로 승격하면(§2-2 대안), 그때 마이그레이션 1개(예: 00021)가 추가됨 — prod에도 적용.

---

## 7. ADR 후보

- **ADR-066 (v3 개정)**: 계정 삭제 = 즉시 hard delete + 회원 전용. Edge Function — **재귀 Storage `list()`로 경로 수집**(storage.objects 비의존) + chunk retry + 삭제 후 prefix 0건 재검증 → deleteUser(CASCADE) + auth_provider_links 명시 삭제. 서버 idempotency는 유효 JWT 한정, 클라가 401/네트워크오류 시 익명 복구. 익명 직접 삭제 경로 미추가(회원 전용 확정 — ADR-074).
- **ADR-067 (v3 보강)**: provider 해제 — Kakao `unlink()` + Google `revokeAccess()`(best-effort, 세션 정리 전, timeout 5s, 실패는 warn+삭제 유지). Apple revoke + Kakao 웹훅 = 10-4.
- **ADR-068**: prod Supabase 리전 Seoul.
- **ADR-069**: AI 캐시 dev→prod 복사(P1). ai_guide_cache만, 사용자 데이터 복사 금지.
- **ADR-070**: 내부 테스트 = production 빌드 프로파일.
- **ADR-071**: 타깃 18+ + 전체이용가 + Restrict Minor Access off.
- **ADR-072**: 약관 하이브리드(PIPC 구조).
- **ADR-073 (v3 보강)**: 10-3 = 내부 테스트 트랙 + 내부 배포만 prod 연결. **internal 웹 배포는 prod Supabase로 빌드된 고정 alias**(native env = web build env = prod 강제). 공개 production 도메인 미스위치 + 폐쇄 테스트/대중 공개 = 10-4.

### ADR-074 (신규): 사진 저장은 로그인 회원 전용 (하드 게이트)

> 이 ADR은 10-3 범위를 넘어 가입 유도 전략 전반(DECISIONS §3-1/§3-2)을 개정한다. 구현은 10-5+이나 **결정은 여기서 확정**하고 #3을 종결한다. DECISIONS.md에도 등재.

- **결정**: 비회원(익명)은 앱 전체(온보딩·체크리스트·타임라인·대시보드·AI 가이드)를 자유롭게 쓰되, **사진 "저장(서버 업로드)"은 소셜 로그인 회원만** 가능. 게이트는 "사진 기능 노출/보기"가 아니라 **"저장" 행위 시점**에 건다(가치를 본 뒤 로그인 시트). 비회원용 IndexedDB 로컬 저장은 제공하지 않는다.
- **배경**: ADR-042(Anonymous Sign-In)로 익명도 서버에 데이터를 갖는다. DECISIONS §3-2의 "소프트 넛지 + 기기(IndexedDB) 로컬 저장" 모델은 (a) 로컬 경로가 실제 구현된 적 없고(placeholder), (b) 익명 사진이 현재 그냥 서버로 올라가는 상태라 반쯤 무효화돼 있었다. 본 ADR이 이를 하드 게이트로 대체·정리한다.
- **근거 (관점별)**:
  - 전환: 사진 촬영 = 의도 최고점(증거 보호 동기) → 게이트가 이 순간 가입을 강하게 끈다. 비회원은 이미 체크리스트(1차 가치)를 받은 뒤 도달 → 첫인상 차단 아님.
  - 가치 일관성: 사진의 핵심은 증거력(서버 타임스탬프·해시·리포트). 로컬 사진은 2등급. 게이트면 "모든 사진 = 진짜 증거".
  - 구현 단순화: IndexedDB 저장·오프라인 동기화 큐·로컬→서버 마이그레이션·경고 배너를 통째로 제거(오버엔지니어링 방지).
  - 프라이버시: 익명 서버 사진 0 → 계정 삭제 회원 전용과 정합(#3 종결), 공개 전 익명 사진 공백 제거.
  - 비용/남용: 익명 사진 업로드 차단으로 스토리지·남용 벡터 감소.
- **정책 (Apple 5.1.1(v) / Google Play)**: 5.1.1(v)는 *비계정 기능*에 로그인 강제를 금지하나, "나중에 참조하려 저장(saving for future reference)" 같은 **계정 종속 기능**엔 가입 요구를 허용. 서버 사진 보관이 이에 해당해 적합. 단 ① 나머지 기능은 로그인 없이 사용 가능, ② 게이트는 저장 시점(브라우즈 차단 금지), ③ Kakao/Google 제공 시 Apple 로그인 제공(4.8 — 10-1 충족), ④ 계정 삭제 제공(10-3)을 만족해야 함. Google Play는 기능별 로그인 게이트 금지 규정 없음.
- **대안**: (A) 하드 게이트(채택). (B) 소프트 넛지 + IndexedDB 로컬 — 복잡도↑ + 2등급 데이터 → 기각. (C) 현행 무(無)게이트 — 익명 서버 사진 + 프라이버시 공백 → 기각.
- **트레이드오프**: 비회원 이탈 가능성 — 높은 의도 + 1차 가치 선경험 + 저장 시점 게이트로 상쇄. **게이트는 공개 출시(10-4/10-5) 전 반드시 켜져 있어야** 과도기 익명 사진 공백이 안 생긴다.
- **연계**: DECISIONS §3-2 가입 유도 모델 대체 / #3(익명 계정 삭제) = 회원 전용 확정 / 10-5+ "가입 유도 CTA"가 소프트→하드로 단순화(IndexedDB·동기화 큐 삭제) / 개인정보처리방침 인벤토리에서 익명 서버 사진 제거(장기).

---

## 8. 검증 체크리스트

### 계정 삭제 (①)

- [ ] JWT 없음 401 / 본인 외 차단 / rate limit 429
- [ ] **재귀 `list()`로 `{userId}/{moveId}/...` 중첩 파일까지 전부 수집**(storage.objects 직접 조회 안 함)
- [ ] chunk remove 실패 시 retry, 최종 실패면 deleteUser 진행 안 함
- [ ] **삭제 후 prefix 재조회 잔여 0건** → 0건일 때만 deleteUser
- [ ] **protect_delete 트리거가 Storage API `remove()`를 막는지 실측** → 막히면 대응(예외/RPC/조건) 적용, 해결 전 완료 금지
- [ ] `auth_provider_links` 명시 삭제 / deleteUser 실패 시 partial cleanup 로그 + 재시도 가능
- [ ] 삭제 전/후 DB row count (후속은 service_role, 0건)
- [ ] **삭제 후 복구 경로**: 네트워크오류/401 시 클라가 세션 정리 + signInAnonymously
- [ ] **새 anonymous id 검증**: 삭제 전 A → delete → clear → unlink/revoke best-effort → signInAnonymously → 새 B → A 데이터 접근 불가 → B 온보딩 신규 → WebView AUTH_SESSION이 B로 갱신
- [ ] Kakao `unlink()` / Google `revokeAccess()` 동작 + 실패 시 timeout/warn(PII 없음)/삭제 유지

### 약관 (②)

- [ ] `/privacy`·`/terms` 세션 없는 상태 + Play Console에서 접근 가능
- [ ] 설정 링크 → 실제 URL
- [ ] 개인정보처리방침 필수 섹션 / 이용약관 면책

### prod 세팅 (③-a)

- [ ] 00001~00020 적용 + master 46 seed + 사용자 0건
- [ ] secrets 등록 / (P1) AI 캐시 — ai_guide_cache만 복사
- [ ] OAuth provider prod 설정 + **internal URL을 CORS/Auth/Kakao/Google allowed에 추가**
- [ ] **internal 웹 배포가 prod Supabase로 빌드됨**(VITE_SUPABASE_URL=prod) + 고정 alias
- [ ] native 3개(SUPABASE_URL/ANON_KEY/WEB_APP_URL) 모두 prod/internal (혼합 금지)
- [ ] **세션 주입 smoke**: native user.id=A → WebView setSession → getUser().id=A
- [ ] 공개 production 도메인 미스위치
- [ ] `rls-smoke` prod 통과

### Android / Play (③-b, ③-c)

- [ ] production AAB 빌드 성공(EAS iosUrlScheme 해소)
- [ ] **Play App Signing SHA-1 → Google Cloud 등록**(§5-3 순서) / dev·직접설치 SHA는 별도 client
- [ ] Google 로그인 실패 시 점검 순서(§5-3) 적용
- [ ] 실기기 사진 업로드 ≥1경로 → prod Storage (갤러리 OK면 진행 / 카메라 직접 촬영 실패는 10-5 defer / 0경로면 10-3 실패)
- [ ] 실기기 Google/Kakao 로그인(Play 서명 빌드)
- [ ] 릴리스 빌드 핵심 플로우(온보딩~대시보드~집기록)
- [ ] Play 내부 트랙 배포 + **최소 1명 opt-in 설치 성공**
- [ ] 10-1 잔여: #58, #100

---

## 9. Follow-ups

- **10-4**: 폐쇄 테스트(N명/14일)→프로덕션 접근 · Data Safety 폼 · Apple 토큰 revoke · Kakao 연결 해제 웹훅 · Kakao rate limit 하드닝 · prod 대중 URL 공개 · iOS TestFlight · 제3자 OSS 고지.
- **10-5+**: 가입 유도 CTA(→ **사진 저장 하드 게이트**, ADR-074) · 네이티브 카메라(expo-image-picker) · migrate 본구현 · RLS CI.
- **⭐ 사진 저장 게이트는 공개 출시(10-4/10-5) 전 반드시 적용** (ADR-074): 적용 전까지 익명 사진이 서버에 쌓이는데 cleanup도 deferred → "익명 사진 + 무삭제" 공백. 게이트(또는 cleanup)가 공개 전 닫혀야 함. (내부 테스트 12명은 무관.)
- **익명 cleanup 작업 구현**(30일 + 날짜규칙).
- **폴백 발동률 영속 로깅**(현재 console.warn).
- **git 히스토리 secret 스캔**(gitleaks/trufflehog) — 공개 레포.
- **DECISIONS.md 정리**: §3-1/§3-2 가입 유도(소프트 넛지+로컬) 모델을 ADR-074(하드 게이트)로 갱신 표기.

---

## 10. UI/UX 폴리싱 (10-3 실기기 검증 중 수행)

10-3 스펙 범위 외이나, iOS 실기기 테스트 과정에서 발견·수정한 UX 개선 사항. 상세는 **[`docs/UI-POLISH.md`](../UI-POLISH.md)** 참조.

- **네이티브 탭바 전환**: JS `Tabs` → `NativeTabs` (UITabBarController) + SF Symbols + Context 기반 show/hide
- **페이지 전환 애니메이션**: `@ssgoi/react` drill 전환으로 iOS push/pop 스타일 적용
- **WKWebView 스와이프백 정상화**: 스냅샷 불일치 + 탭 루트 이탈 문제 해결 (히스토리 정리 방식)
- **체크리스트 상세 뒤로가기**: `?from=` 파라미터로 출발지(대시보드/타임라인) 복원
- **네이티브 브릿지 확장**: NAVIGATE_TO, 탭 재탭 루트 복귀, 햅틱 피드백, 스크롤 동작
- **하드코딩 경로 상수화**: `TAB_ROOT_PATHS`, `checklistDetailPath()`, `ROUTES.*` 통일
- **온보딩 1단계 뒤로가기 제거**: 무한루프 방지
