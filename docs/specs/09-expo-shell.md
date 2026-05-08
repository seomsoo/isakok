# 9단계: Expo 셸 + WebView 래핑 스펙 (SDD)

> 목표: Expo(React Native) 네이티브 셸을 생성하고, 기존 React 웹앱을 WebView로 래핑하여 하이브리드 앱 구조를 완성한다
> 이 단계가 끝나면: 실기기에서 네이티브 탭바 + WebView 기반 웹앱이 동작하고, 네이티브↔웹 브릿지 프로토콜이 정의되어 있는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- `apps/mobile` Expo 프로젝트 생성 (SDK 55, development build)
- 네이티브 하단 탭바 (3탭: 홈, 전체, 집기록) — Expo Router `Tabs` 레이아웃
- 각 탭에 WebView 래핑 (Vercel 원격 URL 로드)
- 스플래시 스크린 (`expo-splash-screen`) — 웹 로딩 완료까지 유지
- 앱 아이콘 (placeholder)
- 네이티브↔웹 브릿지 프로토콜 정의 (`packages/shared/src/types/bridge.ts`)
- 브릿지 유틸리티: 웹 측 (`packages/shared/src/utils/nativeBridge.ts`), 네이티브 측 (`apps/mobile/src/utils/webBridge.ts`)
- WebView 상태 처리: 로딩 / 에러 / 오프라인 fallback 네이티브 화면
- 웹앱 수정: 네이티브 환경 감지 → DevTabBar 숨김 + safe area 대응
- `EXPO_PUBLIC_WEB_APP_URL` 환경변수로 dev/prod URL 분리
- Turborepo 워크스페이스에 `apps/mobile` 등록
- `apps/mobile/CLAUDE.md` 생성
- WebView에서 기존 `<input type="file">` 사진 업로드 **실기기 검증** (iOS/Android)
- LandingPage 제거 + 웹앱 진입점 변경 (active 이사 유무 분기)
- `native-a11y-reviewer` 에이전트 활성화
- apps/web을 Vercel에 배포 (기본 URL 또는 Preview URL 확보)

### 안 하는 것

- 인증 / 소셜 로그인 (10단계)
- RLS 활성화 (10단계)
- 비회원 → 회원 마이그레이션 (10단계)
- 네이티브 카메라 실구현 (10단계+ — 인증 토큰 필요)
- expo-image-picker 연동 (10단계+)
- EXIF/해시 네이티브 처리 (10단계+)
- Service Worker / IndexedDB 프리캐싱 (10단계+)
- 푸시 알림 (v1.1)
- 앱스토어 제출 / EAS Submit (배포 단계)
- 앱 아이콘 최종 디자인 (디자인 단계)
- 커스텀 도메인 구매/연결 (앱스토어 제출 준비 단계)
- staging Supabase 분리 (운영 준비 단계)
- 단일 WebView + 커스텀 탭바 구조 (9단계는 탭별 WebView 3개. 메모리/인증 복잡도가 문제되면 10단계에서 재검토)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
apps/mobile/                              ← 생성 (Expo 프로젝트)
├── package.json                          ← "main": "expo-router/entry" 필수
├── app.json                              ← Expo 앱 설정
├── eas.json                              ← EAS Build 프로파일 (dev/preview/prod)
├── tsconfig.json
├── eslint.config.js                      ← 생성 (ESLint flat config)
├── CLAUDE.md                             ← 생성 (모바일 앱 전용 규칙)
├── .env.example                          ← EXPO_PUBLIC_WEB_APP_URL
├── assets/
│   ├── icon.png                          ← placeholder (1024x1024)
│   ├── adaptive-icon.png                 ← placeholder (1024x1024)
│   ├── splash-icon.png                   ← placeholder (288x288)
│   └── favicon.png                       ← placeholder (48x48)
├── src/
│   ├── app/                              ← Expo Router 파일 기반 라우팅
│   │   ├── _layout.tsx                   ← 루트 레이아웃 (스플래시 + 네트워크 감지)
│   │   └── (tabs)/
│   │       ├── _layout.tsx               ← 탭 레이아웃 (3탭 정의)
│   │       ├── index.tsx                 ← 홈 탭 (WebView → /dashboard or /onboarding)
│   │       ├── timeline.tsx              ← 전체 탭 (WebView → /timeline)
│   │       └── photos.tsx               ← 집기록 탭 (WebView → /photos)
│   ├── components/
│   │   ├── WebViewScreen.tsx             ← 공통 WebView 래퍼 (로딩/에러/오프라인 처리)
│   │   ├── LoadingFallback.tsx           ← WebView 로딩 중 네이티브 화면
│   │   ├── ErrorFallback.tsx             ← WebView 에러 시 네이티브 화면
│   │   └── OfflineFallback.tsx           ← 오프라인 시 네이티브 화면
│   ├── hooks/
│   │   ├── useNetworkStatus.ts           ← NetInfo 기반 네트워크 감지
│   │   └── useWebViewRef.ts             ← WebView ref + 브릿지 메서드 래핑
│   ├── utils/
│   │   ├── webBridge.ts                  ← 네이티브→웹 메시지 전송 유틸
│   │   ├── splash.ts                     ← hideSplashOnce() 중복 호출 방지
│   │   └── urlAllowlist.ts              ← WebView URL 허용 판별
│   └── constants/
│       └── config.ts                     ← WEB_APP_URL, 탭 메타 등
│
packages/shared/src/
├── types/
│   └── bridge.ts                         ← 생성 (브릿지 메시지 타입 정의)
├── utils/
│   └── nativeBridge.ts                   ← 생성 (웹→네이티브 메시지 전송 유틸)
└── constants/
    └── platform.ts                       ← 생성 (플랫폼 감지 상수)

