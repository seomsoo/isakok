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
      NSCameraUsageDescription: '집 상태를 사진으로 기록하기 위해 카메라 접근이 필요합니다',
      NSPhotoLibraryUsageDescription: '집 상태 사진을 갤러리에서 선택하기 위해 접근이 필요합니다',
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
  },
  plugins: [
    'expo-router',
    'expo-font',
    'expo-apple-authentication',
    'expo-secure-store',
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
