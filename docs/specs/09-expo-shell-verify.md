# 9단계 검증 리포트: Expo 셸 + WebView 래핑

> 검증일: 2026-05-11 (최종 갱신)
> 스펙: docs/specs/09-expo-shell.md
> 브랜치: feat/expo-shell

---

## 완료 확인 기준 결과

### 프로젝트 구조

- [x] `apps/mobile/` 디렉토리 존재 + Expo SDK 55 프로젝트 (`expo: ~55.0.23`)
- [x] `pnpm install` 에러 없음
- [x] `apps/mobile/CLAUDE.md` 존재
- [x] `packages/shared/src/types/bridge.ts` 존재
- [x] `packages/shared/src/utils/nativeBridge.ts` 존재
- [x] `apps/mobile/src/utils/webBridge.ts` 존재

### 빌드/린트

- [x] `pnpm build` (apps/web) → 에러 없음 (818.06 kB JS, 48.94 kB CSS)
- [x] `pnpm lint` → 에러 없음 (3 packages)
- [x] `pnpm test` → 16 tests passed (3 files)
- [x] `apps/mobile` TypeScript 타입 체크 통과 (`tsc --noEmit`)
- [x] iOS 빌드 (`expo run:ios`) → Build Succeeded (Xcode 26.2, iPhone 17 Pro 시뮬레이터)

### 네이티브 탭바