apps/web/src/
├── App.tsx                               ← 수정 (LandingPage 제거, 진입 분기 변경)
├── pages/
│   └── LandingPage.tsx                   ← 삭제
├── shared/components/
│   └── DevTabBar.tsx                     ← 수정 (네이티브 환경에서 숨김)
└── index.css                             ← 수정 (safe area padding 대응)
```

---

## 2. 패키지 설치

### apps/mobile (신규)

```bash
# Expo 프로젝트 생성 (SDK 55)
npx create-expo-app apps/mobile --template blank-typescript

# 이후 apps/mobile 디렉토리에서:
npx expo install expo-dev-client                   # development build 필수
npx expo install react-native-webview              # WebView
npx expo install expo-splash-screen                # 스플래시 스크린
npx expo install @react-native-community/netinfo   # 네트워크 상태
npx expo install expo-constants                    # 환경 상수
npx expo install expo-status-bar                   # 상태바 제어

# Expo Router (파일 기반 라우팅 + 탭 네비게이션)
npx expo install expo-router expo-linking expo-constants
npx expo install react-native-safe-area-context react-native-screens  # Expo Router 필수 의존성
```

> **expo-dev-client**: development build를 만들어 실기기에서 네이티브 모듈(react-native-webview 등)을 테스트. Expo Go 없이 동작.

> **react-native-safe-area-context + react-native-screens**: Expo Router가 내부적으로 @react-navigation을 사용하므로 이 두 패키지가 필수. 없으면 런타임 에러.

> **왜 Expo Router인가?**: 파일 기반 라우팅으로 Next.js와 동일한 DX를 제공하고, `Tabs` 레이아웃이 내장되어 있어 @react-navigation을 직접 설정할 필요가 없음. SDK 55에서 안정 버전이며 Expo 공식 추천.

> **왜 development build인가?**: Expo Go는 SDK 55 iOS 앱스토어 승인 대기 중. development build는 네이티브 모듈을 자유롭게 쓸 수 있고, 프로덕션과 동일한 환경에서 테스트 가능.

### eas.json 생성

```jsonc
// apps/mobile/eas.json
{
  "cli": {
    "version": ">= 12.0.0",
  },
  "build": {
    "development": {
      "developmentClient": true,
      "distribution": "internal",
    },
    "preview": {
      "distribution": "internal",
    },
    "production": {},
  },
}
```

### 워크스페이스 등록

```yaml
# pnpm-workspace.yaml (수정)
packages:
  - 'apps/*'
  - 'packages/*'
```

`apps/mobile/package.json` 전체 예시:

```jsonc
{
  "name": "@moving/mobile",
  "private": true,
  "main": "expo-router/entry",
  "scripts": {
    "dev": "expo start --dev-client",
    "typecheck": "tsc --noEmit",
    "lint": "eslint .",
    "build:dev": "eas build --profile development --platform all",
    "build:preview": "eas build --profile preview --platform all",
  },
  "dependencies": {
    "@moving/shared": "workspace:*",
  },
}
```

> **shared 패키지명 주의**: `@moving/shared`는 `packages/shared/package.json`의 실제 `name` 값과 반드시 일치해야 함. 구현 전 `cat packages/shared/package.json | grep '"name"'`으로 확인.

> **`build` 스크립트를 일부러 안 넣는 이유**: 루트 `pnpm build` → `turbo run build` 실행 시 EAS Build가 CI에서 돌아가는 것을 방지. native build는 수동 또는 별도 workflow에서만 실행.

---

## 3. Expo 앱 설정

### app.json

```jsonc
{
  "expo": {
    "name": "이사콕",
    "slug": "isakok",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "isakok",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#F8F7F5",
    },
    "ios": {
      "supportsTablet": false,
      "bundleIdentifier": "com.isakok.app",
      "infoPlist": {
        "NSCameraUsageDescription": "집 상태를 사진으로 기록하기 위해 카메라 접근이 필요합니다",
        "NSPhotoLibraryUsageDescription": "집 상태 사진을 갤러리에서 선택하기 위해 접근이 필요합니다",
      },
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#F8F7F5",
      },
      "package": "com.isakok.app",
    },
    "plugins": ["expo-router"],
  },
}
```

> **iOS usage description**: WebView 파일 선택/카메라 선택 시 필요할 수 있어 placeholder로 유지. Android 카메라/스토리지 권한은 9단계에서 직접 선언하지 않음. expo-image-picker 또는 expo-camera를 정식 도입하는 단계에서 config plugin 기준으로 재정리.

> **supportsTablet: false**: 1인 이사 타겟앱으로 모바일 전용. iPad 대응은 v1.1 이후 검토.

---

## 4. 환경 변수

### apps/mobile/.env.example

```
# 실기기 테스트에서는 localhost 대신 LAN IP 또는 Vercel Preview URL 사용
# iOS 시뮬레이터: localhost 가능
# Android 에뮬레이터/실기기: LAN IP 필수 (localhost는 디바이스 자신을 가리킴)
EXPO_PUBLIC_WEB_APP_URL=http://192.168.0.10:5173

# Vercel 배포 URL
# EXPO_PUBLIC_WEB_APP_URL=https://isakok-xxxx.vercel.app
```

### config.ts

```typescript
// apps/mobile/src/constants/config.ts

/**
 * 웹앱 URL — 환경변수에서 직접 읽기
 * app.json은 JSON이라 process.env를 평가할 수 없으므로 코드에서 처리
 */
export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? 'http://localhost:5173'
```

---

## 5. Vercel 배포

WebView가 원격 URL을 로드하려면 안정적인 URL이 필요. 9단계에서 apps/web을 Vercel에 배포.

### 하는 것

- Vercel 프로젝트 생성 + apps/web 연결
- Vercel 기본 URL 확보 (예: `isakok-xxxx.vercel.app`)
- `EXPO_PUBLIC_WEB_APP_URL`에 해당 URL 연결
- Expo development build에서 WebView 로드 확인

### 안 하는 것

- 커스텀 도메인 구매/연결 (앱스토어 제출 준비 단계에서)
- staging Supabase 분리
- 정식 운영 배포 정책 수립

### Vercel 설정

Vercel은 **GitHub repo를 import**하고 Root Directory를 `apps/web`으로 설정한다.

```
Vercel 대시보드에서:
- Framework Preset: Vite
- Root Directory: apps/web
- Build Command: pnpm --filter <web-package-name> build
  (또는 apps/web 내부에서 독립 build가 가능하면: pnpm build)
