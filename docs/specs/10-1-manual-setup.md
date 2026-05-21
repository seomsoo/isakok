# 10-1 수동 셋업 가이드

> 10-1 본 구현 코드 작성 후, 네이티브 빌드 전 수동으로 수행해야 하는 작업 3단계.
> 2026-05-21 iOS 시뮬레이터 기준 실행 완료.

## 사전 조건

- 10-1 사전 작업 완료 (§0 전체 — Apple/Google/Kakao/Supabase 콘솔 설정)
- 코드 구현 완료 (auth/, migrations, Edge Function 등)
- `apps/mobile/.env` 키값 채움

---

## 1단계: Edge Function 배포

```bash
cd /path/to/isakok
npx supabase functions deploy kakao-token-exchange
```

배포 후 Supabase Dashboard → Edge Functions에서 `kakao-token-exchange` 상태 확인.

secrets가 이미 설정되어 있어야 함:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` — Supabase가 자동 주입
- 추가 secrets 불필요 (Kakao API는 클라이언트에서 받은 access token으로 호출)

## 2단계: Expo Prebuild

```bash
cd apps/mobile
npx expo prebuild --clean
```

config plugins 변경사항을 네이티브 프로젝트에 반영:

- `expo-apple-authentication`
- `@react-native-google-signin/google-signin` (iosUrlScheme)
- `@react-native-seoul/kakao-login` (kakaoAppKey)
- `expo-secure-store`

`--clean` 필수 — 기존 ios/android 폴더를 삭제하고 재생성.

## 3단계: iOS 빌드 + 테스트

### 시뮬레이터

```bash
# 터미널 1: 웹 서버 (WebView가 localhost:5173 로드)
cd apps/web && pnpm dev

# 터미널 2: iOS 빌드 + Metro + 시뮬레이터
cd apps/mobile && npx expo run:ios
```

`npx expo run:ios`가 빌드 + Metro 번들러 + 시뮬레이터 실행을 한 번에 처리.

### 시뮬레이터 초기화 (세션 리셋 필요 시)

```bash
# Metro 끄고 실행
xcrun simctl erase <device-id>
# 또는 부팅된 시뮬레이터:
xcrun simctl erase booted
```

앱 삭제로는 SecureStore/WebView localStorage가 안 지워짐. 완전 초기화 필요 시 위 명령 사용.

### 실기기 (Apple 로그인 테스트)

Apple 로그인은 시뮬레이터에서 불가 — 실기기 필요:

1. Xcode → Window → Devices and Simulators → 기기 등록
2. Signing & Capabilities에서 Team 선택 + Automatically manage signing
3. `npx expo run:ios --device` 또는 Xcode에서 직접 빌드

---

## 디버깅 중 발견한 이슈

### app.json config plugin 누락 → 앱 크래시

`@react-native-seoul/kakao-login` config plugin이 `app.json`에 없으면 `RNKakaoLogins.init()`에서 assertionFailure 크래시. 증상: 앱 실행 즉시 튕김, Metro 로그에 에러 없음.

```json
// app.json plugins에 추가 필수
["@react-native-seoul/kakao-login", { "kakaoAppKey": "<KAKAO_NATIVE_APP_KEY>" }]
```

### WebView 세션 잔존

iOS 시뮬레이터에서 앱 삭제 후 재설치해도 WebView localStorage의 Supabase 세션이 남아있을 수 있음. `INJECTED_BEFORE_LOAD`에서 `sb-*-auth-token` 키를 정리하지만, native SecureStore에 세션이 남아있으면 `WEB_READY` 시 다시 주입됨. 깨끗한 테스트가 필요하면 `xcrun simctl erase` 사용.

### 코드 서명 (시뮬레이터)

`usesAppleSignIn: true`가 entitlement를 강제해서 시뮬레이터에서도 코드 서명 에러가 날 수 있음. `npx expo run:ios`가 자동 처리하지만, Xcode에서 직접 빌드 시 `CODE_SIGNING_ALLOWED=NO` 설정 필요.
