# apps/mobile — Expo React Native 앱

## 역할

네이티브 셸. WebView로 웹앱을 래핑하고, 네이티브 기능(탭바, 카메라, 인증)을 제공.

## 폴더 구조

```
src/
├── app/           ← Expo Router 파일 기반 라우팅 ((tabs)/, auth, _layout)
├── auth/          ← 네이티브 인증 + 세션 브릿지 (AuthService, broadcast, sessionState, supabaseNative, providers/)
├── media/         ← 네이티브 미디어 업로드 (mediaUpload — Storage 직접 업로드, ADR-079)
├── components/    ← 네이티브 UI 컴포넌트 (WebViewScreen, ErrorFallback 등)
├── hooks/         ← 커스텀 훅
├── utils/         ← 브릿지, 헬퍼
└── constants/     ← 설정값
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

| 기능            | 단계 | 상태                                                                 |
| --------------- | ---- | -------------------------------------------------------------------- |
| 탭바            | 9    | ✅ 구현 (NativeTabs)                                                 |
| 스플래시        | 9    | ✅ 구현                                                              |
| 브릿지 프로토콜 | 9    | ✅ 구현 (타입 + 동작)                                                |
| 소셜 로그인     | 10-1 | ✅ 구현 (Kakao/Google/Apple, ADR-041~054)                            |
| 네이티브 미디어 | 10-4 | ✅ 구현 (카메라+갤러리 PHPicker, Storage 직접 업로드, ADR-079)       |
| 계정 삭제/약관  | 10-3 | ✅ 구현                                                              |
| 푸시 알림       | 12   | ✅ 구현 (expo-notifications, soft-ask·딥링크·Cron 발송, ADR-090~096) |