- Output Directory: dist
- Install Command: pnpm install
```

> **workspace dependency 주의**: apps/web이 packages/shared를 workspace dependency로 사용하므로, Vercel이 repo root 기준으로 설치해야 함. workspace dependency(packages/shared)가 깨지면 repo root 기준 설치 + apps/web build 방식으로 조정. 구현 시 packages/shared 의존성 해석 여부를 반드시 확인.

> **Supabase 환경변수**: Vercel 프로젝트 Settings → Environment Variables에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 설정 필요. 현재 dev/prod가 같은 Supabase 프로젝트를 사용하므로 동일한 값.

---

## 6. 네이티브 탭바

### 탭 구성

| 탭     | 라벨   | 아이콘 (lucide) | WebView 경로                    | 비고                         |
| ------ | ------ | --------------- | ------------------------------- | ---------------------------- |
| 홈     | 홈     | House           | `/dashboard` 또는 `/onboarding` | active 이사 유무에 따라 분기 |
| 전체   | 전체   | ClipboardList   | `/timeline`                     |                              |
| 집기록 | 집기록 | Camera          | `/photos`                       |                              |

> **아이콘**: Expo에서는 `@expo/vector-icons`의 `Ionicons` 또는 커스텀 SVG 사용. lucide-react-native는 없으므로, 유사한 Ionicons 아이콘으로 매핑하거나 SVG를 직접 사용.

### app/(tabs)/\_layout.tsx

```typescript
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'

