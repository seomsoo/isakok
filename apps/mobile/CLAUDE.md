# apps/mobile — Expo React Native 앱

## 역할

네이티브 셸. WebView로 웹앱을 래핑하고, 네이티브 기능(탭바, 카메라, 인증)을 제공.

## 폴더 구조

```
src/
├── app/           ← Expo Router 파일 기반 라우팅
├── components/    ← 네이티브 UI 컴포넌트
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

| 기능                | 단계    | 상태          |
| ------------------- | ------- | ------------- |
| 탭바                | 9단계   | 구현          |
| 스플래시            | 9단계   | 구현          |
| 브릿지 프로토콜     | 9단계   | 구현 (타입만) |
| WebView 파일 업로드 | 9단계   | 기존 웹 방식  |
| 네이티브 카메라     | 10단계+ | 미구현        |
| 소셜 로그인         | 10단계  | 미구현        |
| 푸시 알림           | v1.1    | 미구현        |
