# 10-1단계 v3.2: 네이티브 인증 + 세션 브릿지 (디바이스 격리 포함) 스펙 (SDD)

> 목표: TEMP_USER_ID 공유 모델을 폐기하고 Supabase Anonymous Sign-In으로 디바이스 격리를 도입한다. Apple/Kakao/Google 네이티브 소셜 로그인을 추가하고, Native가 session owner인 브릿지 구조로 WebView 3개에 세션을 전달한다. 익명→소셜 승격은 `linkIdentity({ token })` 메인 경로 + spike 실패 시 폴백 분기로 처리한다.
> 이 단계가 끝나면: 모든 유저가 진짜 auth.uid()를 보유한 상태에서 앱 사용. 비회원(익명)과 회원 모두 JWT 인증 상태. WebView 3개가 단일 세션을 공유하며 토큰 갱신 충돌 없음. prod 환경은 구성하되 외부 공개는 10-2 RLS 완료 후. RLS 활성화는 10-2에서.

> **v2 변경 사항 (v2 → v3)**: GPT v2 리뷰 20개 항목 반영
>
> - `linkIdentity({ provider, token })` 표현 완화: "공식 확정" → "docs 예시 존재 + SDK 동작 spike 검증 필수" (GPT #1)
> - `as any` 캐스트 제거, 타입 정의 검증 spike 절차 §17 신설 (GPT #1)
> - 10-1 핵심 성공 기준 명확화: "user.id A 유지 + identities 추가" (GPT #2)
> - Kakao `mode` 용어 분리: `identity-linked` (Apple/Google) vs `custom-linked` (Kakao) (GPT #3)
> - Kakao Edge Function: `existingLink === currentAnonymousUserId` 분기 추가 (GPT #4)
> - Kakao Edge Function: email 충돌은 409 Conflict 반환 (GPT #5)
> - Kakao Edge Function CORS origin 제한 → 10-2 보안 TODO 명시 (GPT #6)
> - Kakao rate limit "prod 공개 전 필수" 표현 격상 (GPT #7)
> - prod 비공개 실 구현: production Vercel을 10-1 동안 dev Supabase에 연결 (GPT #8, A안)
> - `supabase db reset --linked` 가드 강화: project-ref 확인 절차 (GPT #9)
> - `auth_provider_links.provider` CHECK 제약 (GPT #10)
> - `linkIdentity` 후 `public.users.provider` 갱신 검증 + fallback 명시 (GPT #11)
> - Manual Identity Linking 콘솔 위치 확정: Authentication → Sign In / Providers → User Signups (GPT #12)
> - 401-driven refresh 유지, proactive refresh는 10-2 TODO 명시 (GPT #13)
> - signOut에서 모든 provider best-effort 호출 (GPT #14)
> - `useUserId` loading/null 구분 (객체 반환) (GPT #15)
> - SELECT/UPDATE/DELETE도 user_id 필터 명시, grep 검증 추가 (GPT #16)
> - `functions.invoke` Authorization 자동 주입 검증 + fallback 코드 (GPT #17)
> - Edge Function `verify_jwt: true` 기본값 유지 명시 (GPT #18)
> - 디바이스 격리 표현: "service layer 기준" vs "DB RLS 기준" 구분 (GPT #19)
> - `auth_provider_links` 비공개 전제 (10-1) → 10-2 service_role only 정책 (GPT #20)
> - ADR-050 신규: Manual Linking beta 기능 사용 + 모니터링 정책
> - 폴백 분기 명시: spike 실패 시 `signInWithIdToken` + 10-2 데이터 이전 위임 (B안)
> - 사전 작업 체크리스트 보강: Apple Developer / Google Cloud / Kakao Developers / Supabase 콘솔
> - Captcha / anonymous cleanup / Naver provider는 후속 단계로 명시

> **v3.1 변경 사항 (v3 → v3.1)**: 사전 작업 실측 정정 5개 반영 (2026-05-20 완료)
>
> - **Apple provider 콘솔 설정 정정**: Supabase Apple provider는 Team ID/Key ID/.p8 방식이 아니라 **Client IDs(`com.isakok.app`)만 입력, Secret Key 비움** (네이티브 id_token 검증 방식). Team ID/Key ID/Services ID/.p8는 웹 OAuth용이라 네이티브 전용 현 단계에선 미사용 (메모장 보관). §0-5 정정
> - **Google Skip nonce checks ON 필요** (신규): `@react-native-google-signin`이 nonce를 전달하지 않아 Supabase가 nonce 검증 시 실패 → Skip nonce checks ON으로 검증 우회. Apple은 nonce 생성·전달하므로 OFF 유지. ADR-052 신규. §0-5 + §6-3 반영
> - **prod Supabase 생성 10-2로 미룸**: 10-1엔 dev만 사용 (마이그레이션 00013/00014가 본 구현에서 생성되므로 지금 prod 만들면 부분 적용 + 빈 채로 방치). prod는 10-2에서 마이그레이션 완성 후 일괄 생성. §0-4, §1, §19 정정
> - **Kakao UI 2025.12 개편 반영**: 기존 "플랫폼" 메뉴 폐지 → 플랫폼 정보(iOS 번들 ID, Android 패키지명, 키해시)가 `앱 → 플랫폼 키 → 네이티브 앱 키` 상세 화면 안으로 이동. §0-3 정정
> - **Kakao 이메일 사업자 인증 필요**: 이메일 동의 항목은 사업자 인증을 받아야 사용 가능 → 사이드 프로젝트는 권한 없음 → placeholder email(`kakao_<id>@isakok.invalid`)로 처리 (§9 코드는 이미 대응). §0-3 명시

> **v3.2 변경 사항 (v3.1 → v3.2)**: spike 결과 반영 (2026-05-20 ✅ 통과)
>
> - **spike ✅ 통과**: `linkIdentity({ provider, token })`가 익명 user.id 유지 + is_anonymous false + identities `["google"]` + app_metadata.provider 자동 갱신 확인 (supabase-js 2.105.4, iOS Simulator). `docs/specs/10-1-spike-result.md` 참조.
> - **메인 경로 확정**: `tryLinkIdentity`(linkIdentity) 사용. 폴백(signInWithIdToken)은 실패 시 안전망으로 보존. ADR-043 갱신.
> - **`as any` 유지 확정**: SDK 타입에 `token` 미포함(런타임 정상). 검증된 예외로 사유 주석 명시 (§6-5). SDK 타입 명시 버전 나오면 제거.
> - **ADR-054 신규**: linkIdentity 후 provider 갱신은 트리거가 주 경로(spike 실측). `ensureUsersProviderUpdated`는 방어적 fallback으로 강등. GPT #11 우려 해소.
> - **디버깅 메모**: linkIdentity 응답의 `user.identities`는 빈 배열 → identity 확인은 `getUser()`/`getSession()`으로 (§6-5 주석).

---

## 0. 사전 작업 (Pre-flight)

10-1 본 구현 진입 전에 코드 외 작업 5종 + 환경 분리 1종.

> ⚠️ **prod 외부 공개 금지**: 10-1에서 prod Supabase 프로젝트를 구성하지만 RLS는 아직 꺼져 있다. **10-2 RLS 활성화 + 전수 검증 완료 전까지** 다음 정책 유지:
>
> - 10-1 동안 **production Vercel deployment를 dev Supabase에 연결**해 운영 (환경변수 trick)
> - 10-2 완료 시점에 환경변수만 prod Supabase로 스위치
> - 실 베타 시작은 10-2 완료 후
>
> 이 방식은 추가 비용 0원으로 prod 데이터 보호와 환경 분리 인프라 구축을 동시에 달성한다.

### 0-1. Apple Developer 작업

- App ID 확인/생성 (Bundle ID = `com.isakok.app`)
- **"Sign in with Apple" Capability 활성화** (이게 빠지면 빌드는 되지만 Apple 로그인 시 invalid_client 에러)
- Services ID 생성 (Supabase 콘솔에 등록할 식별자)
  - Domains + Subdomains에 Supabase 프로젝트 도메인 등록 (`<project-ref>.supabase.co`)
  - Return URL에 `https://<project-ref>.supabase.co/auth/v1/callback` 등록
- Key 생성 + 다운로드 (`.p8` 파일) + Key ID 메모
- Team ID 메모

> **Apple Sign In은 한 번 가입한 user의 이메일/이름을 두 번 다시 안 줌**. 첫 로그인 응답을 잘 저장해야 함. 우리는 displayName 사용 안 하지만, 이메일은 Hide My Email 기능과 함께 받음(@privaterelay.appleid.com로 자동 relay).

### 0-2. Google Cloud Console 작업

OAuth 2.0 Client ID **3개** 발급 필요:

| Client 타입                                                  | 용도                        | 환경변수                               |
| ------------------------------------------------------------ | --------------------------- | -------------------------------------- |
| **iOS** (Bundle ID = `com.isakok.app`)                       | iOS 네이티브 sign-in        | `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`     |
| **Android** (Package = `com.isakok.app` + SHA-1 fingerprint) | Android 네이티브 sign-in    | `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` |
| **Web** (Application 타입)                                   | Supabase OIDC audience 검증 | `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`     |

작업 순서:

1. Google Cloud 프로젝트 생성 (`isakok`)
2. OAuth Consent Screen 설정 (앱 이름, 지원 이메일 등)
3. APIs & Services → Credentials → 3개 OAuth Client ID 발급
4. Android SHA-1 fingerprint 확보:
   - EAS Build keystore 사용 시: `eas credentials` 명령으로 fingerprint 출력
   - Play App Signing 사용 시: upload key + app signing key fingerprint **둘 다** Google Cloud에 등록
5. Web Client ID를 Supabase 콘솔 Google provider 설정에 등록

### 0-3. Kakao Developers 작업

> ⚠️ **2025.12 UI 개편**: 기존 "플랫폼" 메뉴가 폐지되고, 플랫폼 정보가 `앱 설정 → 플랫폼 키 → 네이티브 앱 키` 상세 화면 안으로 이동했다. iOS 번들 ID / Android 패키지명 / 키해시를 모두 이 화면에서 입력한다.

1. Kakao Developers 사이트에서 애플리케이션 생성 (`이사콕`, 한글 가능)
2. `앱 설정 → 플랫폼 키`에서 **네이티브 앱 키** 확인 → `EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY` (앱 생성 시 자동 발급)
3. `플랫폼 키 → 네이티브 앱 키` 상세 화면에서 플랫폼 정보 입력:
   - **iOS 번들 ID**: `com.isakok.app`
   - **Android 패키지명**: `com.isakok.app`
   - **Android 키해시**: EAS keystore에서 추출
     ```bash
     # EAS keystore 다운로드 후 (eas credentials → Android → Download existing keystore)
     keytool -exportcert -alias <KEY_ALIAS> -keystore "<KEYSTORE_FILE>" -storepass <STORE_PASS> | openssl sha1 -binary | openssl base64
     ```
   - 스토어 URL: 비워두기 (출시 후)
4. **`제품 설정 → 카카오 로그인` 활성화** (사용 설정 ON), OpenID Connect는 OFF 유지
5. 동의 항목: 닉네임/프로필 사진 미사용. **이메일은 사업자 인증을 받아야 사용 가능 → 사이드 프로젝트는 권한 없음 → placeholder email로 처리** (§9 참조)

> **Kakao는 Supabase provider로 등록하지 않음.** Edge Function 경유 custom auth.
> **Kakao 이메일 처리**: 이메일 동의 권한이 없으므로 Edge Function이 `kakao_<id>@isakok.invalid` placeholder를 생성한다. 도구형 앱이라 이메일 표시/발송 흐름이 없어 UX 영향 없음. 웹훅(연결 해제) 설정은 10-3 계정 삭제와 함께.

### 0-4. Supabase 분리 (dev만 사용, prod는 10-2로 미룸)

- 현재 프로젝트: 기존 project-ref → **dev로 그대로 사용**
- **prod 신규 프로젝트 생성은 10-2 진입 직전으로 미룬다** ⭐ (v3.1 정정)

> **왜 prod 생성을 미루나**: 마이그레이션 `00013_anonymous_users.sql` / `00014_auth_provider_links.sql`는 본 구현에서 Claude Code가 생성한다. 지금 prod를 만들면 00012까지만 부분 적용된 빈 프로젝트가 10-2까지 방치된다. 10-1 본 구현 + spike는 전부 dev로 진행하고, ADR-051대로 production Vercel도 dev Supabase에 연결하므로 10-1엔 prod가 전혀 필요 없다. prod는 10-2에서 마이그레이션이 완성된 후 일괄 생성·적용하는 것이 깔끔하다.

**10-2 진입 시 prod 생성 절차 (지금 실행 안 함, 참고용):**

```bash
# ⚠️ project-ref 확인 절차 (GPT #9 — db reset 사고 방지)
cd supabase
supabase projects list  # prod project-ref 확인
supabase link --project-ref <PROD_PROJECT_REF>
supabase status  # 현재 link된 project ref 재확인

# 빈 prod에 한 번만 reset (이후 절대 재실행 금지)
supabase db reset --linked
# 또는 안전하게: db push + seed 수동 적용
supabase db push  # 00001~00014 전부
psql "$PROD_DATABASE_URL" -f supabase/seed.sql

# Edge Function 배포
supabase functions deploy generate-ai-guide --project-ref <PROD_PROJECT_REF>
supabase functions deploy kakao-token-exchange --project-ref <PROD_PROJECT_REF>
supabase secrets set ANTHROPIC_API_KEY=<key> ANTHROPIC_MODEL=claude-haiku-4-5-20251001 --project-ref <PROD_PROJECT_REF>

# Storage 버킷 property-photos (private) 생성
```

> ⚠️ **`db reset --linked`는 초기 빈 prod에서 1회만**. 데이터 들어간 후 재실행 시 전체 wipe. 운영 시작 후에는 마이그레이션 파일 추가 + `db push`만 사용.

### 0-5. Supabase 콘솔 토글 (dev만, prod는 10-2 진입 직전)

`Authentication → Sign In / Providers → User Signups` 섹션:

| 토글                           | 상태      | 이유                                                   |
| ------------------------------ | --------- | ------------------------------------------------------ |
| **Allow new users to sign up** | ON        | 기본 활성. OFF면 모든 가입 차단                        |
| **Allow manual linking**       | ON (beta) | `linkIdentity()` 동작에 필수. beta 표시 인지 — ADR-050 |
| **Allow anonymous sign-ins**   | ON        | `signInAnonymously()` 동작에 필수                      |
| **Confirm email**              | OFF       | 소셜/익명만 사용, Kakao placeholder email 충돌 방지    |

`Authentication → Sign In / Providers → Auth Providers` 섹션:

**Apple** 활성화 — ⭐ v3.1 정정: 네이티브 방식이라 **Client IDs만 입력**:

| Apple 필드                   | 입력                                                     |
| ---------------------------- | -------------------------------------------------------- |
| Enable Sign in with Apple    | ON                                                       |
| **Client IDs**               | `com.isakok.app` (네이티브 Bundle ID, id_token aud 검증) |
| **Secret Key (for OAuth)**   | **비워둠** (웹 OAuth 전용, 네이티브 불필요)              |
| Allow users without an email | ON (Apple이 이메일 미반환 시 대비)                       |

> Team ID(`LTM6PZYATK`) / Key ID(`9LBMZ5XHV2`) / Services ID(`com.isakok.auth`) / `.p8`는 **웹 OAuth redirect 흐름 전용**. 네이티브 id_token 검증엔 불필요하므로 현 단계 미입력 (메모장 보관, 향후 웹 Apple 로그인 추가 또는 Secret JWT 필요 시 사용).

**Google** 활성화 — ⭐ v3.1 정정: **Skip nonce checks ON 필수**:

| Google 필드                   | 입력                                                                                 |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| Enable Sign in with Google    | ON                                                                                   |
| **Client IDs** (콤마 구분)    | Web + iOS + Android 3개 모두 (`<web>,<ios>,<android>`)                               |
| **Client Secret (for OAuth)** | Web Client Secret (`<client-secret>`) — 네이티브엔 불필요하나 향후 웹 확장 대비 등록 |
| **Skip nonce checks**         | **ON** ⭐ (RN 라이브러리가 nonce 미전달 → 검증 우회 필요)                            |
| Allow users without an email  | OFF (Google은 보통 이메일 반환)                                                      |

> **Google Skip nonce ON 근거 (ADR-052)**: `@react-native-google-signin`은 우리 코드 흐름상 nonce를 발급/전달하지 않는다. Supabase가 id_token의 nonce를 검증하려 하면 검증 대상이 없어 로그인이 실패한다. 따라서 Skip nonce checks를 켜 검증을 우회한다. Apple은 `expo-apple-authentication`이 nonce를 지원해 우리가 직접 생성·전달하므로 (§6-2) Apple provider엔 이 옵션이 없고 nonce 검증이 정상 동작한다.

- **Kakao** ❌ 등록 안 함 (Edge Function 경유)
- **Email** 비활성화 (정책상 소셜만)

> Anonymous sign-in의 IP 기반 rate limit 기본값 30/hour 유지. 출시 후 abuse 발생 시 captcha (invisible CAPTCHA 또는 Cloudflare Turnstile) 도입 검토.

### 0-6. Vercel 환경 분리 + 자동 배포 + prod 비공개 정책

- Vercel 프로젝트에 GitHub repo 연결 (Project Settings → Git)
- Production Branch: `main`
- Preview: 모든 다른 브랜치
- Root Directory: `apps/web`
- Framework Preset: Vite

**환경변수 (10-1 동안 — prod도 dev Supabase 가리킴):**

| 변수                     | Production              | Preview / Development |
| ------------------------ | ----------------------- | --------------------- |
| `VITE_SUPABASE_URL`      | **dev URL** (임시)      | dev URL               |
| `VITE_SUPABASE_ANON_KEY` | **dev anon key** (임시) | dev anon key          |

**10-2 RLS 활성화 + 검증 완료 후 스위치:**

| 변수                     | Production (10-2 후)       | Preview / Development |
| ------------------------ | -------------------------- | --------------------- |
| `VITE_SUPABASE_URL`      | **prod URL** ← 스위치      | dev URL               |
| `VITE_SUPABASE_ANON_KEY` | **prod anon key** ← 스위치 | dev anon key          |

> **이 방식의 장점**: production Vercel deployment URL은 만들되, 외부 노출되어도 prod DB는 비어있고 dev DB만 보임. dev DB에는 본인 테스트 데이터만 있음. 10-2 완료 후 환경변수 두 줄만 바꿔서 prod로 스위치.

### 0-7. Expo eas.json 환경 분리

```jsonc
{
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
      "env": {
        "EXPO_PUBLIC_WEB_APP_URL": "https://isakok-dev.vercel.app",
        "EXPO_PUBLIC_SUPABASE_URL": "<dev-url>",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<dev-key>",
        "EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID": "<...>",
        "EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID": "<...>",
        "EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID": "<...>",
        "EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY": "<...>",
      },
    },
    "preview": { "...": "development와 동일" },
    "production": {
      "env": {
        "EXPO_PUBLIC_WEB_APP_URL": "https://isakok.vercel.app",
        "EXPO_PUBLIC_SUPABASE_URL": "<10-2 후 prod-url>",
        "EXPO_PUBLIC_SUPABASE_ANON_KEY": "<10-2 후 prod-key>",
      },
    },
  },
}
```

### 0-8. 사전 작업 완료 확인 (2026-05-20 실측 완료)

- [x] Apple Developer: App ID + Sign in with Apple Capability + Services ID(`com.isakok.auth`) + Key(`9LBMZ5XHV2`)
- [x] Google Cloud: OAuth Client iOS / Android / Web 3개 + Android SHA-1 등록
- [x] Kakao Developers: 네이티브 앱 키 + 플랫폼 키 화면에 iOS Bundle / Android Package + 키해시 등록 + 카카오 로그인 활성화
- [x] Supabase dev 콘솔 토글: Manual Linking ON, Anonymous ON, Confirm Email OFF
- [x] Supabase dev Apple provider: Client IDs(`com.isakok.app`)만, Secret 비움 (ADR-053)
- [x] Supabase dev Google provider: Client IDs 3개 + Web Secret + **Skip nonce checks ON** (ADR-052)
- [x] Vercel 환경변수: production이 dev Supabase(`ybcqinanfcarhqkclvue`) 가리킴 (ADR-051)
- [x] Expo `apps/mobile/.env`: Google/Kakao 키 + dev Supabase 채움
- [ ] Supabase dev 마이그레이션 00013~00014 — **본 구현에서 Claude Code가 생성·적용**
- [ ] **Supabase prod 프로젝트 — 10-2 진입 직전 생성** (지금 안 함, §0-4 참조)
- [ ] eas.json 빌드 프로파일별 env — **본 구현에서 Claude Code가 spec §0-7 보고 설정** (spike는 로컬 `.env`로 충분)
- [ ] prod URL 외부 비공개 정책 `docs/STATUS.md` 기록 — 본 구현 시 함께

---

## 1. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 마이그레이션 `00013_anonymous_users.sql` (auth.users → public.users 자동 동기화 트리거)
- 마이그레이션 `00014_auth_provider_links.sql` (Kakao custom provider 매핑)
- TEMP_USER_ID 하드코딩 전면 제거
- 앱 진입 시 익명 세션 자동 생성 (`signInAnonymously()`)
- Native가 session owner: SecureStore 저장, 단독 갱신
- **mobile 전용 Supabase client** (`apps/mobile/src/auth/supabaseNative.ts`)
- Auth Service 추상화: `AuthProvider` discriminated union (OIDC / Kakao) + Apple/Kakao/Google 구현체
- Apple Sign In (`expo-apple-authentication`) + nonce 처리
- Kakao Sign In (`@react-native-seoul/kakao-login`)
- Google Sign In (`@react-native-google-signin/google-signin`)
- 네이티브 로그인 화면 (`/auth` route)
- 익명→소셜 승격 메인 경로: `linkIdentity({ provider, token, access_token })` 사용
- **spike 절차** (§17): 본 구현 직전 30분 검증 + 결과별 분기
- spike 실패 시 폴백 분기: `signInWithIdToken` + `conflict: true` + 안내 메시지 (본 데이터 이전은 10-2)
- Kakao 토큰 교환 Edge Function (`kakao-token-exchange`) + Authorization JWT 검증 + 매핑 테이블 조회
- **WebView lazy mount 대응**: WEB_READY 응답 시 currentSession 주입
- BridgeMessage wrapper (9단계 호환) 사용
- 메시지 확장: AUTH_SESSION payload, REQUEST_SESSION_REFRESH 신규
- WebView 3개 broadcast + 신규 WebView 자동 동기화
- 웹 Supabase 클라이언트: 네이티브 환경에서 `persistSession: false`, `autoRefreshToken: false`
- 웹 401 인터셉터 → REQUEST_SESSION_REFRESH 브릿지 (debounce 5초)
- 온보딩 우상단 "로그인" 텍스트 버튼
- `useSession()` / `useUserId()` 훅 (apps/web 위치)

### 안 하는 것

- RLS 활성화 (10-2)
- 비회원 → 회원 데이터 이전 RPC (10-2 — spike 실패 폴백 케이스의 본 마이그레이션도 10-2 충돌 처리 RPC에 통합)
- Edge Function `generate-ai-guide`에 JWT 검증 추가 (10-2)
- ai_guide_cache 정책 변경 (10-2)
- TEMP_USER_ID 데이터 wipe (10-2)
- Kakao Edge Function rate limit 정식 구현 (10-2 — prod 공개 전 필수)
- Kakao Edge Function CORS origin 제한 (10-2)
- proactive token refresh (10-2 — 401-driven으로 시작)
- 사진 촬영 가입 유도 게이트 (10-3)
- 이사 완료 가입 유도 CTA (10-3)
- 계정 삭제 (10-3, Apple 심사 필수)
- 네이티브 카메라 / expo-image-picker (10-3)
- 일반 이메일/비밀번호 로그인 (소셜만)
- 닉네임/프로필 설정 (도구형 앱)
- **Captcha / Turnstile** (출시 후 abuse 발생 시 도입)
- **익명 user 자동 정리 (cleanup)** (출시 직전 운영 준비 단계)
- **Naver 등 추가 provider** (v1.1 — `AuthProvider` 인터페이스만 열어둠)
- prod URL 외부 공개 (10-2 RLS 완료 후)

---

## 2. 폴더 구조

```
apps/mobile/
├── app.json                              ← 수정 (config plugins, capability)
├── eas.json                              ← 수정 (env 3개 프로파일)
├── .env.example                          ← 수정 (SUPABASE_*, Google ids, Kakao key)
├── src/
│   ├── app/
│   │   ├── _layout.tsx                   ← 수정 (bootstrap)
│   │   ├── auth.tsx                      ← 신규 (로그인 화면)
│   │   └── (tabs)/_layout.tsx            ← 수정 (WebView registerWebView 위임)
│   ├── auth/
│   │   ├── supabaseNative.ts             ← 신규 ⭐
│   │   ├── AuthService.ts                ← 신규
│   │   ├── bootstrap.ts                  ← 신규
│   │   ├── session.ts                    ← 신규 (SecureStore)
│   │   ├── sessionState.ts               ← 신규 (currentSession 모듈) ⭐
│   │   ├── broadcast.ts                  ← 신규 (BridgeMessage wrapper)
│   │   └── providers/
│   │       ├── types.ts                  ← 신규 (discriminated union)
│   │       ├── AppleProvider.ts          ← 신규 (nonce 포함)
│   │       ├── GoogleProvider.ts         ← 신규 (iOS/Android 분기)
│   │       └── KakaoProvider.ts          ← 신규
│   ├── components/
│   │   └── WebViewScreen.tsx             ← 수정 (registerWebView + WEB_READY 시 세션 주입)
│   ├── hooks/
│   │   └── useAuthSession.ts             ← 신규 (mobile)
│   └── utils/
│       └── webBridge.ts                  ← 수정

packages/shared/src/
├── types/
│   └── bridge.ts                         ← 수정 (AUTH_SESSION payload 확장, REQUEST_SESSION_REFRESH 추가)
├── utils/
│   └── nativeBridge.ts                   ← 수정 (BridgeMessage wrapper)
└── lib/
    └── supabase.ts                       ← 수정 (네이티브 환경 분기)

apps/web/src/
├── App.tsx                               ← 수정 (setupWebSessionListener)
├── auth/                                  ← 신규 (web 전용 auth) ⭐
│   ├── useSession.ts                     ← 신규
│   ├── webSessionListener.ts             ← 신규
│   └── authError.ts                      ← 신규 (401 인터셉터)
├── lib/
│   └── queryClient.ts                    ← 수정 (QueryCache/MutationCache)
├── pages/
│   └── OnboardingPage.tsx                ← 수정 (우상단 로그인 버튼)
└── shared/
    └── services/
        ├── moves.ts                      ← 수정 (TEMP_USER_ID → userId 인자)
        ├── checklist.ts                  ← 수정
        └── photos.ts                     ← 수정

supabase/
├── migrations/
│   ├── 00013_anonymous_users.sql         ← 신규
│   └── 00014_auth_provider_links.sql     ← 신규 ⭐
└── functions/
    └── kakao-token-exchange/
        └── index.ts                      ← 신규 (JWT 검증 + 매핑 테이블 + 409 처리)
```

---

## 3. 패키지 설치

```bash
cd apps/mobile
npx expo install expo-apple-authentication expo-secure-store expo-crypto
pnpm add @react-native-seoul/kakao-login @react-native-google-signin/google-signin
pnpm add @supabase/supabase-js
```

### app.json config plugins

```jsonc
{
  "expo": {
    "plugins": [
      "expo-router",
      "expo-font",
      "expo-apple-authentication",
      "expo-secure-store",
      ["@react-native-google-signin/google-signin", { "iosUrlScheme": "<REVERSED_CLIENT_ID>" }],
    ],
    "ios": {
      "bundleIdentifier": "com.isakok.app",
      "usesAppleSignIn": true,
      "infoPlist": {
        "LSApplicationQueriesSchemes": ["kakaokompassauth", "kakaolink", "kakaotalk"],
        "CFBundleURLTypes": [{ "CFBundleURLSchemes": ["kakao<NATIVE_APP_KEY>"] }],
      },
    },
    "android": {
      "package": "com.isakok.app",
    },
  },
}
```

> **Kakao Android config plugin**: 구현 시점의 `@react-native-seoul/kakao-login` 공식 README를 다시 확인. plugin이 있으면 사용, 없으면 `expo prebuild` 후 AndroidManifest 수동 편집 또는 dangerous mod.

### .env.example

```
EXPO_PUBLIC_WEB_APP_URL=https://isakok-dev.vercel.app
EXPO_PUBLIC_SUPABASE_URL=https://<project-ref>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID=<google-ios-client-id>
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID=<google-android-client-id>
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<google-web-client-id>
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=<kakao-native-key>
```

---

## 4. 마이그레이션

### 4-1. `00013_anonymous_users.sql`

```sql
-- auth.users INSERT 시 public.users 자동 동기화 (익명 가입 + 소셜 가입 모두)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, provider)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_app_meta_data->>'provider', 'anonymous')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- linkIdentity 후 provider 변경 시 public.users 갱신
CREATE OR REPLACE FUNCTION public.handle_user_provider_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_app_meta_data->>'provider' IS DISTINCT FROM OLD.raw_app_meta_data->>'provider' THEN
    UPDATE public.users
       SET provider = NEW.raw_app_meta_data->>'provider',
           email = COALESCE(NEW.email, public.users.email),
           updated_at = now()
     WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_updated ON auth.users;
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_user_provider_update();
```

> **GPT #11 후속**: `linkIdentity` 후 `auth.users.raw_app_meta_data.provider`가 실제로 'apple'/'google'로 바뀌는지는 Supabase 동작에 의존. 변경 안 되면 AuthService 성공 시점에 명시적으로 `update public.users set provider = ... where id = ...` 호출 (§6-5 fallback 코드 참조). spike에서 검증.

### 4-2. `00014_auth_provider_links.sql`

```sql
-- Kakao 같은 custom auth provider와 Supabase user 매핑
-- Supabase native identity가 아니라 앱 레벨 매핑 (ADR-048)
CREATE TABLE public.auth_provider_links (
  provider text NOT NULL,
  provider_user_id text NOT NULL,
  user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (provider, provider_user_id),

  -- GPT #10: 데이터 품질 보강
  CONSTRAINT auth_provider_links_provider_check
    CHECK (provider IN ('kakao'))
);

CREATE INDEX idx_auth_provider_links_user_id
  ON public.auth_provider_links(user_id);

COMMENT ON TABLE public.auth_provider_links IS
  '외부 OAuth provider와 Supabase user 매핑. Kakao 같은 OIDC 미지원 provider 용도. service_role만 접근 (RLS는 10-2에서 활성화).';
```

> **GPT #20**: 10-1은 RLS 미활성 상태라 이 테이블이 noteoretically 공개될 수 있으나, prod 비공개 정책으로 인해 외부 노출 위험 없음. 10-2에서 RLS enable + service_role only 정책 필수.

---

## 5. Mobile 전용 Supabase Client

```typescript
// apps/mobile/src/auth/supabaseNative.ts

import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error('[supabaseNative] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY 누락')
}

/**
 * Mobile 전용 Supabase 클라이언트.
 *
 * 웹 client(packages/shared/src/lib/supabase.ts)와 분리한 이유:
 * 1. 환경변수 시스템: 웹은 import.meta.env.VITE_*, mobile은 process.env.EXPO_PUBLIC_*
 * 2. Native가 session owner이므로 SecureStore로 직접 관리
 * 3. persistSession/autoRefreshToken 무조건 false (Native 단독 갱신 + broadcast)
 */
export const supabaseNative = createClient(url, anonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})
```

---

## 6. Auth Service 추상화

### 6-1. Provider 인터페이스 (Discriminated Union)

```typescript
// apps/mobile/src/auth/providers/types.ts

export type OidcProviderName = 'apple' | 'google'
export type AuthProviderName = OidcProviderName | 'kakao'

export interface OidcProviderResult {
  kind: 'oidc'
  provider: OidcProviderName
  idToken: string
  accessToken?: string
  nonce?: string // Apple replay 방지용
}

export interface KakaoProviderResult {
  kind: 'kakao'
  accessToken: string
}

export type AuthProviderResult = OidcProviderResult | KakaoProviderResult

export interface AuthProvider {
  name: AuthProviderName
  isAvailable: () => Promise<boolean>
  signIn: () => Promise<AuthProviderResult>
  signOut: () => Promise<void>
  unlink?: () => Promise<void> // 10-3 계정 삭제용
}
```

### 6-2. AppleProvider

```typescript
// apps/mobile/src/auth/providers/AppleProvider.ts

import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import type { AuthProvider, OidcProviderResult } from './types'

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID()
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw)
  return { raw, hashed }
}

export const AppleProvider: AuthProvider = {
  name: 'apple',

  isAvailable: async () => {
    if (Platform.OS !== 'ios') return false
    return AppleAuthentication.isAvailableAsync()
  },

  signIn: async (): Promise<OidcProviderResult> => {
    const { raw, hashed } = await generateNonce()
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashed,
    })
    if (!credential.identityToken) {
      throw new Error('[AppleProvider] identityToken 누락')
    }
    return {
      kind: 'oidc',
      provider: 'apple',
      idToken: credential.identityToken,
      nonce: raw, // raw nonce를 Supabase에 전달
    }
  },

  signOut: async () => {
    // Apple은 명시적 로그아웃 API 없음. Supabase 측 세션 정리로 충분.
  },
}
```

### 6-3. GoogleProvider

```typescript
// apps/mobile/src/auth/providers/GoogleProvider.ts

import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'
import type { AuthProvider, OidcProviderResult } from './types'

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['email', 'profile'],
})

// ⚠️ v3.1: 이 흐름은 nonce를 발급/전달하지 않는다. 따라서 Supabase Google provider의
// "Skip nonce checks"를 ON으로 둬야 id_token 검증이 통과한다 (§0-5, ADR-052).
// Apple과 달리 nonce를 안 보내므로 OidcProviderResult.nonce도 undefined.

export const GoogleProvider: AuthProvider = {
  name: 'google',

  // GPT #6: iOS는 hasPlayServices 미동작 → 분기
  isAvailable: async () => {
    if (Platform.OS === 'ios') return true
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
      return true
    } catch {
      return false
    }
  },

  signIn: async (): Promise<OidcProviderResult> => {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices()
      }
      const userInfo = await GoogleSignin.signIn()
      const idToken = userInfo.data?.idToken
      if (!idToken) throw new Error('[GoogleProvider] idToken 누락')
      return { kind: 'oidc', provider: 'google', idToken }
    } catch (err: any) {
      if (err?.code === statusCodes.SIGN_IN_CANCELLED) {
        throw new Error('USER_CANCELLED')
      }
      throw err
    }
  },

  signOut: async () => {
    await GoogleSignin.signOut()
  },
}
```

### 6-4. KakaoProvider

```typescript
// apps/mobile/src/auth/providers/KakaoProvider.ts

import { login as kakaoLogin, logout as kakaoLogout } from '@react-native-seoul/kakao-login'
import type { AuthProvider, KakaoProviderResult } from './types'

export const KakaoProvider: AuthProvider = {
  name: 'kakao',
  isAvailable: async () => true,

  signIn: async (): Promise<KakaoProviderResult> => {
    const result = await kakaoLogin()
    if (!result.accessToken) {
      throw new Error('[KakaoProvider] accessToken 누락')
    }
    return { kind: 'kakao', accessToken: result.accessToken }
  },

  signOut: async () => {
    try {
      await kakaoLogout()
    } catch {
      // 이미 로그아웃 상태일 수 있음
    }
  },
}
```

### 6-5. AuthService (linkIdentity 메인 + spike 실패 폴백)

```typescript
// apps/mobile/src/auth/AuthService.ts

import { supabaseNative as supabase } from './supabaseNative'
import * as session from './session'
import { setCurrentSession, clearCurrentSession } from './sessionState'
import { broadcastToWebViews, broadcastSession } from './broadcast'
import type {
  AuthProvider,
  AuthProviderName,
  AuthProviderResult,
  OidcProviderResult,
} from './providers/types'
import { AppleProvider } from './providers/AppleProvider'
import { GoogleProvider } from './providers/GoogleProvider'
import { KakaoProvider } from './providers/KakaoProvider'

const providers: Record<AuthProviderName, AuthProvider> = {
  apple: AppleProvider,
  google: GoogleProvider,
  kakao: KakaoProvider,
}

/**
 * GPT #3: Kakao linked는 Supabase identity가 아니라 auth_provider_links 매핑.
 * 용어를 구분해 면접/리뷰에서 과장 방지.
 */
export type SignInResult =
  | { mode: 'identity-linked'; userId: string } // Apple/Google linkIdentity 성공
  | { mode: 'custom-linked'; userId: string } // Kakao auth_provider_links 매핑 성공
  | { mode: 'signed-in'; userId: string; conflict: boolean }

export class AuthService {
  /**
   * 익명 세션 보장.
   * GPT #9: stored token으로 setSession 후 getSession()으로 full session 받기.
   */
  static async ensureAnonymousSession(): Promise<void> {
    const stored = await session.load()
    if (stored) {
      const { error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      })
      if (!error) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await session.save(data.session)
          setCurrentSession(data.session)
          broadcastSession(data.session)
          return
        }
      }
      await session.clear()
    }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (data.session) {
      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
    }
  }

  static async listAvailableProviders(): Promise<AuthProviderName[]> {
    const checks = await Promise.all(
      (Object.keys(providers) as AuthProviderName[]).map(async (name) => ({
        name,
        available: await providers[name].isAvailable(),
      })),
    )
    return checks.filter((c) => c.available).map((c) => c.name)
  }

  /**
   * 소셜 로그인 + 익명→소셜 승격.
   *
   * Apple/Google 메인 경로 (spike ✅):
   *   linkIdentity({ provider, token, access_token, nonce })
   *   → 같은 user.id 유지 + identity 추가
   *
   * Apple/Google 폴백 경로 (spike ❌):
   *   signInWithIdToken({ provider, token, nonce })
   *   → 새 user 생성, 익명 데이터는 10-2 충돌 처리 RPC에서 이전
   *
   * Kakao 경로: Edge Function 경유 (§9)
   */
  static async signInWithProvider(name: AuthProviderName): Promise<SignInResult> {
    const provider = providers[name]
    if (!provider) throw new Error(`[AuthService] unknown provider: ${name}`)

    const result = await provider.signIn()

    if (result.kind === 'kakao') {
      return AuthService.signInWithKakaoToken(result.accessToken)
    }

    // Apple/Google (OIDC)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    const wasAnonymous = !!currentUser?.is_anonymous

    if (wasAnonymous) {
      const linked = await AuthService.tryLinkIdentity(result)
      if (linked) {
        await AuthService.ensureUsersProviderUpdated(linked.userId, result.provider)
        return { mode: 'identity-linked', userId: linked.userId }
      }
      // linkIdentity 실패 = spike 실패 시나리오 또는 이미 가입된 소셜 계정
    }

    // 폴백 또는 신규 로그인
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: result.provider,
      token: result.idToken,
      nonce: result.nonce,
    })
    if (error) throw error
    if (!data.session) throw new Error('[AuthService] session 누락')

    await session.save(data.session)
    setCurrentSession(data.session)
    broadcastSession(data.session)
    await AuthService.ensureUsersProviderUpdated(data.session.user.id, result.provider)

    return {
      mode: 'signed-in',
      userId: data.session.user.id,
      conflict: wasAnonymous, // 익명이었는데 새 user 생성 = 데이터 이전 필요 (10-2)
    }
  }

  /**
   * linkIdentity 메인 경로. ✅ spike 통과 확정 (2026-05-20, supabase-js 2.105.4).
   * 익명 user.id 유지 + is_anonymous false + identities 추가 + app_metadata.provider 갱신 확인.
   *
   * as any 유지 사유 (ADR-043): SDK 타입 정의에 token 파라미터가 아직 없어
   * 컴파일러가 인식 못 함(런타임 정상 동작). 검증된 예외이며, SDK 타입이 token을
   * 명시하는 버전이 나오면 as any 제거. 그 전까지는 이 주석으로 사유 명시.
   *
   * 주의: linkIdentity 응답의 user.identities는 빈 배열로 오므로,
   * identity 확인이 필요하면 응답이 아니라 getSession()/getUser() 결과를 신뢰할 것.
   * 실패 시 null 반환 → 호출 측이 signInWithIdToken으로 폴백 (안전망).
   */
  private static async tryLinkIdentity(
    result: OidcProviderResult,
  ): Promise<{ userId: string } | null> {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: result.provider,
        token: result.idToken,
        access_token: result.accessToken,
        nonce: result.nonce,
      } as any) // ADR-043: SDK 타입 미비로 인한 검증된 예외
      if (error) return null

      const { data } = await supabase.auth.getSession()
      if (!data.session) return null

      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
      return { userId: data.session.user.id }
    } catch {
      return null
    }
  }

  /**
   * Kakao 토큰 교환 (Edge Function 경유).
   * GPT #17: functions.invoke가 Authorization을 자동 주입하는지 검증.
   * 누락되면 명시적 헤더 fallback (아래 코드).
   */
  private static async signInWithKakaoToken(kakaoAccessToken: string): Promise<SignInResult> {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    const wasAnonymous = !!currentUser?.is_anonymous

    // 명시적 Authorization fallback (자동 주입 검증 안 됐을 때 안전)
    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('kakao-token-exchange', {
      body: { kakaoAccessToken },
      headers: currentSession?.access_token
        ? { Authorization: `Bearer ${currentSession.access_token}` }
        : undefined,
    })

    if (error) {
      // GPT #5: 409는 conflict 케이스로 전환
      const status = (error as any).context?.response?.status
      if (status === 409) {
        return {
          mode: 'signed-in',
          userId: currentUser?.id ?? '',
          conflict: true,
        }
      }
      throw error
    }
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error('[AuthService] Kakao 토큰 교환 응답 누락')
    }

    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    })
    if (setErr) throw setErr

    const { data: sessionData } = await supabase.auth.getSession()
    if (!sessionData.session) throw new Error('[AuthService] session 누락 (Kakao)')

    await session.save(sessionData.session)
    setCurrentSession(sessionData.session)
    broadcastSession(sessionData.session)
    await AuthService.ensureUsersProviderUpdated(sessionData.session.user.id, 'kakao')

    return {
      mode: data.linked ? 'custom-linked' : 'signed-in',
      userId: sessionData.session.user.id,
      conflict: !data.linked && wasAnonymous,
    }
  }

  /**
   * fallback (ADR-054): 주 경로는 트리거다.
   * spike 결과 linkIdentity 후 app_metadata.provider가 자동 갱신됨이 확인되어
   * §4-1 on_auth_user_updated 트리거가 public.users.provider를 갱신한다.
   * 이 메서드는 트리거가 어떤 이유로든 누락했을 때의 방어적 fallback (best effort).
   */
  private static async ensureUsersProviderUpdated(userId: string, provider: string) {
    try {
      await supabase.from('users').update({ provider }).eq('id', userId).eq('provider', 'anonymous') // 익명에서 처음 바뀔 때만
    } catch {
      // 갱신 실패해도 인증은 성공이므로 무시 (best effort)
    }
  }

  /**
   * GPT #14: signOut에서 모든 provider best-effort.
   * linkIdentity 후 app_metadata.provider가 정확히 들어온다는 보장 약함.
   */
  static async signOut(): Promise<void> {
    await Promise.allSettled(Object.values(providers).map((p) => p.signOut()))
    await supabase.auth.signOut()
    await session.clear()
    clearCurrentSession()
    broadcastToWebViews({ type: 'AUTH_LOGOUT' })
    // 무인증 상태로 두지 않음
    await AuthService.ensureAnonymousSession()
  }

  static async refreshSession(): Promise<void> {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      await session.clear()
      clearCurrentSession()
      await AuthService.ensureAnonymousSession()
      return
    }
    if (data.session) {
      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
    }
  }
}
```

---

## 7. SessionState (lazy mount 대응)

```typescript
// apps/mobile/src/auth/sessionState.ts

import type { Session } from '@supabase/supabase-js'

let currentSession: Session | null = null

export function setCurrentSession(s: Session | null) {
  currentSession = s
}

export function getCurrentSession(): Session | null {
  return currentSession
}

export function clearCurrentSession() {
  currentSession = null
}
```

WebViewScreen에서 WEB_READY 수신 시 `getCurrentSession()` 호출해서 그 WebView에 즉시 주입 (§10-2 참조).

---

## 8. SecureStore

```typescript
// apps/mobile/src/auth/session.ts

import * as SecureStore from 'expo-secure-store'
import type { Session } from '@supabase/supabase-js'

const KEY = 'isakok.session.v1'

interface StoredSession {
  access_token: string
  refresh_token: string
}

export async function load(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    await SecureStore.deleteItemAsync(KEY)
    return null
  }
}

export async function save(session: Session) {
  await SecureStore.setItemAsync(
    KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  )
}

export async function clear() {
  await SecureStore.deleteItemAsync(KEY)
}
```

---

## 9. Kakao 토큰 교환 Edge Function

```typescript
// supabase/functions/kakao-token-exchange/index.ts

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

const KAKAO_USER_API = 'https://kapi.kakao.com/v2/user/me'

interface RequestBody {
  kakaoAccessToken: string
  // GPT #7-2: currentAnonymousUserId를 body로 받지 않음 (보안)
}

serve(async (req) => {
  // GPT #18: verify_jwt: true 기본 유지 (config.toml에 변경 없음)
  // 별도 명시 안 해도 기본값. supabase functions deploy 시 --no-verify-jwt 사용 금지.

  // GPT #18: POST만 허용
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method Not Allowed')
  }

  try {
    // GPT #7-2: Authorization JWT 검증, body 신뢰 안 함
    const authHeader = req.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return errorResponse(401, 'Authorization 헤더 누락')
    }

    const body = (await req.json()) as RequestBody
    if (!body.kakaoAccessToken) return errorResponse(400, 'kakaoAccessToken 누락')

    // 호출자 JWT로 user 검증
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      {
        global: { headers: { Authorization: authHeader } },
        auth: { persistSession: false, autoRefreshToken: false },
      },
    )
    const { data: userData, error: userErr } = await userClient.auth.getUser()
    if (userErr || !userData.user) return errorResponse(401, 'JWT 검증 실패')

    const currentAnonymousUserId = userData.user.is_anonymous ? userData.user.id : null

    // 1) Kakao 유저 정보
    const kakaoRes = await fetch(KAKAO_USER_API, {
      headers: { Authorization: `Bearer ${body.kakaoAccessToken}` },
    })
    if (!kakaoRes.ok) return errorResponse(401, 'Kakao 토큰 검증 실패')
    const kakaoUser = await kakaoRes.json()
    const kakaoId = String(kakaoUser.id)
    const realEmail = kakaoUser.kakao_account?.email as string | undefined

    // 2) Admin 클라이언트
    const admin = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    )

    // 3) 매핑 테이블 조회 (GPT #7-3: listUsers 제거)
    const { data: existingLink } = await admin
      .from('auth_provider_links')
      .select('user_id')
      .eq('provider', 'kakao')
      .eq('provider_user_id', kakaoId)
      .maybeSingle()

    let userId: string
    let linked = false
    let loginEmail: string

    if (existingLink) {
      userId = existingLink.user_id

      // GPT #4: 같은 익명 user에 이미 Kakao 매핑이 있는 케이스
      if (currentAnonymousUserId && existingLink.user_id === currentAnonymousUserId) {
        linked = true
      } else {
        linked = false
      }

      const { data: existingUser } = await admin.auth.admin.getUserById(userId)
      loginEmail = existingUser.user?.email ?? `kakao_${kakaoId}@isakok.invalid`
    } else if (currentAnonymousUserId) {
      // 익명 user에 Kakao 매핑 추가
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { error: updErr } = await admin.auth.admin.updateUserById(currentAnonymousUserId, {
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      // GPT #5: email 충돌은 409 Conflict
      if (updErr) {
        const msg = updErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT')
        }
        return errorResponse(500, `updateUser 실패: ${updErr.message}`)
      }

      const { error: linkErr } = await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: currentAnonymousUserId,
      })
      if (linkErr) return errorResponse(500, `link 실패: ${linkErr.message}`)

      userId = currentAnonymousUserId
      loginEmail = email
      linked = true
    } else {
      // 신규 user 생성 (anonymous 없는 상태에서 Kakao 로그인)
      const email = realEmail ?? `kakao_${kakaoId}@isakok.invalid`
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { kakao_id: kakaoId, provider: 'kakao' },
        app_metadata: { provider: 'kakao' },
      })
      if (createErr) {
        const msg = createErr.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          return errorResponse(409, 'KAKAO_EMAIL_CONFLICT')
        }
        return errorResponse(500, createErr.message)
      }
      userId = created.user.id

      await admin.from('auth_provider_links').insert({
        provider: 'kakao',
        provider_user_id: kakaoId,
        user_id: userId,
      })
      loginEmail = email
    }

    // 4) magic link + verifyOtp 교환 (ADR-044)
    const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: loginEmail,
    })
    if (linkErr) return errorResponse(500, linkErr.message)
    const tokenHash = link.properties.hashed_token

    const anon = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
      auth: { autoRefreshToken: false, persistSession: false },
    })
    const { data: verified, error: verifyErr } = await anon.auth.verifyOtp({
      type: 'magiclink',
      token_hash: tokenHash,
    })
    if (verifyErr) return errorResponse(500, verifyErr.message)
    if (!verified.session) return errorResponse(500, 'session 발급 실패')

    return new Response(
      JSON.stringify({
        access_token: verified.session.access_token,
        refresh_token: verified.session.refresh_token,
        linked,
        user_id: userId,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    )
  } catch (err) {
    return errorResponse(500, err instanceof Error ? err.message : 'unknown')
  }
})

function errorResponse(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}
```

> **GPT #6 (CORS origin 제한)**: 현재 공통 `corsHeaders`는 `*` 허용일 가능성. 10-2에서 dev/prod Vercel origin만 허용으로 좁힘. 10-1엔 prod 비공개 정책으로 노출 위험 차단.
> **GPT #7 (rate limit)**: 이 함수는 service_role을 사용해 user 생성/매핑/로그인을 수행. **prod URL 외부 공개 전까지 반드시 rate limit 구현** (10-2 작업). 최소 기준: auth.uid() 분당 5회, IP 시간당 30회, Kakao token 검증 실패 반복 시 임시 차단.

---

## 10. 브릿지

### 10-1. 메시지 타입 (`packages/shared/src/types/bridge.ts`)

```typescript
export type WebToNativeMessage =
  | { type: 'OPEN_CAMERA'; payload: { room: string; photoType: 'move_in' | 'move_out' } }
  | {
      type: 'REQUEST_LOGIN'
      payload?: {
        source: 'onboarding_top' | 'photo_gate' | 'completion_cta' | 'ai_regenerate' | 'settings'
      }
    }
  | { type: 'REQUEST_LOGOUT' }
  | { type: 'REQUEST_SESSION_REFRESH' } // 신규 (10-1)
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'SHARE_REPORT'; payload: { url: string } }
  | { type: 'WEB_READY' }
  | { type: 'ROUTE_CHANGE'; payload: { path: string } }

export type NativeToWebMessage =
  | {
      type: 'AUTH_SESSION' // payload 확장 (9단계: { token, userId } → 10-1: full)
      payload: {
        access_token: string
        refresh_token: string
        expires_at: number
        user_id: string
        is_anonymous: boolean
      }
    }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'PHOTO_TAKEN'; payload: { uri: string; exif: Record<string, unknown>; hash: string } }
  | { type: 'NETWORK_STATUS'; payload: { online: boolean } }
  | { type: 'PLATFORM_INFO'; payload: { os: 'ios' | 'android'; isNative: true } }

export interface BridgeMessage<T = WebToNativeMessage | NativeToWebMessage> {
  version: 1
  timestamp: number
  data: T
}
```

### 10-2. broadcast (BridgeMessage wrapper)

```typescript
// apps/mobile/src/auth/broadcast.ts

import type { WebView } from 'react-native-webview'
import type { BridgeMessage, NativeToWebMessage } from '@moving/shared/types/bridge'
import type { Session } from '@supabase/supabase-js'

const activeWebViews = new Set<WebView>()

export function registerWebView(wv: WebView | null): () => void {
  if (!wv) return () => undefined
  activeWebViews.add(wv)
  return () => {
    activeWebViews.delete(wv)
  }
}

function wrapMessage(message: NativeToWebMessage): string {
  const wrapped: BridgeMessage<NativeToWebMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }
  return JSON.stringify(wrapped)
}

function buildScript(json: string): string {
  return `
    (function() {
      try {
        window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} }));
      } catch (e) {}
    })();
    true;
  `
}

export function broadcastToWebViews(message: NativeToWebMessage): void {
  const json = wrapMessage(message)
  const script = buildScript(json)
  for (const wv of activeWebViews) {
    try {
      wv.injectJavaScript(script)
    } catch {}
  }
}

/** 특정 WebView에만 세션 주입 (WEB_READY 응답용 — lazy mount 대응) */
export function sendSessionToWebView(wv: WebView, session: Session): void {
  const message: NativeToWebMessage = {
    type: 'AUTH_SESSION',
    payload: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: session.user.id,
      is_anonymous: !!session.user.is_anonymous,
    },
  }
  const json = wrapMessage(message)
  wv.injectJavaScript(buildScript(json))
}

/** AuthService에서 세션 갱신 시 호출 */
export function broadcastSession(session: Session): void {
  broadcastToWebViews({
    type: 'AUTH_SESSION',
    payload: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: session.user.id,
      is_anonymous: !!session.user.is_anonymous,
    },
  })
}
```

### 10-3. WebView 메시지 라우팅 (lazy mount 대응 포함)

```typescript
// apps/mobile/src/components/WebViewScreen.tsx (관련 부분)

import { router } from 'expo-router'
import { Linking } from 'react-native'
import type { WebViewMessageEvent } from 'react-native-webview'
import { AuthService } from '../auth/AuthService'
import { getCurrentSession } from '../auth/sessionState'
import { sendSessionToWebView } from '../auth/broadcast'
import { hideSplashOnce } from '../utils/splash'
import type { BridgeMessage, WebToNativeMessage } from '@moving/shared/types/bridge'

function handleMessage(event: WebViewMessageEvent, webViewRef: any) {
  let wrapped: BridgeMessage<WebToNativeMessage>
  try {
    wrapped = JSON.parse(event.nativeEvent.data)
  } catch {
    return
  }
  if (!wrapped || wrapped.version !== 1 || !wrapped.data?.type) return
  const message = wrapped.data

  switch (message.type) {
    case 'WEB_READY': {
      hideSplashOnce()
      // GPT #3 (lazy mount 대응): 새 WebView에 현재 세션 즉시 주입
      const session = getCurrentSession()
      if (session && webViewRef.current) {
        sendSessionToWebView(webViewRef.current, session)
      }
      return
    }
    case 'REQUEST_LOGIN':
      router.push('/auth')
      return
    case 'REQUEST_LOGOUT':
      AuthService.signOut().catch((err) => console.error('[signOut]', err))
      return
    case 'REQUEST_SESSION_REFRESH':
      AuthService.refreshSession().catch((err) => console.error('[refresh]', err))
      return
    case 'OPEN_EXTERNAL_LINK':
      Linking.openURL(message.payload.url).catch(() => undefined)
      return
  }
}
```

### 10-4. 웹 측 수신

```typescript
// apps/web/src/auth/webSessionListener.ts

import { supabase } from '@moving/shared/lib/supabase'
import type { BridgeMessage, NativeToWebMessage } from '@moving/shared/types/bridge'

let attached = false

export function setupWebSessionListener() {
  if (attached) return
  attached = true

  window.addEventListener('message', async (event) => {
    let wrapped: BridgeMessage<NativeToWebMessage>
    try {
      wrapped = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      return
    }
    if (!wrapped || wrapped.version !== 1 || !wrapped.data?.type) return

    const message = wrapped.data
    if (message.type === 'AUTH_SESSION') {
      const { error } = await supabase.auth.setSession({
        access_token: message.payload.access_token,
        refresh_token: message.payload.refresh_token,
      })
      if (error) console.error('[webSessionListener] setSession', error)
    } else if (message.type === 'AUTH_LOGOUT') {
      await supabase.auth.signOut({ scope: 'local' })
    }
  })
}
```

### 10-5. 웹→네이티브 전송

```typescript
// packages/shared/src/utils/nativeBridge.ts

import type { BridgeMessage, WebToNativeMessage } from '../types/bridge'

export function sendToNative(message: WebToNativeMessage): void {
  if (typeof window === 'undefined') return
  if (!window.ReactNativeWebView) {
    console.log('[sendToNative] (no-op in browser)', message)
    return
  }
  const wrapped: BridgeMessage<WebToNativeMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }
  window.ReactNativeWebView.postMessage(JSON.stringify(wrapped))
}
```

---

## 11. 웹 Supabase 클라이언트 + 401 인터셉터

### 11-1. 클라이언트 (네이티브 환경 분기)

```typescript
// packages/shared/src/lib/supabase.ts

import { createClient } from '@supabase/supabase-js'
import { isNativeWebView } from '../utils/platform'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

const isNative = isNativeWebView()

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: !isNative,
    autoRefreshToken: !isNative,
    detectSessionInUrl: false,
  },
})
```

### 11-2. 401 인터셉터 (debounce 5초)

```typescript
// apps/web/src/auth/authError.ts

import { sendToNative } from '@moving/shared/utils/nativeBridge'
import { isNativeWebView } from '@moving/shared/utils/platform'

let refreshing = false
let lastRequestedAt = 0

export function handleAuthError(error: { status?: number; code?: string } | null | undefined) {
  if (!error) return
  const isUnauthorized = error.status === 401 || error.code === 'PGRST301' || error.code === '401'
  if (!isUnauthorized) return
  if (!isNativeWebView()) return // 브라우저는 자체 갱신

  const now = Date.now()
  if (refreshing && now - lastRequestedAt < 5000) return
  refreshing = true
  lastRequestedAt = now
  sendToNative({ type: 'REQUEST_SESSION_REFRESH' })
  setTimeout(() => {
    refreshing = false
  }, 5000)
}
```

### 11-3. queryClient 등록

```typescript
// apps/web/src/lib/queryClient.ts

// GPT #15: import 명시
import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { handleAuthError } from '../auth/authError'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => handleAuthError(err as any),
  }),
  mutationCache: new MutationCache({
    onError: (err) => handleAuthError(err as any),
  }),
})
```

> **GPT #13 (proactive refresh)**: 10-1은 401-driven (한 번의 실패 요청 발생). 사용 중 401 UX가 빈번하면 10-2에서 Native가 `expires_at - 60s` 시점에 proactive refresh + broadcast 추가.

---

## 12. 부트스트랩

```typescript
// apps/mobile/src/auth/bootstrap.ts

import { AuthService } from './AuthService'

let bootstrapped = false

export async function bootstrapAuth(): Promise<void> {
  if (bootstrapped) return
  bootstrapped = true
  try {
    await AuthService.ensureAnonymousSession()
  } catch (err) {
    bootstrapped = false // GPT #10: 재시도 가능
    throw err
  }
}
```

```typescript
// apps/mobile/src/app/_layout.tsx (관련 부분)

import { useEffect, useState } from 'react'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { bootstrapAuth } from '../auth/bootstrap'

SplashScreen.preventAutoHideAsync().catch(() => undefined)

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    bootstrapAuth()
      .catch((err) => console.error('[bootstrap]', err))
      .finally(() => setReady(true))
  }, [])

  if (!ready) return null
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="auth" options={{ presentation: 'modal' }} />
    </Stack>
  )
}
```

---

## 13. 네이티브 로그인 화면

```typescript
// apps/mobile/src/app/auth.tsx

import { useEffect, useMemo, useState } from 'react'
import { View, Text, Pressable, Platform, ActivityIndicator, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { AuthService } from '../auth/AuthService'
import type { AuthProviderName } from '../auth/providers/types'

const LABEL: Record<AuthProviderName, string> = {
  apple: 'Apple',
  google: 'Google',
  kakao: '카카오',
}

export default function AuthScreen() {
  const [available, setAvailable] = useState<AuthProviderName[]>([])
  const [loading, setLoading] = useState<AuthProviderName | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [conflictStuck, setConflictStuck] = useState(false)

  useEffect(() => {
    AuthService.listAvailableProviders().then(setAvailable)
  }, [])

  const ordered = useMemo(() => {
    const arr = available.slice()
    arr.sort((a, b) => {
      if (Platform.OS === 'ios') {
        if (a === 'apple') return -1
        if (b === 'apple') return 1
      } else {
        if (a === 'kakao') return -1
        if (b === 'kakao') return 1
      }
      return 0
    })
    return arr
  }, [available])

  const onProvider = async (name: AuthProviderName) => {
    setError(null)
    setLoading(name)
    try {
      const result = await AuthService.signInWithProvider(name)

      // GPT #16: conflict 시 화면 유지
      if (result.mode === 'signed-in' && result.conflict) {
        setError(
          '이미 가입된 계정이에요. 다음 업데이트에서 이전 기기 데이터 합치기를 제공할 예정입니다.',
        )
        setConflictStuck(true)
        return
      }
      router.replace('/')
    } catch (err: any) {
      if (err?.message === 'USER_CANCELLED') return
      setError(err?.message ?? '로그인에 실패했어요')
    } finally {
      setLoading(null)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title} accessibilityRole="header">이사 기록을 안전하게</Text>
      <Text style={styles.subtitle}>로그인하면 폰을 바꿔도 데이터가 그대로 유지돼요</Text>

      <View style={styles.buttons}>
        {ordered.map((name) => (
          <Pressable
            key={name}
            accessibilityRole="button"
            accessibilityLabel={`${LABEL[name]}로 로그인`}
            accessibilityState={{ disabled: !!loading }}
            onPress={() => onProvider(name)}
            disabled={!!loading}
            style={({ pressed }) => [
              styles.button,
              styles[`btn_${name}` as const],
              pressed && styles.pressed,
            ]}
          >
            {loading === name ? (
              <ActivityIndicator />
            ) : (
              <Text style={styles.buttonText}>{LABEL[name]}로 시작하기</Text>
            )}
          </Pressable>
        ))}
      </View>

      {error && (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      )}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={conflictStuck ? '홈으로 돌아가기' : '로그인 없이 계속하기'}
        onPress={() => router.replace('/')}
        style={styles.skip}
      >
        <Text style={styles.skipText}>{conflictStuck ? '홈으로 돌아가기' : '나중에 할게요'}</Text>
      </Pressable>
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center', backgroundColor: '#F8F7F5' },
  title: { fontSize: 24, fontWeight: '700', color: '#333344', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#666', marginBottom: 32 },
  buttons: { gap: 12 },
  button: { minHeight: 48, paddingHorizontal: 16, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  btn_apple: { backgroundColor: '#000' },
  btn_google: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#dadce0' },
  btn_kakao: { backgroundColor: '#FEE500' },
  buttonText: { fontSize: 16, fontWeight: '600' },
  pressed: { opacity: 0.85 },
  error: { marginTop: 16, color: '#EF4444', fontSize: 14 },
  skip: { marginTop: 24, alignSelf: 'center', padding: 12 },
  skipText: { fontSize: 14, color: '#999', textDecorationLine: 'underline' },
})
```

---

## 14. useSession 훅 (apps/web 위치)

```typescript
// apps/web/src/auth/useSession.ts

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@moving/shared/lib/supabase'

const SESSION_KEY = ['auth', 'session'] as const

export function useSession() {
  const qc = useQueryClient()

  useEffect(() => {
    // GPT #13: v2 API는 data.subscription
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: SESSION_KEY })
    })
    return () => subscription.unsubscribe()
  }, [qc])

  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    },
    staleTime: 1000 * 60,
  })
}

/**
 * GPT #15: loading/null/실제 ID 구분
 */
export function useUserId() {
  const query = useSession()
  return {
    userId: query.data?.user?.id ?? null,
    isLoading: query.isLoading,
    isAnonymous: query.data?.user?.is_anonymous ?? null,
  }
}
```

---

## 15. TEMP_USER_ID 제거 (SELECT/UPDATE/DELETE 포함)

### 15-1. 검색

```bash
grep -rn "00000000-0000-0000-0000-000000000000\|TEMP_USER_ID" apps/web/src/ packages/shared/src/
```

### 15-2. service 함수 교체 패턴

**GPT #16: INSERT만이 아니라 SELECT/UPDATE/DELETE 모두 user_id 필터 필수** (RLS 활성화 전이라 클라이언트 필터링이 유일한 격리 수단).

```typescript
// 기존
export async function getMoves() {
  const userId = TEMP_USER_ID
  return supabase.from('moves').select('*').eq('user_id', userId).is('deleted_at', null)
}

// 변경
export async function getMoves(userId: string) {
  return supabase.from('moves').select('*').eq('user_id', userId).is('deleted_at', null)
}

export async function updateMove(userId: string, moveId: string, patch: Partial<Move>) {
  return supabase.from('moves').update(patch).eq('id', moveId).eq('user_id', userId)
  //                                                            ^^^^^^^^^^^^^^^^^^^^^^^
  //                                                            user_id 필터 필수
}

export async function softDeleteMove(userId: string, moveId: string) {
  return supabase
    .from('moves')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', moveId)
    .eq('user_id', userId)
}
```

### 15-3. 호출 측

```typescript
const { userId, isLoading } = useUserId()

// useQuery 안에서:
useQuery({
  queryKey: ['moves', userId],
  queryFn: () => getMoves(userId!),
  enabled: !!userId, // 세션 로딩 중엔 쿼리 안 실행
})

// useMutation 안에서:
useMutation({
  mutationFn: ({ moveId, patch }) => {
    if (!userId) throw new Error('세션 없음')
    return updateMove(userId, moveId, patch)
  },
})
```

### 15-4. RPC `createMoveWithChecklist` 검증

기존 RPC가 `user_id` 매개변수를 받는지 확인. 받으면 호출 측에서 `userId` 전달. 받지 않고 `auth.uid()` 직접 호출하면 그대로 (RLS 미활성이어도 JWT는 검증됨).

---

## 16. 온보딩 우상단 로그인 버튼

```typescript
// apps/web/src/pages/OnboardingPage.tsx (관련 부분)

import { useSession } from '../auth/useSession'
import { sendToNative } from '@moving/shared/utils/nativeBridge'

function LoginEntryButton() {
  const { data: session } = useSession()
  if (session?.user && !session.user.is_anonymous) return null

  return (
    <button
      type="button"
      onClick={() =>
        sendToNative({
          type: 'REQUEST_LOGIN',
          payload: { source: 'onboarding_top' },
        })
      }
      className="text-sm text-text-secondary hover:text-text-primary focus:outline focus:outline-2 focus:outline-primary rounded px-2 py-1"
    >
      로그인
    </button>
  )
}
```

---

## 17. Spike 절차 (본 구현 직전 30분~1시간)

이 spike는 **본 구현 진입 직전에 실시**. spike 코드는 본 구현 전에 폐기.

### 17-1. 사전 조건

- §0 사전 작업 완료 (Manual Linking ON 필수)
- Apple 또는 Google OAuth client 설정 완료
- iOS 시뮬레이터 또는 Android 에뮬레이터 동작

### 17-2. 검증 가설

```
가설: supabase.auth.linkIdentity({ provider, token, access_token, nonce }) 호출 시
      익명 user에 identity가 추가되며 user.id는 그대로 유지된다.
```

### 17-3. 절차

`apps/mobile/src/app/spike.tsx` 임시 생성 (본 구현 전 폐기):

```typescript
import { useState } from 'react'
import { View, Button, Text, Alert } from 'react-native'
import { supabaseNative as supabase } from '../auth/supabaseNative'
import { GoogleProvider } from '../auth/providers/GoogleProvider'

export default function SpikeScreen() {
  const [log, setLog] = useState('')
  const append = (s: string) => setLog((prev) => prev + s + '\n')

  const run = async () => {
    setLog('')

    // 1. 익명 가입
    const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously()
    if (anonErr) { append('익명 가입 실패: ' + anonErr.message); return }
    const anonId = anon.session!.user.id
    append(`익명 user.id = ${anonId}`)
    append(`is_anonymous = ${anon.session!.user.is_anonymous}`)

    // 2. Google native sign-in
    let oidc: any
    try {
      oidc = await GoogleProvider.signIn()
      append(`Google idToken 획득: ${oidc.idToken.slice(0, 20)}...`)
    } catch (err: any) {
      append('Google sign-in 실패: ' + err.message); return
    }

    // 3. linkIdentity 시도
    const { data: linkData, error: linkErr } = await supabase.auth.linkIdentity({
      provider: 'google',
      token: oidc.idToken,
    } as any)
    append(`linkIdentity error: ${linkErr?.message ?? 'null'}`)
    append(`linkIdentity data: ${JSON.stringify(linkData)}`)

    // 4. 현재 user 확인
    const { data: { user } } = await supabase.auth.getUser()
    append(`현재 user.id = ${user?.id}`)
    append(`is_anonymous = ${user?.is_anonymous}`)
    append(`identities count = ${user?.identities?.length ?? 0}`)
    append(`identities = ${JSON.stringify(user?.identities?.map(i => i.provider))}`)

    // 5. 판정
    if (user?.id === anonId && !user.is_anonymous && (user.identities?.length ?? 0) >= 1) {
      append('\n✅ SPIKE 통과: link 성공, 같은 user.id 유지')
    } else if (user?.id !== anonId) {
      append('\n❌ SPIKE 실패: 새 user 생성됨. 폴백 경로 필요')
    } else {
      append('\n⚠️ SPIKE 미결정: 결과 확인 필요')
    }
  }

  return (
    <View style={{ padding: 24 }}>
      <Button title="Spike 실행" onPress={run} />
      <Text selectable style={{ marginTop: 16, fontFamily: 'monospace' }}>{log}</Text>
    </View>
  )
}
```

### 17-4. 판정 결과별 분기

| 결과                                                              | v3 본 구현 대응                                                                                                                                                              |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| ✅ `user.id === anonId && !is_anonymous && identities.length ≥ 1` | **메인 경로 확정.** `AuthService.tryLinkIdentity` 그대로 + `as any` 제거 + 정식 타입으로 호출                                                                                |
| ❌ `user.id !== anonId` (새 user 생성)                            | **폴백 경로.** `tryLinkIdentity` 호출 자체 스킵, `signInWithIdToken`만 사용. `conflict: true` 케이스가 익명→소셜 케이스에도 발생 → 10-2 충돌 처리 RPC가 본 마이그레이션 담당 |
| ⚠️ 에러 `"manual linking not enabled"`                            | §0-5 Supabase 콘솔에서 Manual Linking 켜고 재시도                                                                                                                            |
| ⚠️ 에러 `"provider not configured"`                               | §0-5 Apple/Google provider 설정 누락. 재시도                                                                                                                                 |
| ⚠️ 그 외 에러                                                     | 에러 메시지 기록 + Supabase 이슈 트래커 확인 + ADR-050 모니터링 정책 발동                                                                                                    |

### 17-5. 결과 기록

spike 결과를 `docs/specs/10-1-spike-result.md`에 기록:

```markdown
# 10-1 Spike 결과 (Apple/Google linkIdentity native id_token)

## 환경

- supabase-js 버전: X.X.X
- iOS / Android: ...
- Supabase 콘솔 Manual Linking: ON

## 결과

- [ ] ✅ 통과 / [ ] ❌ 실패 / [ ] ⚠️ 미결정

## 로그

(SpikeScreen 출력 붙여넣기)

## 후속 조치

- 본 구현은 [메인 / 폴백] 경로로 진행
- `tryLinkIdentity`의 `as any` [제거 / 유지]
```

---

## 18. ADR (DECISIONS.md 갱신)

### ADR-041~049 (v2에서 확정, v3에서 표현 일부 정정)

(ADR-041 Native session owner, ADR-042 Anonymous Sign-In, ADR-043 linkIdentity 우선, ADR-044 Kakao magic link, ADR-045 Provider 추상화, ADR-046 환경 분리 10-1 진입, ADR-047 BridgeMessage wrapper, ADR-048 Kakao custom mapping, ADR-049 WEB_READY 시 currentSession 주입 — 표현 v2 기준)

**ADR-043 표현 정정 (v3) + spike 결과 확정 (v3.2):**

- 결정: 익명 상태에서 OIDC provider 로그인 시 `linkIdentity({ provider, token })` 우선 시도.
- **spike 결과 (2026-05-20, supabase-js 2.105.4 / google-signin 16.1.2 / iOS Simulator)**: ✅ **통과**. 익명 user.id 유지 + `is_anonymous` false 전환 + `identities: ["google"]` + `app_metadata.provider: "google"` 자동 갱신 확인. `docs/specs/10-1-spike-result.md` 참조.
- **확정: 메인 경로(linkIdentity) 사용.** 폴백 경로(`signInWithIdToken` + `conflict: true` + 10-2 데이터 이전)는 linkIdentity 실패 시 안전망으로 코드에 보존하되 평상시 미사용.
- **`as any` 캐스트 유지**: SDK 타입 정의에 `token` 파라미터가 아직 없어 컴파일러가 인식 못 함(런타임 정상). 검증된 예외로, 8단계 auto-fix의 `as any` 금지에 대한 조건부 허용 — `tryLinkIdentity`에 사유 주석 필수. SDK 타입이 `token`을 명시하는 버전이 나오면 제거.
- 변경 이유: GPT v2 리뷰 #1 — 단정적 표현 위험 → spike로 실측 검증 후 확정.

### ADR-054 신규 (v3.2): linkIdentity 후 provider 갱신은 트리거가 주 경로

- 결정: `linkIdentity` 성공 시 `auth.users.raw_app_meta_data.provider`가 `"google"`/`"apple"`로 **자동 갱신**됨 (spike 실측). 따라서 §4-1의 `on_auth_user_updated` 트리거가 정상 발동해 `public.users.provider`를 갱신한다.
- `ensureUsersProviderUpdated`(§6-5)는 **트리거가 어떤 이유로든 누락했을 때의 fallback**으로 유지. 주 경로 아님.
- 배경: GPT v2 리뷰 #11이 "linkIdentity 후 provider 안 바뀔 수 있다"고 우려했으나, spike에서 자동 갱신 확인되어 우려 해소. fallback은 방어적으로 보존.
- 참고 (디버깅용): `linkIdentity` 응답 객체의 `user.identities`는 빈 배열로 오지만, 직후 `supabase.auth.getUser()` 조회 시 `["google"]` 1건이 정상 표시됨. 응답 즉시 identity 개수를 신뢰하지 말고 `getUser()`로 재확인할 것.

### ADR-050 신규: Manual Linking beta 기능 사용 + 모니터링 정책

- 결정: Supabase Manual Identity Linking은 현재 (2026.05) beta 단계 (Supabase 콘솔 토글에 "(beta)" 표시). 그럼에도 익명→소셜 승격에 필수적이라 사용.
- 대안:
  - (A) Manual Linking 사용 안 함 → 익명 user는 영구 회원으로 전환 불가 (이메일/비번 외)
  - (B) 사용 (채택) — beta 리스크 감수
- 근거: 우리 비즈니스 모델(비회원 우선)이 익명→소셜 승격 의존도 큼. beta 깨지면 데이터 이전 RPC로 폴백 가능(어차피 spike 실패 경로와 동일).
- 모니터링 정책:
  - `supabase-js` 메이저/마이너 버전 올릴 때마다 spike 재실행
  - Supabase changelog의 "Manual Linking" 관련 변경 모니터링
  - linkIdentity 호출 실패율을 Edge Function 로깅으로 추적 (10-2 추가)
- 트레이드오프: beta 변경 가능성 vs 익명 우선 UX 가치. 후자가 충분히 큼.

### ADR-051 신규: Production Vercel을 10-1 동안 dev Supabase에 연결

- 결정: 10-1 작업 중 prod Supabase 외부 노출 위험 차단을 위해 production Vercel deployment 환경변수에 **dev Supabase URL/anon key**를 임시 박음. 10-2 RLS 활성화 + 전수 검증 완료 시점에 prod로 스위치.
- 대안:
  - (A) Vercel Deployment Protection (Vercel Pro 필요, $20/월)
  - (B) production deployment 자체를 안 만듦 (preview만 운영)
  - (C) production을 dev Supabase로 임시 연결 (채택)
- 근거: 비용 0원, 환경 분리 인프라(자동 배포 등)는 미리 구축, 실제 데이터 분리만 10-2 완료 시점에 활성화. 면접 답변: "보안 변경이 잦은 단계에 production 데이터를 노출 안 시키면서도 환경 분리 인프라는 미리 검증."

### ADR-052 신규 (v3.1): Google Skip nonce checks ON

- 결정: Supabase Google provider의 "Skip nonce checks"를 ON으로 둔다.
- 배경: `@react-native-google-signin`은 우리 코드 흐름상 nonce를 발급/전달하지 않는다. Supabase가 id_token의 nonce를 검증하려 하면 검증 대상이 없어 로그인이 실패한다.
- 대안:
  - (A) Skip nonce checks ON (채택) — 즉시 동작, replay 방어 약화
  - (B) `@react-native-google-signin`에 nonce 옵션 전달 + Skip OFF — 더 안전하지만 라이브러리 흐름 추가 작업 필요
- 근거: id_token이 HTTPS 전송 + 짧은 만료시간이라 실질 replay 위험 낮음. Apple은 `expo-apple-authentication`이 nonce를 지원해 우리가 직접 생성·전달하므로(§6-2) nonce 검증이 정상 동작하고 Skip 불필요.
- 개선 항목 (후속): Google에도 nonce 명시 전달해 Skip OFF 전환 (B안). 보안 강화 단계에서 검토.

### ADR-053 신규 (v3.1): Apple/Google provider는 네이티브 Client IDs 검증 방식

- 결정: Supabase Apple/Google provider 설정에서 **Client IDs(audience)만 등록**하고, Apple Secret Key(.p8 기반 JWT)는 미입력한다.
- 배경: 우리는 네이티브 SDK로 id_token을 받아 `signInWithIdToken`/`linkIdentity`로 검증한다. 이 흐름은 id_token 서명 + audience(client ID) 검증만 필요하다. Client Secret/Secret Key는 웹 OAuth redirect 흐름(authorization code → token 교환)에서만 쓰인다.
- 대안:
  - (A) 웹 OAuth 방식으로 Team ID/Key ID/.p8 모두 등록 → 네이티브엔 불필요한 복잡도
  - (B) 네이티브 Client IDs만 등록 (채택)
- 근거: 네이티브 전용 단계에서 불필요한 시크릿 관리 제거. Apple Team ID/Key ID/Services ID/.p8는 메모장에 보관해 향후 웹 Apple 로그인 추가 또는 Secret JWT 필요 시 사용. Google Client Secret은 단순 문자열이라 향후 웹 확장 대비 등록해둠.

---

## 19. 완료 확인 기준 (체크리스트)

### 19-0. 사전 작업 (2026-05-20 완료)

- [x] Apple Developer: App ID + Sign in with Apple Capability + Services ID + Key
- [x] Google Cloud: OAuth Client iOS / Android / Web 3개 + Android SHA-1 등록
- [x] Kakao Developers: 네이티브 앱 키 + 플랫폼 키 등록 + 키해시
- [x] Supabase dev 콘솔: Manual Linking ON, Anonymous ON, Confirm Email OFF
- [x] Supabase dev Apple provider: Client IDs만 (Secret 비움, ADR-053)
- [x] Supabase dev Google provider: Client IDs 3개 + Skip nonce checks ON (ADR-052)
- [x] Vercel: production 환경변수 = dev Supabase 연결 (ADR-051)
- [x] Expo `apps/mobile/.env`: Google/Kakao 키 채움
- [ ] Supabase dev 마이그레이션 00013~00014 — 본 구현에서 생성·적용
- [ ] Supabase prod — 10-2로 미룸 (§0-4)
- [ ] eas.json 빌드 프로파일별 env — 본 구현에서 설정
- [ ] prod URL 외부 비공개 정책 STATUS.md 기록 — 본 구현 시

### 19-1. Spike 결과 반영 (✅ 완료)

- [x] §17 spike 실행 + `docs/specs/10-1-spike-result.md` 기록 (✅ 통과)
- [x] 결과 ✅ → 메인 경로(linkIdentity) 확정, `as any` 유지 (사유 주석 §6-5)
- [x] provider 자동 갱신 확인 → `ensureUsersProviderUpdated`는 fallback으로 유지 (ADR-054)
- [x] 폴백 경로(signInWithIdToken)는 안전망으로 코드 보존

### 19-2. 익명 인증 + 트리거

- [x] dev Anonymous Sign-In 활성화 (prod는 10-2)
- [ ] 마이그레이션 `00013_anonymous_users.sql` + `00014_auth_provider_links.sql` 적용
- [ ] 새 디바이스 첫 실행 → auth.users + public.users 자동 생성
- [ ] 앱 재실행 시 세션 복구 + 같은 user.id 유지
- [ ] 만료 refresh token으로 재실행 시 자동 익명 재가입
- [ ] **디바이스 A/B 첫 실행 시 서로 다른 auth.uid() 발급** ⭐
- [ ] **디바이스 A 데이터가 디바이스 B service layer에서 분리되어 보임** (DB RLS 격리는 10-2)

### 19-3. TEMP_USER_ID 제거

- [ ] grep 0건
- [ ] **모든 SELECT/UPDATE/DELETE에 user_id 필터 명시** (단순 INSERT만이 아님)
- [ ] `useUserId()` 훅 loading/null/실제 ID 구분
- [ ] 신규 INSERT 시 진짜 auth.uid() (DB 직접 조회 확인)

### 19-4. Mobile 전용 client + Auth Service

- [ ] `supabaseNative.ts` 존재, mobile에서 shared web client import 안 함
- [ ] `AuthProvider` 인터페이스 + 3개 구현체 (Apple nonce, Google iOS/Android 분기)
- [ ] iOS 시뮬레이터/실기기: Apple 로그인
- [ ] Google iOS/Android 로그인
- [ ] Kakao iOS/Android 로그인 (Edge Function 경유)
- [ ] **spike 통과한 경우**: 익명→Apple/Google `identity-linked` (user.id 유지)
- [ ] **spike 실패한 경우**: 익명→Apple/Google `signed-in` + `conflict: true` + 안내 메시지
- [ ] Kakao 익명→소셜 `custom-linked` (auth_provider_links 매핑 + user.id 유지)
- [ ] linkIdentity/Kakao 후 `public.users.provider` 갱신 (트리거 또는 fallback update)
- [ ] iOS는 Apple 최상단, Android는 Kakao 최상단

### 19-5. Kakao Edge Function 보안

- [ ] **Authorization JWT 검증 동작** (헤더 없으면 401)
- [ ] **`functions.invoke` Authorization 자동 주입 검증** (네트워크 로그 또는 함수 로그로 확인)
- [ ] `currentAnonymousUserId`를 body로 받지 않음
- [ ] POST만 허용 (GET/PUT 등 405)
- [ ] verify_jwt: true 기본값 유지 (config.toml에 변경 없음)
- [ ] email 충돌 시 409 반환 + 클라이언트가 `conflict: true`로 매핑
- [ ] `auth_provider_links` 매핑 사용 (listUsers 미사용)

### 19-6. 세션 브릿지 + lazy mount

- [ ] BridgeMessage wrapper 형식만 사용 (raw 형식 grep 0건)
- [ ] **늦게 마운트된 WebView도 WEB_READY 후 AUTH_SESSION 수신** ⭐
- [ ] 홈 탭 열고 → 전체 탭 첫 진입 → 두 WebView에서 `supabase.auth.getUser()` 동일 user.id
- [ ] 로그아웃 시 WebView 3개 모두 AUTH_LOGOUT
- [ ] 웹 401 → REQUEST_SESSION_REFRESH → Native 갱신 → 새 세션 broadcast → 재시도 성공
- [ ] 웹 supabase `autoRefreshToken: false` 네이티브 환경에서 확인
- [ ] 401 인터셉터 debounce 5초

### 19-7. 로그인 UI

- [ ] `/auth` route (modal)
- [ ] 사용 가능 provider만 표시
- [ ] 로그인 중 disabled + Spinner
- [ ] **conflict 시 화면 유지** (router.replace 안 함, "홈으로 돌아가기" 버튼)
- [ ] USER_CANCELLED 무시
- [ ] "나중에 할게요"
- [ ] 온보딩 우상단 "로그인" (회원은 숨김)
- [ ] REQUEST_LOGIN → `/auth` 이동

### 19-8. 빌드/린트/테스트

- [ ] `pnpm build` 에러 없음
- [ ] `pnpm lint` 에러 없음
- [ ] `pnpm test` 에러 없음
- [ ] iOS development build 동작
- [ ] Android development build 동작

---

## 20. 다음 단계 연결

10-1 완료 후 → **10-2: TEMP_USER_ID wipe + RLS 활성화 + 충돌 처리 + Kakao rate limit**

10-2 작업:

- prod DB의 잔여 TEMP_USER_ID 데이터 wipe (DB + Storage)
- 6개 테이블 + `auth_provider_links` RLS ENABLE + service_role 정책
- 모든 service 함수 `auth.uid()` 기준 동작 전수 검증
- `ai_guide_cache` SELECT public 정책 제거
- `generate-ai-guide` Edge Function JWT 검증 추가
- **충돌 처리 RPC `migrate_anonymous_to_user`**: spike 실패 폴백의 본 마이그레이션 + linkIdentity 실패 케이스 통합. 유지/교체/둘 다 보관 UI.
- **Kakao Edge Function rate limit** (anonymous user 분당 5회, IP 시간당 30회)
- Kakao Edge Function CORS origin 제한 (dev/prod Vercel 허용)
- 익명 user 고아 데이터 정리 정책 검토 (90일 미사용 — 또는 별도 단계)
- proactive token refresh (expires_at - 60s)
- **prod URL 외부 공개 시작** (RLS 전수 검증 + Kakao rate limit 완료 후 production Vercel을 prod Supabase로 스위치)

---

## 21. 면접 대비 핵심 포인트

### "왜 Anonymous Sign-In을 도입했나요?"

> 비회원 우선 전략을 RLS와 호환되게 만들기 위해서입니다. 처음엔 TEMP_USER_ID 하드코딩으로 운영했는데 모든 디바이스가 같은 user_id를 공유해서 RLS를 켤 수 없었고 출시 시 데이터 격리가 불가능했습니다. Supabase Anonymous Sign-In은 익명 유저도 진짜 JWT를 받기 때문에 RLS와 그대로 호환되고, 같은 디바이스에서 익명→소셜 승격이 자연스럽습니다.

### "Manual Linking이 beta인데 production에 써도 되나요?"

> ADR-050에 명시한 리스크입니다. 우리 비즈니스가 비회원 우선이라 익명→소셜 승격이 핵심 흐름이고, 이건 Manual Linking 없이 못 구현합니다. 대신 1) supabase-js 버전 업데이트 시 spike 재실행, 2) Supabase changelog 모니터링, 3) Edge Function 로깅으로 linkIdentity 실패율 추적, 이렇게 운영 정책을 같이 두고 베타 의존성을 관리합니다.

### "WebView 3개 세션 동기화는?"

> Native가 session owner이고 웹 클라이언트는 `autoRefreshToken: false`. Supabase refresh token rotation이 1회용이라 WebView 3개가 동시 갱신 시 race condition으로 401 무한 루프 가능합니다. Native가 SecureStore에 저장 + 단독 갱신 + WebView에 broadcast. 추가로 Expo Router Tabs lazy mount 때문에 늦게 마운트된 탭은 broadcast를 놓칠 수 있어서, currentSession을 메모리에 들고 있다가 WEB_READY 응답으로 즉시 주입합니다.

### "Apple/Google linkIdentity가 docs엔 있지만 SDK 동작이 모호한 건 어떻게 처리했나요?"

> ADR-043에 명시했고 §17에 spike 절차를 따로 뒀습니다. 본 구현 직전에 30분 spike로 실제 동작을 검증하고, 성공이면 메인 경로(linkIdentity로 user.id 유지) 그대로, 실패면 폴백 경로(signInWithIdToken으로 새 user 생성 후 10-2 충돌 처리 RPC에서 데이터 이전)로 분기합니다. spike 결과는 `docs/specs/10-1-spike-result.md`에 기록해 회귀 추적이 가능합니다.

### "Kakao는 왜 Edge Function이 따로 필요한가요?"

> Supabase의 `signInWithIdToken`은 OIDC 표준인데 카카오는 OAuth만 지원해 직접 호출 못 합니다. Edge Function이 kakao access_token으로 Kakao API user info를 가져온 다음 magic link + verifyOtp로 Supabase 세션을 발급합니다. JWT secret을 노출하지 않는 표준 우회 패턴이고, Kakao identity는 Supabase auth.identities에 직접 등록되지 않으므로 `auth_provider_links` 매핑 테이블로 따로 관리합니다. ADR-044, ADR-048에 정리되어 있습니다.

### "Kakao Edge Function 보안은?"

> 처음 설계에선 `currentAnonymousUserId`를 클라이언트가 body로 보냈는데, 이게 신뢰되면 공격자가 다른 익명 user의 데이터를 자기 카카오 계정에 연결할 수 있는 계정 탈취가 가능했습니다. 그래서 Authorization 헤더의 JWT를 server-side에서 검증해 user.id를 추출하고, 클라이언트 body 값은 무시하도록 수정했습니다. 매핑 조회도 listUsers + filter 대신 별도 매핑 테이블의 PK 인덱스를 사용합니다.

### "환경 분리를 했다는데 production이 비공개라는 게 무슨 뜻인가요?"

> ADR-051에 명시했습니다. 10-1은 인증 도입 단계라 RLS 활성화는 10-2에서 합니다. 그 사이에 prod Vercel URL이 외부 노출되면 prod Supabase가 RLS 없이 데이터를 readable한 상태로 노출됩니다. 그래서 10-1 동안엔 production Vercel deployment의 환경변수를 dev Supabase URL로 가리키게 두고, 10-2 RLS + Kakao rate limit 완료 시점에 prod로 스위치합니다. 추가 비용 없이 환경 분리 인프라는 미리 구축하면서 데이터 격리는 보안 검증 완료 후로 미루는 트레이드오프입니다.

---

## 22. 알려진 미해결 사항 (구현 중 검증/spike 필수)

1. **§17 spike 결과에 따른 분기** — 본 구현 직전 실측 필수. 결과로 `tryLinkIdentity` 사용 여부 결정.
2. **Kakao Android config plugin** — `@react-native-seoul/kakao-login` 공식 README 재확인. 없으면 prebuild + native 편집.
3. **`functions.invoke` Authorization 자동 주입 동작** — supabaseNative의 `persistSession: false` + `setSession()` 이후 자동 헤더 주입이 실제로 되는지 확인. 안 되면 §6-5 명시적 헤더 fallback 그대로 유지.
4. **Apple nonce가 `linkIdentity`에서도 검증되는지** — `signInWithIdToken`은 명시적 지원, `linkIdentity`는 SDK 동작 불확실. spike에서 확인.
5. **Vercel preview URL을 EAS dev 빌드에 박는 방식** — PR별 동적 URL, alias 운영 패턴 확정.
6. **Kakao Edge Function rate limit** — 10-2 TODO. **prod URL 외부 공개 전 필수.**
7. **Kakao Edge Function CORS origin 제한** — 10-2 TODO. dev/prod Vercel origin만 허용.

---

## 부록 A: v1 → v2 → v3 변경 요약

### v1 → v2 (GPT 리뷰 #1, 24개 항목 반영)

- mobile 전용 supabase client 분리
- WebView lazy mount 대응 (WEB_READY 응답 시 세션 주입)
- linkIdentity 공식 API 사용
- Kakao Edge Function 보안 P0 수정 (JWT 검증, body의 currentAnonymousUserId 제거)
- `auth_provider_links` 매핑 테이블 추가
- BridgeMessage wrapper 통일 (9단계 호환)
- AUTH_SESSION payload 확장
- 그 외 다수

### v2 → v3 (GPT 리뷰 #2, 20개 항목 반영)

- `linkIdentity` 표현 완화 + spike 절차 §17 신설
- Kakao `mode` 용어 분리 (`identity-linked` / `custom-linked` / `signed-in`)
- Kakao Edge Function existingLink == current 분기 + email 충돌 409
- prod 비공개 실 구현: production Vercel을 dev Supabase 임시 연결 (ADR-051)
- `db reset --linked` 가드 + project-ref 확인 절차
- `auth_provider_links.provider` CHECK 제약
- `public.users.provider` 갱신 fallback
- signOut에서 모든 provider best-effort
- `useUserId` loading/null 구분 (객체 반환)
- SELECT/UPDATE/DELETE user_id 필터 명시
- `functions.invoke` Authorization 명시적 헤더 fallback
- ADR-050 신규 (Manual Linking beta 모니터링 정책)
- ADR-051 신규 (production Vercel을 10-1 동안 dev Supabase 임시 연결)
- 사전 작업 체크리스트 (Apple/Google/Kakao Developer + Supabase 콘솔)
- Captcha / cleanup / Naver provider 후속 단계로 명시