// 디자인 토큰 (packages/shared에서 import 가능하면 사용, 아니면 하드코딩)
const COLORS = {
  primary: '#0D9488',
  placeholder: '#9E9E9E',
  surface: '#FFFFFF',
  border: '#F0EFED',
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.placeholder,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          borderTopWidth: 0.5,
          height: 56, // DevTabBar와 동일
          paddingBottom: 4,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: '홈',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          title: '전체',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="list-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="photos"
        options={{
          title: '집기록',
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="camera-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
```

> **headerShown: false**: 웹앱이 자체 PageHeader를 가지고 있으므로 네이티브 헤더는 숨김.

---

## 7. WebView 래핑

### 7-1. WebViewScreen (공통 래퍼)

모든 탭에서 공유하는 WebView 래퍼 컴포넌트. 로딩/에러/오프라인 상태를 통일 처리.

```typescript
interface WebViewScreenProps {
  path: string // WebView에서 로드할 경로 (예: '/dashboard')
  onMessage?: (data: unknown) => void // 웹→네이티브 메시지 핸들러
}
```

**핵심 동작:**

1. `WEB_APP_URL + path`를 WebView `source.uri`로 로드
2. `injectedJavaScriptBeforeContentLoaded`로 `__IS_NATIVE_WEBVIEW__` 플래그 + body 클래스 사전 주입
3. 로딩 중: `LoadingFallback` 네이티브 화면 표시 (스피너 + 앱 로고)
4. 에러 시: `ErrorFallback` 네이티브 화면 (재시도 버튼)
5. 오프라인: `OfflineFallback` 네이티브 화면 (WiFi 아이콘 + 안내)
6. `WEB_READY` 메시지 수신 시 `hideSplashOnce()` 호출
7. 외부 URL은 `isAllowedWebUrl()`로 판별 → 시스템 브라우저로 열기

**사전 주입 JavaScript:**

```typescript
const INJECTED_BEFORE_LOAD = `
  window.__IS_NATIVE_WEBVIEW__ = true;
  (function() {
    function addClass() {
      if (document.body) {
        document.body.classList.add('native-webview');
      }
    }
    addClass();
    document.addEventListener('DOMContentLoaded', addClass);
  })();
  true;
`
```

> **왜 사전 주입?**: `window.ReactNativeWebView`가 설정되기 전에 React 앱이 마운트되면 DevTabBar가 잠깐 보일 수 있음. `__IS_NATIVE_WEBVIEW__`를 콘텐츠 로드 전에 주입하면 첫 렌더부터 네이티브 환경 감지.

**WebView 설정:**

```typescript
<WebView
  ref={webViewRef}
  source={{ uri: `${WEB_APP_URL}${path}` }}
  javaScriptEnabled={true}
  domStorageEnabled={true}
  bounces={false}
  allowsBackForwardNavigationGestures={false}
  allowFileAccess={true}
  allowFileAccessFromFileURLs={false}
  showsVerticalScrollIndicator={false}
  showsHorizontalScrollIndicator={false}
  automaticallyAdjustContentInsets={false}
  contentInsetAdjustmentBehavior="never"
  // 네이티브 환경 플래그 사전 주입 (DevTabBar 깜빡임 방지)
  injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_LOAD}
  onMessage={handleMessage}
  onLoadStart={() => setIsLoading(true)}
  onLoadEnd={() => { setIsLoading(false); setHasError(false) }}
  onError={() => { setIsLoading(false); setHasError(true) }}
  onHttpError={({ nativeEvent }) => {
    if (nativeEvent.statusCode >= 400) setHasError(true)
  }}
  // URL allowlist로 외부 링크 판별 (dev 환경 LAN IP/Preview URL 대응)
  onShouldStartLoadWithRequest={(request) => {
    if (isAllowedWebUrl(request.url)) return true
    Linking.openURL(request.url)
    return false
  }}
  // iOS 메모리 해제 대응
  onContentProcessDidTerminate={() => {
    webViewRef.current?.reload()
  }}
/>
```

### 7-2. 탭별 WebView 캐싱 전략

**문제**: 탭을 전환할 때마다 WebView가 리마운트되면 매번 웹앱을 새로 로드해야 함.

**해결**: `renderScene` 패턴 또는 각 탭에 WebView를 독립적으로 유지.

Expo Router의 Tabs는 기본적으로 **lazy 마운트 + 언마운트 안 함** (unmountOnBlur 기본 false). 한번 마운트된 탭은 메모리에 유지되므로 탭 전환 시 WebView가 리로드되지 않음.

> **주의**: 메모리 사용량이 늘어날 수 있지만, WebView 3개 정도는 문제 없음. 만약 메모리가 이슈가 되면 비활성 탭의 WebView에 `renderToHardwareTextureAndroid` 최적화 적용.

> **10단계 Follow-up**: 탭별 WebView 3개 구조에서 인증 도입 시 `AUTH_SESSION` / `AUTH_LOGOUT` 메시지를 모든 활성 WebView에 브로드캐스트해야 함. 세션 동기화가 복잡해지면 단일 WebView + 커스텀 네이티브 탭바 구조로 전환 재검토.

### 7-3. 홈 탭 진입 분기

홈 탭(`index.tsx`)은 웹앱에서 active 이사 유무에 따라 `/onboarding` 또는 `/dashboard`로 분기해야 함.

**접근법**: 웹앱의 기존 라우트 가드를 그대로 활용.

```typescript
// apps/mobile/src/app/(tabs)/index.tsx
export default function HomeTab() {
  // 웹앱 루트('/')를 로드하면 웹 App.tsx의 라우트 가드가
  // active 이사 유무에 따라 /onboarding 또는 /dashboard로 리다이렉트
  return <WebViewScreen path="/" />
}
```

웹앱 `App.tsx`에서 기존 `/` 라우트가 `LandingPage`를 렌더링하고 있었는데, LandingPage 제거 후:

```typescript
// apps/web/src/App.tsx (수정)
// 기존: <Route path="/" element={<LandingPage />} />
// 변경: <Route path="/" element={<EntryRedirect />} />
```

`EntryRedirect` 컴포넌트:

- `useCurrentMove()` 호출
- active 이사 있음 → `navigate('/dashboard', { replace: true })`
- active 이사 없음 → `navigate('/onboarding', { replace: true })`
- **에러 시** → `navigate('/onboarding', { replace: true })` (스피너에 갇히지 않도록)

```typescript
// apps/web/src/pages/EntryRedirect.tsx
export function EntryRedirect() {
  const navigate = useNavigate()
  const { data: move, isLoading, isError } = useCurrentMove()

  useEffect(() => {
    if (isLoading) return
    if (isError || !move) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [move, isLoading, isError, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
```

---

## 8. 브릿지 프로토콜

### 8-1. 메시지 타입 정의

```typescript
// packages/shared/src/types/bridge.ts

/**
 * 웹 → 네이티브 메시지
 * WebView의 window.ReactNativeWebView.postMessage()로 전송
 */
export type WebToNativeMessage =
  | { type: 'OPEN_CAMERA'; payload: { room: string; photoType: 'move_in' | 'move_out' } }
  | { type: 'REQUEST_LOGIN' }
  | { type: 'REQUEST_LOGOUT' }
  | { type: 'OPEN_EXTERNAL_LINK'; payload: { url: string } }
  | { type: 'SHARE_REPORT'; payload: { url: string } }
  | { type: 'WEB_READY' }
  | { type: 'ROUTE_CHANGE'; payload: { path: string } }

/**
 * 네이티브 → 웹 메시지
 * WebView의 injectJavaScript()로 전송
 */
export type NativeToWebMessage =
  | { type: 'AUTH_SESSION'; payload: { token: string; userId: string } }
  | { type: 'AUTH_LOGOUT' }
  | { type: 'PHOTO_TAKEN'; payload: { uri: string; exif: Record<string, unknown>; hash: string } }
  | { type: 'NETWORK_STATUS'; payload: { online: boolean } }
  | { type: 'PLATFORM_INFO'; payload: { os: 'ios' | 'android'; isNative: true } }

/**
 * 브릿지 메시지 공통 래퍼
 */
export interface BridgeMessage<T = WebToNativeMessage | NativeToWebMessage> {
  version: 1
  timestamp: number
  data: T
}
```

> **version 필드**: 브릿지 프로토콜 버전. 나중에 메시지 형식이 바뀔 때 하위 호환성 유지.
> **9단계에서 실제 동작하는 메시지**: `WEB_READY`, `ROUTE_CHANGE`, `PLATFORM_INFO`, `NETWORK_STATUS`, `OPEN_EXTERNAL_LINK`. 나머지는 타입만 정의 (10단계+에서 구현).

### 8-2. 웹 측 유틸 (nativeBridge.ts)

```typescript
// packages/shared/src/utils/nativeBridge.ts

import type { WebToNativeMessage, NativeToWebMessage, BridgeMessage } from '../types/bridge'

/**
 * 네이티브 환경인지 판별
 * injectedJavaScriptBeforeContentLoaded로 __IS_NATIVE_WEBVIEW__가 먼저 설정되므로
 * 첫 렌더에서도 정확하게 감지 (DevTabBar 깜빡임 방지)
 */
export function isNativeWebView(): boolean {
  return (
    typeof window !== 'undefined' &&
    (window.__IS_NATIVE_WEBVIEW__ === true || window.ReactNativeWebView !== undefined)
  )
}

/**
 * 웹 → 네이티브 메시지 전송
 * 네이티브 환경이 아니면 console.log로 폴백 (개발 중 웹 브라우저)
 */
export function sendToNative(message: WebToNativeMessage): void {
  const wrapped: BridgeMessage<WebToNativeMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }

  if (typeof window !== 'undefined' && window.ReactNativeWebView) {
    window.ReactNativeWebView.postMessage(JSON.stringify(wrapped))
  } else {
    console.log('[NativeBridge] (dev fallback)', wrapped)
  }
}

/**
 * 네이티브 → 웹 메시지 리스너 등록
 * @returns cleanup 함수
 */
export function onNativeMessage(handler: (message: NativeToWebMessage) => void): () => void {
  function listener(event: MessageEvent) {
    try {
      const parsed: BridgeMessage<NativeToWebMessage> = JSON.parse(event.data)
      if (parsed.version === 1) {
        handler(parsed.data)
      }
    } catch {
      // 브릿지 메시지가 아닌 다른 postMessage 무시
    }
  }

  window.addEventListener('message', listener)
  return () => window.removeEventListener('message', listener)
}
```

**Window 타입 확장:**

```typescript
// packages/shared/src/types/bridge.ts (하단 추가)

declare global {
  interface Window {
    ReactNativeWebView?: {
      postMessage: (message: string) => void
    }
    __IS_NATIVE_WEBVIEW__?: boolean
  }
}
```

### 8-3. 네이티브 측 유틸 (webBridge.ts)

```typescript
// apps/mobile/src/utils/webBridge.ts

import type WebView from 'react-native-webview'
import type { NativeToWebMessage, BridgeMessage } from '@moving/shared/types/bridge'

/**
 * 네이티브 → 웹 메시지 전송
 * dispatchEvent(new MessageEvent) 방식으로 전달
 * window.postMessage보다 명확하고 origin 이슈 없음
 */
export function sendToWeb(webViewRef: React.RefObject<WebView>, message: NativeToWebMessage): void {
  const wrapped: BridgeMessage<NativeToWebMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }

  const serialized = JSON.stringify(wrapped)

  webViewRef.current?.injectJavaScript(`
    (function() {
      window.dispatchEvent(
        new MessageEvent('message', { data: ${JSON.stringify(serialized)} })
      );
    })();
    true;
  `)
}
```

> **왜 dispatchEvent?**: `window.postMessage`는 origin 체크가 복잡해질 수 있음. `dispatchEvent(new MessageEvent)`는 같은 `message` 이벤트를 발생시키면서 origin 이슈 없음.

### 8-4. URL Allowlist

```typescript
// apps/mobile/src/utils/urlAllowlist.ts

import { WEB_APP_URL } from '../constants/config'

/**
 * WebView 내부 탐색을 허용할 URL인지 판별
 * 개발 환경에서는 localhost, LAN IP, Vercel Preview URL도 허용
 */
export function isAllowedWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const appUrl = new URL(WEB_APP_URL)

    if (parsed.origin === appUrl.origin) return true

    if (__DEV__) {
      if (parsed.hostname === 'localhost') return true
      if (parsed.hostname.startsWith('192.168.')) return true
      if (parsed.hostname.startsWith('10.')) return true
      if (parsed.hostname.endsWith('.vercel.app')) return true
    }

    return false
  } catch {
    return false
  }
}
```

---

## 9. 웹앱 수정

### 9-1. LandingPage 제거 + 진입 분기

```typescript
// apps/web/src/App.tsx

// 삭제: import { LandingPage } from '@/pages/LandingPage'
// 추가:
import { EntryRedirect } from '@/pages/EntryRedirect'

// 라우트 변경:
// 기존: <Route path={ROUTES.LANDING} element={<LandingPage />} />
// 변경: <Route path={ROUTES.LANDING} element={<EntryRedirect />} />
```

```typescript
// apps/web/src/pages/EntryRedirect.tsx (생성)

import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCurrentMove } from '@/features/dashboard/hooks/useCurrentMove'
import { Spinner } from '@/shared/components/Spinner'

/**
 * 앱 진입점 — active 이사 유무에 따라 리다이렉트
 * LandingPage를 대체. 네이티브 셸에서 WebView가 '/'를 로드하면
 * 이 컴포넌트가 적절한 페이지로 보내줌.
 */
export function EntryRedirect() {
  const navigate = useNavigate()
  const { data: move, isLoading, isError } = useCurrentMove()

  useEffect(() => {
    if (isLoading) return
    if (isError || !move) {
      navigate('/onboarding', { replace: true })
    } else {
      navigate('/dashboard', { replace: true })
    }
  }, [move, isLoading, isError, navigate])

  return (
    <div className="flex min-h-dvh items-center justify-center">
      <Spinner size="lg" />
    </div>
  )
}
```

> **LandingPage.tsx 파일은 삭제.** ROUTES.LANDING 상수는 유지 (값은 '/'로 동일).

### 9-2. DevTabBar 조건부 숨김

```typescript
// apps/web/src/shared/components/DevTabBar.tsx (수정)

import { isNativeWebView } from '@moving/shared/utils/nativeBridge'

export function DevTabBar() {
  // 네이티브 WebView 안에서는 렌더링하지 않음
  // 네이티브 탭바가 이 역할을 대신함
  if (isNativeWebView()) return null

  // 기존 코드 그대로...
}
```

> **왜 DevTabBar를 제거하지 않나?**: 웹 단독 개발(pnpm dev)에서 여전히 필요. 네이티브 환경에서만 숨김.

### 9-3. Safe Area 대응

네이티브 탭바가 하단을 차지하므로, 웹앱의 하단 패딩 조정이 필요.

```css
/* apps/web/src/index.css (추가) */

/*
 * 네이티브 WebView에서 safe area 대응
 * 'native-webview' 클래스는 injectedJavaScriptBeforeContentLoaded로 사전 주입됨
 * 네이티브 탭바가 하단을 차지하므로 웹의 하단 여백 제거
 */
body.native-webview #root {
  padding-bottom: 0;
}
```

> **body 클래스 설정**: WebView의 `injectedJavaScriptBeforeContentLoaded`에서 `document.body.classList.add('native-webview')`를 사전 주입. App.tsx에서 별도로 추가할 필요 없음.

### 9-4. 외부 링크 처리

웹앱에서 외부 링크 클릭 시 네이티브 브라우저로 열기:

```typescript
// apps/web/src/features/checklist/components/RelatedLinkCard.tsx (수정)