- [x] 3개 탭 표시 (홈, 전체, 집기록) — 코드 검증
- [x] 탭 아이콘 (home-outline, list-outline, camera-outline) + 라벨
- [x] 선택된 탭: primary (#0F766E), 미선택: placeholder (#9E9E9E)
- [x] 탭 전환 시 WebView 리로드 안 됨 (Expo Router Tabs unmountOnBlur 기본 false)

### WebView

- [x] 홈 탭: path="/" → EntryRedirect → active 이사 유무 분기
- [x] 전체 탭: path="/timeline" → 타임라인 페이지
- [x] 집기록 탭: path="/photos" → 사진 페이지
- [x] WebView 로딩 중 → LoadingFallback 표시 (오버레이 방식)
- [x] WebView 에러 → ErrorFallback + 재시도 버튼 동작
- [x] 오프라인 → OfflineFallback 표시 → 연결 복귀 시 자동 새로고침 (wasOffline 상태)

### 스플래시 + 앱 아이콘

- [x] 앱 시작 시 스플래시 스크린 표시 (preventAutoHideAsync)
- [x] 웹앱 로드 완료 후 스플래시 숨김 (WEB_READY → hideSplashOnce)
- [x] 5초 타임아웃 후 강제 숨김 (SPLASH_TIMEOUT_MS = 5000)
- [x] 앱 아이콘 placeholder 존재 (icon.png, adaptive-icon.png, splash-icon.png, favicon.png)

### 웹앱 수정

- [x] LandingPage 삭제됨 (파일 부재 확인, import 잔재 없음)
- [x] `/` 접근 → EntryRedirect (useCurrentMove → 대시보드 or 온보딩)
- [x] DevTabBar: 네이티브 WebView에서 `isNativeWebView() → return null`
- [x] DevTabBar: 웹 브라우저(pnpm dev)에서 정상 표시
- [x] 외부 링크 → RelatedLinkCard에서 sendToNative OPEN_EXTERNAL_LINK
- [x] body.native-webview #root { padding-bottom: 0 } CSS 적용

### iOS 시뮬레이터 검증

- [x] iOS 빌드 + iPhone 17 Pro 시뮬레이터 실행 성공
- [x] 대시보드 진입: 이사 데이터(D+19, 1/21 필수), 체크리스트 항목 표시 확인
- [x] 탭바 3개 (홈, 전체, 집기록) 정상 표시
- [x] WebView → Supabase 연동 정상 (EntryRedirect → 대시보드 리디렉션)
- [x] 한글 폰트: iOS 26 시뮬레이터 WebKit에서 `system-ui`/`ui-sans-serif` 한글 글리프 누락 버그 확인 → `Apple SD Gothic Neo` 폰트 폴백 추가로 해결 (실기기에서는 원래 정상)
- [ ] iOS 파일 업로드 다이얼로그 직접 테스트: `allowFileAccess=true` 설정만 확인, 시뮬레이터에서 카메라/갤러리 직접 테스트 미수행

### Android 에뮬레이터 검증

- [x] Android: API 35 에뮬레이터에서 대시보드 진입/탭 전환/HTTP 로딩 확인
- [ ] Android 파일 업로드 다이얼로그 직접 테스트: 명시적 기록 없음 (`allowFileAccess=true` + react-native-webview v13+ 설정만 확인)

### 브릿지

- [x] `isNativeWebView()` → `__IS_NATIVE_WEBVIEW__` + `ReactNativeWebView` 이중 체크
- [x] `WEB_READY` 메시지 → WebViewScreen handleMessage에서 hideSplashOnce + 로딩 해제
- [x] `OPEN_EXTERNAL_LINK` → Linking.openURL

### Android 전용

- [x] 하드웨어 뒤로가기 → canGoBack이면 WebView goBack, 아니면 기본 동작
- [x] Platform.OS 분기로 Android에서만 BackHandler 등록

### 접근성

- [x] 탭바: tabBarAccessibilityLabel ("홈", "전체", "집기록")
- [x] Fallback 화면: accessibilityRole + accessibilityLabel 설정
  - LoadingFallback: role="progressbar", label="로딩 중"
  - ErrorFallback: role="alert", label="페이지 로드 실패", 버튼 role="button"
  - OfflineFallback: role="alert", label="인터넷 연결 끊김"

---

## 누락 (스펙에 있는데 구현 안 됨)

1. ~~**`WebViewScreenProps.onMessage` 선택적 prop**~~ → ✅ 수정 완료. `onMessage?: (data: unknown) => void` prop 추가 + handleMessage에서 미처리 메시지 전달.
2. ~~**`sendToNative` dev fallback console.log**~~ → ✅ 수정 완료. `console.log('[NativeBridge] (dev fallback)', wrapped)` 복원.
3. ~~**iOS 시뮬레이터 검증**~~ → ✅ 완료. iPhone 17 Pro 시뮬레이터에서 대시보드/탭바/데이터 로딩 확인. 파일 업로드는 시뮬 제약으로 미검증 (10단계 Follow-up).
4. **Vercel 배포** — 스펙 §5에서 apps/web Vercel 배포 + URL 확보 명시. 현재 dev URL(localhost/LAN IP)로 개발 중. 배포 자체는 코드 외 작업. (10단계 Follow-up)

---

## 스코프 크립 (구현했는데 스펙에 없음)

없음. 추가된 파일/기능 모두 인프라 필수 또는 정당한 개선:

- `babel.config.js`, `metro.config.js`, `env.d.ts` — Expo/RN 필수
- `usesCleartextTraffic`, `expo-font` 플러그인 — 개발 환경/아이콘 필수
- `onLoadProgress` 핸들러, `WEBVIEW_LOAD_TIMEOUT_MS` — 로버스트니스 개선
- `.npmrc` (`node-linker=hoisted`) — React Native 필수
- SafeAreaProvider 추가 — useSafeAreaInsets 사용에 필수 (스펙 누락)
- Android dev host `10.0.2.2` 플랫폼 분기 — localhost보다 나은 구현

---

## 컨벤션 위반

1. ~~**EntryRedirect에서 Loader2 직접 사용**~~ → ✅ 수정 완료. Loader2 유지 (Spinner 컴포넌트가 실제로 존재하지 않음 — 스펙 오기) + `role="status"`, `aria-live="polite"`, sr-only 텍스트 추가로 접근성 보강.
2. ~~**DevTabBar aria-current="page" 정적 할당**~~ → ✅ 수정 완료. `aria-current="page"` prop 제거. NavLink 자동 처리로 전환.

---

## Codex 코드리뷰 결과

- **[P2] release manifest cleartext 누락** — `apps/mobile/android/app/src/main/AndroidManifest.xml:14`
  - 문제: main manifest에 `usesCleartextTraffic="true"` 미설정. debug manifest만 적용되어 release/preview 빌드에서 HTTP WebView 로드 실패
  - 수정: ⏳ 미반영 (release 빌드 시 HTTPS URL 사용 예정이므로 dev 환경에서는 무관. production에서는 Vercel HTTPS URL 사용)

- **[P2] verify.md untracked files 누락** — `.claude/commands/verify.md:19`
  - 문제: `git diff main --name-only`는 untracked 파일을 포함하지 않아 신규 TSX 파일이 서브에이전트 트리거를 우회할 수 있음
  - 수정: ⏳ 미반영 (verify 명령 자체의 개선사항, 9단계 구현과 무관)

- **[P2] 루트 app.json stray** — `/Users/seominsu/isakok/app.json:2`
  - 문제: 모노레포 루트에 빈 Expo 설정 `{"expo": {}}` 존재. 루트에서 `expo`/`eas` 실행 시 apps/mobile 대신 루트를 Expo 앱으로 인식
  - 수정: ✅ 수정 완료 — 루트 app.json 삭제

---

## spec-reviewer 결과

스펙 1299줄 심층 비교 (32+ 파일 대조)

### 🔴 필수 수정 — 0건

~~1. Expo SDK 53 → 55 불일치~~ → SDK 55 전체 업그레이드 완료. expo `~55.0.23`, react-native `0.83.6`, react `19.2.0`, expo-router `55.0.14` 등 18개 패키지 일괄 갱신. 빌드/린트/테스트/iOS빌드 전체 통과.

### 🟡 권장 수정 — 4건 → 전수 수정 완료

2. ~~`WebViewScreenProps.onMessage` optional prop 누락 (§7-1)~~ → ✅ prop 추가 + handleMessage 전달
3. ~~`sendToNative` dev fallback console.log 제거 (§8-2)~~ → ✅ console.log 복원
4. ~~EntryRedirect 접근성 부재 (§9-1)~~ → ✅ role="status" + aria-live + sr-only 텍스트 추가 (Spinner 컴포넌트는 미존재 확인, Loader2 유지)
5. ~~스펙 §9-4 경로 오기~~ → ✅ `features/checklist-detail/components/`로 수정

### 🟢 양호 — 25건+

- 32+ 스펙 정의 파일 전수 존재, 브릿지 타입 byte-for-byte 일치
- WebView 15+ props 전수 일치, INJECTED_BEFORE_LOAD 동일
- 스플래시 플로우, Fallback 3종, 탭바, CSS, 외부 링크 처리 모두 일치
- SafeAreaProvider 추가, Android 10.0.2.2 dev host, SPLASH_TIMEOUT_MS 상수 추출 등 스펙 대비 개선
- WebReadySignal 별도 컴포넌트 추출 — 스펙보다 나은 구조
- 스코프 크립 없음 (추가 파일 모두 인프라 필수)
- 컴포넌트 설계: 단일 책임, StyleSheet.create, Pressable, 접근성 속성 모두 CLAUDE.md 준수

---

## 서브에이전트 리뷰 결과

### native-a11y-reviewer

🔴 3건 / 🟡 9건 / 🟢 4건

| ID  | 등급 | 파일                | 내용                                                                                                                   |
| --- | ---- | ------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| P5  | 🔴   | ErrorFallback.tsx   | "다시 시도" 버튼 Android 터치 타겟 48dp 미달 → ✅ `minHeight: 48` + `paddingVertical: 14` 적용                         |
| P9  | 🔴   | WebViewScreen.tsx   | 오프라인→온라인 전환 시 알림 없음 → ✅ `AccessibilityInfo.announceForAccessibility` 추가                               |
| P10 | 🔴   | WebViewScreen.tsx   | WebView에 `accessibilityLabel` 없음 → ✅ path 기반 label 추가 ("홈/전체 일정/집기록 웹 콘텐츠")                        |
| P2  | 🟡   | (tabs)/\_layout.tsx | tabBarAccessibilityLabel에 기능 설명 부재 (현재 title과 동일) — 미반영 (expo-router 자동 role/위치 주입으로 양호)      |
| P3  | 🟡   | LoadingFallback.tsx | ActivityIndicator 중복 읽힘 → ✅ `accessibilityElementsHidden` + `importantForAccessibility` 적용                      |
| P4  | 🟡   | WebViewScreen.tsx   | 로딩 완료 시 announceForAccessibility 없음 — 미반영 (WEB_READY 시 splash 숨김으로 화면 전환 인지 가능)                 |
| P6  | 🟡   | ErrorFallback.tsx   | 경고 아이콘 스크린리더 미숨김 → ✅ `accessibilityElementsHidden` 적용                                                  |
| P7  | 🟡   | ErrorFallback.tsx   | "다시 시도" 버튼 accessibilityHint 누락 → ✅ `accessibilityHint="페이지를 다시 불러옵니다"` 추가                       |
| P8  | 🟡   | OfflineFallback.tsx | 오프라인 아이콘 스크린리더 미숨김 → ✅ `accessibilityElementsHidden` 적용                                              |
| P11 | 🟡   | WebViewScreen.tsx   | 로딩 중 WebView 스크린리더 노출 → ✅ `accessibilityElementsHidden={isLoading}` + `importantForAccessibility` 분기 적용 |
| P12 | 🟡   | WebViewScreen.tsx   | 에러/오프라인 전환 시 포커스 관리 없음 — 미반영 (conditional render로 이전 화면 unmount, 자연스러운 포커스 이동)       |
| P13 | 🟡   | config.ts           | 비활성 탭 placeholder 색상 대비비 2.8:1 — 미반영 (비활성 상태 허용 범위)                                               |

### web-a11y-reviewer

🔴 1건 / 🟡 2건 / 🟢 6건

| ID  | 등급 | 파일                | 내용                                                                                                            |
| --- | ---- | ------------------- | --------------------------------------------------------------------------------------------------------------- |
| —   | 🔴   | EntryRedirect.tsx   | 스피너에 스크린리더 안내 부재 → ✅ `role="status"` + `aria-live="polite"` + sr-only 텍스트 + `aria-hidden` 추가 |
| —   | 🟡   | DevTabBar.tsx       | `aria-current="page"` 정적 할당 → ✅ prop 제거. NavLink 자동 처리로 전환                                        |
| —   | 🟡   | RelatedLinkCard.tsx | 외부 링크 새 창 열림 안내 부재 → ✅ aria-label을 `"${meta.name} 새 창에서 열기"`로 변경                         |

### perf-budget-reviewer

🔴 0건 (9단계) / 🟡 2건 / 🟢 4건 — 기존 기술부채 3건 별도 기록

| 등급      | 파일                     | 내용                                                                                                         |
| --------- | ------------------------ | ------------------------------------------------------------------------------------------------------------ |
| 🟡 (기존) | App.tsx + vite.config.ts | 코드 스플리팅 전무 — 817kB 단일 청크 (React.lazy 0건, manualChunks 미설정). 9단계 이전부터 존재하는 기술부채 |
| 🟡 (기존) | photos/utils/exif.ts     | exifreader 정적 import (~117kB) — 사진 업로드 시에만 필요, 동적 import 전환 권장                             |
| 🟡        | 웹앱 24곳                | barrel import 혼용 (`@moving/shared` vs `@shared/...` 직접 경로) — 컨벤션 통일 필요                          |
| 🟡        | 온보딩 CalendarPicker    | react-day-picker 정적 import (~35kB) — lazy 대상                                                             |
| 🟢        | apps/mobile/package.json | 모바일 의존성 14개 모두 적절, 불필요 패키지 없음                                                             |
| 🟢        | packages/shared/src/     | 9단계 추가분 (bridge 타입, nativeBridge, platform) — 웹 번들 영향 무시 수준                                  |
| 🟢        | turbo.json               | .expo output 추가, 태스크 설정 적절                                                                          |
| 🟢        | date-fns, lucide-react   | 개별 import, tree-shaking 정상 작동                                                                          |

---

## 종합 판정

### ✅ 통과 (minor follow-ups)

**핵심 구현 완료**: 스펙 §16 완료 기준 32개 항목 전항 통과 (파일 업로드 실기기 직접 테스트만 시뮬 제약으로 미수행). iOS/Android 빌드 + 시뮬레이터 동작 확인. 빌드/린트/테스트 모두 패스. 스코프 크립 없음. SDK 55 전체 업그레이드 (RN 0.83.6, React 19.2) 완료. 브릿지 프로토콜, WebView 래핑, 탭바, 스플래시, Fallback, 웹앱 수정 모두 스펙 일치.

### 수정 완료 요약 (15건 반영)

| 구분                      | 건수                  | 수정 내용                                                                              |
| ------------------------- | --------------------- | -------------------------------------------------------------------------------------- |
| A. Codex P2 + 시맨틱 오류 | 3건 ✅                | 루트 app.json 삭제, DevTabBar aria-current 제거, EntryRedirect 접근성                  |
| B. 네이티브 접근성 필수   | 3건 ✅                | 터치 타겟 48dp, 네트워크 복구 알림, WebView accessibilityLabel                         |
| C. 네이티브 접근성 권장   | 6건 (5건 ✅ / 1건 ✅) | 아이콘 숨김, hint 추가, WebView 로딩 중 숨김, 외부 링크 안내                           |
| D. spec-reviewer 권장     | 3건 ✅                | onMessage prop, dev fallback 복원, 스펙 경로 수정                                      |
| SDK 업그레이드            | 1건 ✅                | Expo SDK 55 전체 업그레이드 (expo, RN 0.83.6, React 19.2, 18개 패키지)                 |
| 한글 폰트 수정            | 1건 ✅                | index.css `--font-sans`에 Apple SD Gothic Neo 폴백 추가 (iOS 26 시뮬 WebKit 버그 대응) |

미반영 사유 있는 권장 항목 (3건):

- native-a11y P2: tabBarAccessibilityLabel 기능 설명 — expo-router 자동 role/위치 주입으로 현재 양호
- native-a11y P4: 로딩 완료 시 announce — splash 숨김으로 화면 전환 인지 가능
- native-a11y P12: 에러/오프라인 포커스 관리 — conditional render로 자연 포커스 이동
- native-a11y P13: placeholder 색상 대비 — 비활성 상태 허용 범위

### 10단계 Follow-ups

- iOS/Android 파일 업로드 실기기 검증 (시뮬레이터/에뮬레이터 카메라 제약)
- release manifest `usesCleartextTraffic` (production HTTPS 전환 시 불필요)
- Vercel 배포 + `EXPO_PUBLIC_WEB_APP_URL` 설정
- 코드 스플리팅 (React.lazy + manualChunks — 기존 기술부채)
