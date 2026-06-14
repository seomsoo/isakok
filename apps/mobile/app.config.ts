import type { ConfigContext } from 'expo/config'

const kakaoAppKey = process.env.EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY ?? ''
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? ''
const googleIosUrlScheme = googleIosClientId.split('.').reverse().join('.')

export default ({ config }: ConfigContext) => ({
  ...config,
  name: '이사콕',
  slug: 'isakok',
  version: '1.0.0',
  orientation: 'portrait',
  icon: './assets/icon.png',
  scheme: 'isakok',
  userInterfaceStyle: 'light',
  newArchEnabled: true,
  splash: {
    image: './assets/splash-icon.png',
    resizeMode: 'contain',
    backgroundColor: '#F8F7F5',
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: 'com.isakok.app',
    usesAppleSignIn: true,
    infoPlist: {
      // 카메라는 유지. 갤러리는 iOS PHPicker(iOS 14+)라 사진 라이브러리 권한 불필요(ADR-079) → NSPhotoLibraryUsageDescription 제거.
      NSCameraUsageDescription: '집 상태를 사진으로 기록하기 위해 카메라 접근이 필요합니다',
      LSApplicationQueriesSchemes: ['kakaokompassauth', 'kakaolink', 'kakaotalk'],
      CFBundleURLTypes: [{ CFBundleURLSchemes: [`kakao${kakaoAppKey}`] }],
      // EAS production 빌드만 ATS 강제. dev/preview/로컬 expo run:ios 는 HTTP WebView 동작 유지.
      NSAppTransportSecurity: {
        NSAllowsArbitraryLoads: process.env.EAS_BUILD_PROFILE !== 'production',
      },
    },
    splash: {
      image: './assets/splash-icon-ios.png',
      resizeMode: 'contain',
      backgroundColor: '#F8F7F5',
    },
  },
  android: {
    adaptiveIcon: {
      foregroundImage: './assets/adaptive-icon.png',
      backgroundColor: '#F8F7F5',
    },
    package: 'com.isakok.app',
    usesCleartextTraffic: true,
    permissions: ['CAMERA'],
    // FCM 푸시용 — EAS 빌드는 GOOGLE_SERVICES_JSON 파일 시크릿(경로), 로컬은 gitignore된 ./google-services.json (12단계 Android FCM)
    googleServicesFile: process.env.GOOGLE_SERVICES_JSON ?? './google-services.json',
  },
  plugins: [
    'expo-router',
    // google-signin v16의 AppCheckCore(→GoogleUtilities/RecaptchaInterop)는 Swift 정적 라이브러리라
    // modular 정의가 필요 → iOS 전체를 static framework로 빌드해 modular headers 문제 해소 (12단계 EAS 빌드)
    ['expo-build-properties', { ios: { useFrameworks: 'static' } }],
    'expo-font',
    'expo-apple-authentication',
    'expo-secure-store',
    // 푸시 (12단계): iOS aps-environment 엔타이틀먼트 + Android 기본 셋업을 prebuild에 주입.
    'expo-notifications',
    // 갤러리는 PHPicker(권한 불필요)라 photosPermission 비활성, 카메라 문자열은 infoPlist에서 관리 (ADR-079)
    ['expo-image-picker', { photosPermission: false, cameraPermission: false }],
    ...(kakaoAppKey
      ? [['@react-native-seoul/kakao-login', { kakaoAppKey, kotlinVersion: '2.0.21' }]]
      : []),
    ...(googleIosUrlScheme
      ? [['@react-native-google-signin/google-signin', { iosUrlScheme: googleIosUrlScheme }]]
      : []),
    './plugins/kakao-maven',
  ] as const,
  extra: {
    router: {},
    eas: {
      projectId: 'bb04bd17-6766-42d3-bc9e-8225831aa5aa',
    },
  },
})