import { isNativeWebView, sendToNative } from '@moving/shared/utils/nativeBridge'

function handleLinkClick(url: string) {
  if (isNativeWebView()) {
    sendToNative({ type: 'OPEN_EXTERNAL_LINK', payload: { url } })
  } else {
    window.open(url, '_blank')
  }
}
```

> WebViewScreen의 `onShouldStartLoadWithRequest`에서도 외부 링크를 차단하므로 이중 안전장치.

### 9-5. WEB_READY 메시지

WebView가 웹앱 로드를 완료했음을 네이티브에 알리는 메시지:

```typescript
// apps/web/src/App.tsx (수정 — 마운트 시)
import { isNativeWebView, sendToNative } from '@moving/shared/utils/nativeBridge'

useEffect(() => {
  if (isNativeWebView()) {
    sendToNative({ type: 'WEB_READY' })
  }
}, [])
```

네이티브 측에서 `WEB_READY`를 받으면 `hideSplashOnce()` 호출:

```typescript
// WebViewScreen 내부
import { hideSplashOnce } from '../utils/splash'

function handleMessage(event: WebViewMessageEvent) {
  try {
    const parsed = JSON.parse(event.nativeEvent.data)
    if (parsed.version === 1 && parsed.data?.type === 'WEB_READY') {
      hideSplashOnce()
    }
    // 다른 메시지는 onBridgeMessage prop으로 전달
  } catch {
    // 브릿지 메시지가 아닌 다른 postMessage 무시
  }
}
```

---

## 10. 스플래시 스크린

### 동작 흐름

```
앱 시작
  ↓
expo-splash-screen 표시 (네이티브 스플래시)
  ↓
앱 레이아웃 마운트 (SplashScreen.preventAutoHideAsync())
  ↓
WebView 로드 시작
  ↓
웹앱 마운트 완료 → WEB_READY 메시지 전송
  ↓
네이티브에서 SplashScreen.hideAsync() 호출
  ↓
유저에게 화면 표시
```

### hideSplashOnce 유틸

```typescript
// apps/mobile/src/utils/splash.ts

import * as SplashScreen from 'expo-splash-screen'

let splashHidden = false

/**
 * 스플래시를 정확히 1회만 숨김
 * 탭별 WebView 3개에서 WEB_READY가 여러 번 올 수 있고,
 * 5초 타임아웃과도 중복될 수 있으므로 중복 호출 방지
 */
export async function hideSplashOnce(): Promise<void> {
  if (splashHidden) return
  splashHidden = true

  try {
    await SplashScreen.hideAsync()
  } catch {
    // 이미 숨겨진 경우 등은 무시
  }
}
```

### 루트 레이아웃

```typescript
// apps/mobile/src/app/_layout.tsx

import { Slot } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { hideSplashOnce } from '../utils/splash'

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  useEffect(() => {
    // 안전장치: 5초 후에도 WEB_READY가 안 오면 강제로 스플래시 숨김
    const timeout = setTimeout(() => {
      hideSplashOnce()
    }, 5000)

    return () => clearTimeout(timeout)
  }, [])

  return (
    <>
      <StatusBar style="dark" />
      <Slot />
    </>
  )
}
```

> **5초 타임아웃**: 네트워크 느린 환경에서 무한 스플래시 방지. 5초 후에도 웹이 안 뜨면 일단 보여주고 WebViewScreen의 에러/로딩 fallback이 처리.

---

## 11. WebView 상태 처리

### 11-1. LoadingFallback

```
┌──────────────────────────────┐
│                              │
│                              │
│         [앱 로고]            │
│                              │
│          ◌ (스피너)          │
│                              │
│                              │
└──────────────────────────────┘
```

- 배경: neutral (#F8F7F5)
- 앱 로고: placeholder (텍스트 "이사콕")
- 스피너: primary 컬러, ActivityIndicator
- 전체 화면, 센터 정렬

### 11-2. ErrorFallback

```
┌──────────────────────────────┐
│                              │
│         ⚠️                   │
│                              │
│    페이지를 불러올 수         │
│    없어요                    │
│                              │
│    [다시 시도]               │  ← primary 버튼
│                              │
└──────────────────────────────┘
```

- "다시 시도" 클릭 → WebView reload
- 배경: neutral

### 11-3. OfflineFallback

```
┌──────────────────────────────┐
│                              │
│         📡                   │
│                              │
│    인터넷 연결을              │
│    확인해주세요               │
│                              │
│    연결되면 자동으로          │
│    새로고침돼요               │
│                              │
└──────────────────────────────┘
```

- `useNetworkStatus` 훅으로 네트워크 복귀 감지 → 자동 WebView reload
- 배경: neutral

---

## 12. apps/mobile/CLAUDE.md

```markdown
# apps/mobile — Expo React Native 앱

## 역할

네이티브 셸. WebView로 웹앱을 래핑하고, 네이티브 기능(탭바, 카메라, 인증)을 제공.

## 폴더 구조
```

src/
├── app/ ← Expo Router 파일 기반 라우팅
├── components/ ← 네이티브 UI 컴포넌트
├── hooks/ ← 커스텀 훅
├── utils/ ← 브릿지, 헬퍼
└── constants/ ← 설정값

```

## 코드 컨벤션
- 루트 CLAUDE.md의 TypeScript/React 규칙 동일 적용
- React Native 컴포넌트: `View`, `Text`, `Pressable` (TouchableOpacity 대신)
- 스타일: StyleSheet.create (인라인 스타일 금지)
- 접근성: accessibilityLabel, accessibilityRole 필수

## 브릿지 규칙
- 메시지 타입은 반드시 `packages/shared/src/types/bridge.ts`에 정의
- 웹→네이티브: `window.ReactNativeWebView.postMessage()` (nativeBridge.ts 유틸 사용)
- 네이티브→웹: `webViewRef.injectJavaScript()` (webBridge.ts 유틸 사용)
- 알 수 없는 메시지 타입은 무시 (silent fail)

## 네이티브 기능 매핑
| 기능 | 단계 | 상태 |
|---|---|---|
| 탭바 | 9단계 | ✅ |
| 스플래시 | 9단계 | ✅ |
| 브릿지 프로토콜 | 9단계 | ✅ (타입만) |
| WebView 파일 업로드 | 9단계 | ✅ (기존 웹 방식) |
| 네이티브 카메라 | 10단계+ | ⬜ |
| 소셜 로그인 | 10단계 | ⬜ |
| 푸시 알림 | v1.1 | ⬜ |
```

---

## 13. Turborepo 통합

### turbo.json 수정

```jsonc
{
  "tasks": {
    "dev": {
      "cache": false,
      "persistent": true,
    },
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".expo/**"],
    },
    // ... 기존 태스크 유지
  },
}
```

### apps/mobile/package.json 스크립트

```jsonc
{
  "scripts": {
    "dev": "npx expo start --dev-client",
    "build:dev": "eas build --profile development --platform all",
    "build:preview": "eas build --profile preview --platform all",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
  },
}
```

> **`expo start --dev-client`**: development build에서 실행. Expo Go 대신 커스텀 빌드 사용.

### CI 워크플로우 수정

```yaml
# .github/workflows/ci.yml 수정
# mobile 앱은 네이티브 빌드가 필요하므로 CI에서 typecheck만 수행
# 실제 빌드는 EAS Build로 별도 처리
```

---

## 14. WebView 파일 업로드 검증

현재 웹앱은 `<input type="file" accept="image/*">` + `<input capture="camera">`로 사진을 처리.

### 체크포인트

- [ ] **iOS**: WebView에서 파일 선택 다이얼로그 정상 표시 (사진 보관함 / 카메라)
- [ ] **Android**: WebView에서 파일 선택 다이얼로그 정상 표시
- [ ] 선택한 사진이 기존 업로드 로직(exifreader + SHA-256 + Supabase Storage)으로 정상 처리
- [ ] 카메라로 직접 촬영한 사진도 동일하게 동작

### 알려진 이슈

- **Android**: react-native-webview는 기본적으로 파일 업로드를 지원하지만, 일부 Android 버전에서 `onShowFileChooser` 관련 이슈 존재. react-native-webview v13+에서 대부분 해결됨.
- **iOS**: `capture="camera"` 속성이 iOS WebView에서는 기본적으로 카메라를 직접 열지 않고 선택 다이얼로그를 먼저 표시할 수 있음 (iOS 기본 동작). 이건 UX 차이일 뿐 기능적으로는 동작함.
- 만약 파일 업로드가 동작하지 않으면, WebViewScreen에 `androidAllowFileUpload` 등 추가 설정 필요. 이 경우 스펙에 수정사항 추가.

---

## 15. 엣지케이스 / 주의사항

### 딥링크 / URL 스킴

- `isakok://` 스킴은 app.json에서 선언하지만 9단계에서는 활용하지 않음
- 10단계 소셜 로그인 콜백에서 필요

### Android 뒤로가기 버튼

- Android 하드웨어 뒤로가기 → WebView가 캡처 (웹앱 내부 뒤로가기)
- WebView 히스토리가 비어있으면 → 앱 종료 확인 다이얼로그 (또는 기본 동작)
- 구현: `onAndroidBackPress` prop 사용

```typescript
// WebViewScreen 내부
const [canGoBack, setCanGoBack] = useState(false)

<WebView
  onNavigationStateChange={(navState) => {
    setCanGoBack(navState.canGoBack)
  }}
/>

// BackHandler 등록
useEffect(() => {
  const handler = BackHandler.addEventListener('hardwareBackPress', () => {
    if (canGoBack && webViewRef.current) {
      webViewRef.current.goBack()
      return true // 이벤트 소비
    }
    return false // 기본 동작 (앱 종료)
  })
  return () => handler.remove()
}, [canGoBack])
```

### WebView 메모리 관리

- iOS: `WKWebView`는 시스템이 메모리 압박 시 자동 해제 가능 → `onContentProcessDidTerminate` 이벤트로 감지 → WebView reload
- Android: 큰 이슈 없음

```typescript
// WebViewScreen 내부
onContentProcessDidTerminate={() => {
  webViewRef.current?.reload()
}}
```

### 네트워크 전환 (WiFi ↔ 셀룰러)

- NetInfo로 감지
- 연결 끊김 → OfflineFallback 표시
- 재연결 → WebView reload (stale 상태 방지)

### 탭 전환 시 스크롤 위치

- WebView가 언마운트되지 않으므로 스크롤 위치 유지됨
- 단, 탭 전환 후 돌아왔을 때 데이터 갱신은 웹앱 내부의 TanStack Query `refetchOnWindowFocus`가 처리
- WebView에서는 `window.focus` 이벤트가 발생하지 않을 수 있으므로, 탭 활성화 시 네이티브에서 `PLATFORM_INFO` 메시지를 보내 갱신 트리거할 수 있음 (선택사항, 기본은 staleTime으로 처리)

### 상태바

```typescript
// apps/mobile/src/app/_layout.tsx
import { StatusBar } from 'expo-status-bar'

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      {/* ... */}
    </>
  )
}
```

### 개발 환경에서 WebView 디버깅

- **iOS**: Safari → Develop → Simulator → WebView 페이지 선택
- **Android**: Chrome → chrome://inspect → WebView 선택
- `__DEV__` 플래그로 개발 중에만 WebView 디버깅 활성화

---

## 16. 완료 확인 기준 (체크리스트)

### 프로젝트 구조

- [ ] `apps/mobile/` 디렉토리 존재 + Expo SDK 55 프로젝트
- [ ] `pnpm install` 에러 없음 (워크스페이스 정상 연결)
- [ ] `apps/mobile/CLAUDE.md` 존재
- [ ] `packages/shared/src/types/bridge.ts` 존재
- [ ] `packages/shared/src/utils/nativeBridge.ts` 존재
- [ ] `apps/mobile/src/utils/webBridge.ts` 존재

### 빌드/린트

- [ ] `pnpm build` (apps/web) → 에러 없음
- [ ] `pnpm lint` → 에러 없음
- [ ] `pnpm test` → 에러 없음
- [ ] `apps/mobile` TypeScript 타입 체크 통과 (`tsc --noEmit`)

### 네이티브 탭바

- [ ] 실기기 또는 시뮬레이터에서 3개 탭 표시 (홈, 전체, 집기록)
- [ ] 탭 아이콘 + 라벨 정상 렌더링
- [ ] 선택된 탭: primary 색상, 미선택: placeholder 색상
- [ ] 탭 전환 시 WebView 리로드 안 됨 (언마운트 안 함)

### WebView

- [ ] 홈 탭: active 이사 없음 → 온보딩 표시
- [ ] 홈 탭: active 이사 있음 → 대시보드 표시
- [ ] 전체 탭: 타임라인 페이지 표시
- [ ] 집기록 탭: 사진 페이지 표시
- [ ] WebView 로딩 중 → LoadingFallback 표시
- [ ] WebView 에러 → ErrorFallback + 재시도 버튼 동작
- [ ] 비행기 모드 → OfflineFallback 표시 → 연결 복귀 시 자동 새로고침

### 스플래시 + 앱 아이콘

- [ ] 앱 시작 시 스플래시 스크린 표시
- [ ] 웹앱 로드 완료 후 스플래시 숨김
- [ ] 5초 타임아웃 후 강제 숨김
- [ ] 앱 아이콘 placeholder 표시 (홈 화면)

### 웹앱 수정

- [ ] LandingPage 삭제됨
- [ ] `/` 접근 → EntryRedirect (active 이사 유무에 따라 분기)
- [ ] DevTabBar: 네이티브 WebView에서 숨겨짐
- [ ] DevTabBar: 웹 브라우저(pnpm dev)에서는 정상 표시
- [ ] 외부 링크 클릭 → 네이티브 환경에서 시스템 브라우저로 열림
- [ ] 체크 토글 정상 동작 (WebView 안에서)

### 파일 업로드 (실기기 검증)

- [ ] iOS: WebView에서 파일 선택 다이얼로그 표시 여부 확인 + 결과 기록
- [ ] Android: WebView에서 파일 선택 다이얼로그 표시 여부 확인 + 결과 기록
- [ ] 실패 플랫폼이 있으면 10단계 이후 네이티브 업로드 전환 TODO 기록

### 브릿지

- [ ] `isNativeWebView()` → 네이티브에서 true, 브라우저에서 false
- [ ] `WEB_READY` 메시지 → 네이티브에서 수신 확인 (스플래시 숨김 트리거)
- [ ] `OPEN_EXTERNAL_LINK` → 시스템 브라우저 열림

### Android 전용

- [ ] 하드웨어 뒤로가기 → WebView 뒤로가기 (히스토리 있을 때)
- [ ] WebView 히스토리 없을 때 뒤로가기 → 앱 종료 기본 동작

### 접근성

- [ ] 탭바: accessibilityLabel 설정 ("홈", "전체", "집기록")
- [ ] Fallback 화면: accessibilityRole, accessibilityLabel 설정

---

## 17. 다음 단계 연결

9단계 완료 후 → **10단계: 인증 + 비회원 로컬 + RLS 켜기**

10단계에서:

- Supabase Auth 도입 (소셜 로그인 Apple/카카오/Google) — 네이티브 SDK 사용
- RLS 활성화 + 정책 전수 검증
- 비회원 → 회원 마이그레이션 (IndexedDB → Supabase)
- 온보딩 우상단 "로그인" 버튼 추가 (브릿지 `REQUEST_LOGIN` 구현)
- 네이티브 카메라 전환 (expo-image-picker, EXIF/해시 네이티브 처리)
- guest_id → auth.uid() 전환
- 하드코딩 user_id 제거

---

## 18. 면접 대비 핵심 포인트

- **"왜 Expo Router?"** → 파일 기반 라우팅으로 Next.js와 동일한 DX. `Tabs` 레이아웃 내장으로 @react-navigation 직접 설정 불필요. SDK 55에서 안정 + New Architecture 기본 활성화.
- **"왜 원격 URL?"** → 웹앱 수정 시 앱스토어 업데이트 없이 Vercel 배포만으로 반영. 1인 개발에서 운영 부담 최소화. 프리캐싱은 인증/오프라인 구조 확정 후 단계적 도입.
- **"WebView 성능?"** → 탭별 WebView 유지(unmount 안 함)로 탭 전환 시 리로드 없음. React 웹앱이 가벼워서 초기 로드만 커버하면 됨. 스플래시로 로딩 감춤.
- **"브릿지 왜 이렇게?"** → postMessage 방식은 Expo 환경 표준. addJavascriptInterface는 네이티브 모듈 직접 작성 필요 → 1인 개발에서 오버엔지니어링. 브릿지 추상화 레이어로 사용 측에서는 `sendToNative({ type: 'OPEN_CAMERA' })` 형태. 나중에 순수 RN 전환 시 send 메서드 내부만 교체.
- **"Apple Guideline 4.2?"** → 9단계에서 네이티브 탭바, 스플래시, 네트워크/에러 fallback, 외부 링크 처리, 브릿지 기반 구축. 카메라/인증 같은 강한 네이티브 기능은 10단계 이후 추가. 앱스토어 제출 전 10단계 이후 네이티브 기능 통합 상태에서 Guideline 4.2 리스크 재검토.
- **"빅테크 비교?"** → 당근(네이티브+WebView 하이브리드)과 동일 패턴. 변경 잦은 화면은 웹, 플랫폼 종속 기능은 네이티브. 토스도 일부 화면에서 WebView 사용.
