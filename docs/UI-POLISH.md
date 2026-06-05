# UI/UX 폴리싱 기록

> 실기기 테스트와 사용성 검토에서 발견한 문제를 수정하고, WebView 하이브리드 앱을 네이티브 앱 수준으로 끌어올리기 위한 개선 기록.
> 기능 구현(스펙 기반)과 분리된 폴리싱 전용 문서로, 작업이 추가될 때마다 항목을 이어 붙인다.

---

## 1. 네이티브 탭바 전환 (JS → UITabBarController)

> `Tabs` (Expo Router JS 렌더링) → `NativeTabs` (iOS UITabBarController / Android 네이티브 BottomNavigation)

**Before**: Expo Router의 `<Tabs>` 컴포넌트가 JS로 탭바를 그림. 탭 전환마다 React 리렌더 발생, iOS 기본 탭바와 미묘하게 다른 외형(폰트, 간격, 애니메이션), `tabBarStyle` 직접 제어 시 높이 불안정과 레이아웃 점프.

**After**: `expo-router/unstable-native-tabs`의 `<NativeTabs>`로 교체. 플랫폼 네이티브 탭바를 직접 사용해서 iOS UITabBarController / Android BottomNavigationView가 그대로 렌더링됨.

**변경 사항**:

- 아이콘: `@expo/vector-icons` Ionicons → **SF Symbols** (iOS) + **Material Icons** (Android). 시스템 아이콘이라 OS 업데이트에 자동으로 맞춰짐
- 탭바 show/hide: `navigation.setOptions({ tabBarStyle })` → **`TabBarContext`** + `NativeTabs.hidden` prop. Context로 WebView 브릿지 메시지(`ROUTE_CHANGE`, `SET_TAB_BAR`)에서 직접 제어
- 탭 press 햅틱: `screenListeners.tabPress`에서 `expo-haptics` Light impact 실행

**파일**: `apps/mobile/src/app/(tabs)/_layout.tsx`

---

## 2. 페이지 전환 애니메이션 (SSGOI)

> WebView SPA의 라우트 전환에 iOS push/pop 스타일 애니메이션 적용

**Before**: 라우트 전환 시 화면이 즉시 교체(hard cut). 네이티브 앱은 상세 진입 시 오른쪽에서 슬라이드인하는데, WebView SPA는 그냥 번쩍 바뀜.

**After**: `@ssgoi/react` 라이브러리의 `drill` 전환으로 iOS navigation push/pop과 동일한 애니메이션. 뒤로가기 시 자동으로 역방향 전환.

**전환 매핑**:

| 출발        | 도착                                 | 전환                             |
| ----------- | ------------------------------------ | -------------------------------- |
| 어디서든    | `/checklist/:id`                     | drill →                          |
| `/photos`   | `/photos/:room`, `/report`, `/trash` | drill →                          |
| `/settings` | `/privacy`, `/terms`                 | drill →                          |
| 탭 ↔ 탭     | —                                    | 없음 (네이티브 탭바가 즉시 전환) |

**구현 핵심**:

- `TransitionLayout` 래퍼: 모든 라우트를 `<Ssgoi>` + `<SsgoiTransition>` + `<Outlet>`으로 감싸서 개별 페이지 수정 없이 일괄 적용
- container 스크롤(`h-dvh overflow-y-auto`): SSGOI가 나가는 페이지 DOM을 clone해서 `position: absolute`로 띄우므로, 스크롤 컨테이너가 document가 아닌 wrapper여야 위치 계산이 정확함
- `overflow-x-clip`: 전환 중 오른쪽에서 들어오는 페이지가 가로 스크롤바를 만들지 않도록 차단
- `key={pathname}`: 같은 경로 내 파라미터 변경(예: `/checklist/a` → `/checklist/b`)에서도 전환 트리거

**파일**: `apps/web/src/App.tsx`, `apps/web/package.json`

---

## 3. WKWebView 스와이프백 정상화

> iOS 스와이프백 제스처에서 뒤에 보이는 스냅샷이 엉뚱한 페이지인 문제 해결

**Before**: 체크리스트 상세에서 스와이프백하면 대시보드가 아닌 **설정 화면 스냅샷**이 보임. 탭 루트에서 스와이프백하면 앱 밖으로 빠져나감.

**원인 분석**:

1. `allowsBackForwardNavigationGestures`를 상세 페이지에서만 true로 토글하는 방식이었음
2. 제스처가 false인 상태(탭 루트)에서는 WKWebView가 **페이지 스냅샷을 캡처하지 않음**
3. 나중에 제스처가 켜졌을 때 가장 최근에 찍힌 스냅샷(= 설정)이 보임
4. 탭 루트에서 스와이프가 되는 건 SPA 히스토리에 이전 엔트리(`replace` 사용으로 인한 잔여)가 남아있기 때문

**After** (핵심 인사이트 — **스와이프를 막는 게 아니라 히스토리를 깨끗하게 유지**):

1. `allowsBackForwardNavigationGestures` **항상 true** — 모든 페이지에서 스냅샷이 정상 캡처됨
2. `useGoBack` 훅: `navigate(fallback, { replace: true })` → **`navigate(-1)`** — 뒤로가기 시 히스토리 엔트리를 pop해서, 탭 루트에 도착하면 뒤로 갈 엔트리가 없음 → 스와이프 자체가 불가
3. popstate 가드(히스토리를 추가해서 막기) 방식은 시도 후 **기각** — 히스토리 엔트리가 늘어나면 오히려 스와이프할 곳이 생겨 역효과

**파일**: `apps/mobile/src/components/WebViewScreen.tsx`, `apps/web/src/shared/hooks/useGoBack.ts`

---

## 4. 체크리스트 상세 뒤로가기 출발지 복원

> 타임라인에서 진입한 상세 페이지가 뒤로가기 시 대시보드로 가는 문제 수정

**Before**: `useGoBack('/dashboard')` 하드코딩. 타임라인 탭에서 체크리스트 상세에 들어갔다가 뒤로가기하면 타임라인이 아닌 대시보드로 이동.

**After**: URL 쿼리 파라미터 `?from=dashboard|timeline`으로 출발지를 전달하고, `useGoBack` fallback을 동적으로 결정.

```text
대시보드 → /checklist/{id}?from=dashboard → 뒤로 → /dashboard
타임라인 → /checklist/{id}?from=timeline  → 뒤로 → /timeline
```

`checklistDetailPath(itemId, from)` 유틸 함수로 5곳의 중복 패턴을 통일.

**파일**: `apps/web/src/pages/ChecklistDetailPage.tsx`, 대시보드 3곳(`TodaySection`, `ActionSection`, `OverdueSection`), 타임라인 2곳(`PeriodSection`, `SkippableSection`)

---

## 5. 네이티브 ↔ 웹 브릿지 확장

### 5-1. NAVIGATE_TO — 네이티브에서 웹 라우트 제어

네이티브 셸이 WebView의 SPA 라우트를 직접 변경할 수 있는 채널. `App.tsx`의 `WebReadySignal`에서 `onNativeMessage`를 구독하고, `NAVIGATE_TO` 수신 시 React Router의 `navigate(path, { replace })` 실행. 탭 재탭 시 루트 복귀, 로그인 후 리다이렉트 등에 사용.

### 5-2. 탭 재탭 → 웹 루트 복귀

네이티브 앱에서 같은 탭을 다시 누르면 해당 탭의 루트로 돌아가는 동작. `tabPress` 이벤트 감지 → `NAVIGATE_TO` 메시지로 해당 탭의 루트 경로(`path`)를 웹에 전달.

### 5-3. REQUEST_HAPTIC — 웹 인터랙션에 촉각 피드백

체크리스트 토글 등 웹 UI 인터랙션에서 네이티브 햅틱을 트리거. `expo-haptics`로 light / medium / heavy / success / error 5종 지원.

### 5-4. WebView 스크롤 동작

- `bounces` 활성화: iOS 오버스크롤 바운스로 네이티브 스크롤 느낌
- `pullToRefreshEnabled`: Android 전용 당겨서 새로고침 (iOS는 bounces로 커버)

**파일**: `apps/mobile/src/components/WebViewScreen.tsx`, `apps/web/src/App.tsx`, `packages/shared/src/types/bridge.ts`

---

## 6. 하드코딩 경로 상수화

> 문자열로 흩어진 라우트 경로를 공유 상수로 통일

- `TAB_ROOT_PATHS` 추출: 탭 루트 여부 판별에 4곳에서 동일 배열 반복 → shared 상수로
- `checklistDetailPath(itemId, from)` 유틸: 5곳에서 `` `/checklist/${id}?from=...` `` 패턴 반복 → 함수로 추출
- `WebViewScreen.tsx`의 `PATH_LABELS`, `tabMap` 하드코딩 → `ROUTES.*` 키로 전환
- `EntryRedirect`, `SettingsPage`, `ChecklistDetailPage` 하드코딩 경로 → `ROUTES.*` 전환

**파일**: `packages/shared/src/constants/routes.ts`, `apps/mobile/src/components/WebViewScreen.tsx`, `apps/web/src/pages/EntryRedirect.tsx`, `apps/web/src/pages/SettingsPage.tsx`

---

## 7. 온보딩 1단계 뒤로가기 버튼 제거

**Before**: 온보딩 첫 스텝에 뒤로가기 버튼이 있지만, 누르면 랜딩 페이지로 이동 → 온보딩으로 다시 리다이렉트 → 무한루프.

**After**: `step > 1`일 때만 뒤로가기 버튼 표시. 1단계에서는 빈 spacer로 로그인 버튼 위치 유지. 도달 불가능한 `step === 1` 분기와 미사용 import(`useNavigate`, `ROUTES`) 제거.

**파일**: `apps/web/src/pages/OnboardingPage.tsx`

---

## 8. 익명→로그인 Conflict 확인 다이얼로그

> 비회원 데이터가 있는 상태에서 기존 계정으로 로그인할 때, 자동 전환 대신 사전 확인

**Before**: 익명 사용자가 온보딩 후 데이터를 쌓은 상태에서 이미 존재하는 계정으로 로그인하면, `linkIdentity` 실패 → `signInWithIdToken` fallback이 **자동 실행** → 기존 계정으로 전환되면서 익명 데이터는 고아 상태로 소실. 사용자에게 사전 경고 없음.

**After**: `conflict-pending` 모드 도입. `linkIdentity` 실패 시 즉시 로그인하지 않고, `confirm` 클로저를 반환해서 UI가 확인을 받은 뒤에만 세션을 전환.

**AuthService 변경 (핵심 패턴)**:

```ts
// tryLinkIdentity 실패 시 — 바로 fallback하지 않고 대기
return {
  mode: 'conflict-pending',
  providerName: name,
  confirm: async () => {
    // 사용자가 확인한 뒤에만 실행
    await supabase.auth.signInWithIdToken({ ... })
    return { mode: 'signed-in', userId }
  },
}
```

- Google/Apple: `signInWithIdToken`을 `confirm` 클로저 안으로 이동
- Kakao: Edge Function에서 받은 토큰을 들고 있다가 `confirm` 시 `setSession` 호출

**UI (auth.tsx) — OS 네이티브 Alert**:

- `Alert.alert`로 확인 다이얼로그 표시 (iOS `UIAlertController`, Android `AlertDialog`)
- "로그인" 버튼에 `style: 'destructive'` — 데이터 삭제 행위를 OS 수준에서 강조
- 취소 시 아무 일도 없음 (익명 세션 + 데이터 그대로 유지)
- 커스텀 모달 대신 네이티브 Alert 선택: 파괴적 확인은 OS 다이얼로그가 HIG/Material 표준

**파일**: `apps/mobile/src/auth/AuthService.ts`, `apps/mobile/src/app/auth.tsx`

---

## 9. 온보딩 헤더 정리 (로그인 진입 제거 + 프로그레스바 간격)

> 7번에서 뒤로가기 버튼만 정리했던 온보딩 헤더를, 로그인 진입점까지 빼서 "한 화면 한 역할"로 단순화

**Before**: 온보딩 헤더 우상단에 "로그인" 텍스트 버튼(`LoginEntryButton`)이 상시 노출. 3스텝(이사일→주거유형→계약유형) 흐름과 경쟁하는 두 번째 CTA였고, 첫 사용자에게 "계정 만들어야 하나?"라는 망설임을 유발 → 익명 우선(anonymous-first) 약속과 모순. 프로그레스바(화물차→집 일러스트)는 뒤로가기 줄에서 32px(`mt-8`) 떨어져 떠 있었음.

**After**:

- **로그인 진입 버튼 제거** — "가치 먼저, 인증 나중(deferred auth)" 패턴. 로그인 진입점은 **사진 게이트(`photo_gate`, 맥락 기반)** + **설정(상시)** 두 곳으로 충분. 온보딩은 체크리스트 생성이라는 단일 목적에만 집중.
- **프로그레스바 간격 축소** (`mt-8` → `mt-3`, 이후 사용자가 0으로 추가 조정). 화물차 일러스트가 헤더에 "딸려 있는" 느낌이 되도록. 인라인(뒤로가기와 한 줄)은 트랙 출발점이 스텝마다 좌우로 점프해서 기각.
- 미사용 import(`useSession`, `sendToNative`) 제거.

**설계 판단**: 화물차→집 프로그레스바는 단순 유틸 막대가 아니라 **브랜드 delight 요소**라 제거하지 않고 자기 공간을 유지. 짧은 3스텝이라 일반 막대였으면 생략도 고려했을 것.

**파일**: `apps/web/src/pages/OnboardingPage.tsx`

---

## 10. 계정 삭제 플로우 간소화 (다이얼로그화 + 문구 정리)

> 풀스크린 확인 단계를 다이얼로그로 바꿔 뎁스를 줄이고, 개발자 용어/장황한 버튼 문구 정리

**Before**: `info`(체크박스 동의) → `confirm`(풀스크린 "정말 삭제하시겠어요?") → `pending` 3단계. info에 이미 동의 체크박스가 있는데 풀스크린 확인이 한 번 더 = **중복 뎁스**. 데이터 목록에 "(Storage 원본 포함)" 같은 개발자 용어 노출. 진행 버튼 문구 "계정 삭제로 진행하기"(10자).

**After**:

- **풀스크린 `confirm` 단계 → 바텀시트 다이얼로그**(`alertdialog`). `info` → 다이얼로그 → 삭제로 뎁스 1단계 감소. 기존 `DeletePhotoDialog` 패턴과 통일(`slideUp` 애니메이션, 취소/삭제 2버튼).
- 문구 "(Storage 원본 포함)" **제거** — 일반 사용자에게 무의미한 개발 용어.
- 진행 버튼 "계정 삭제로 진행하기" → **"삭제하기"**.
- 접근성: 다이얼로그 열리면 안전한 **'취소'에 기본 포커스**, Escape는 다이얼로그만 닫고 시트는 유지.

**설계 판단**: 영구 삭제(되돌릴 수 없음)라 최종 확인 1회는 유지하되, "새 화면으로 넘어가는" 무거운 풀스크린 대신 가벼운 다이얼로그로. info의 동의 체크박스가 이미 의도 확인 역할을 하므로 과한 마찰 제거.

**파일**: `apps/web/src/features/settings/components/DeleteAccountSheet.tsx`

---

## 11. 로그인 화면 — 복귀 동작 + 소셜 버튼 브랜드 가이드

### 11-1. "나중에 할게요" → 이전 화면 복귀

**Before**: 스킵 시 `router.replace('/')` → 진입 경로(설정/사진 게이트)와 무관하게 **무조건 홈(대시보드)** 으로 이동. 안드로이드 하드웨어 뒤로가기(`back`)와 동작도 불일치.

**After**: `router.canGoBack() ? router.back() : router.replace('/')`. 로그인 화면은 `push('/auth')`로 띄워지므로 `back()`이 **진입 직전 화면으로 정확히 복귀**. 스택이 비면 홈으로 폴백. 하드웨어 뒤로가기와 동작 일치(부수 개선). 로그인 _성공_ 경로(`replace('/')`)는 의도적으로 유지.

### 11-2. 소셜 로그인 버튼 브랜드 가이드 적용

**Before**: 로고 없이 글자만("Apple로 시작하기" 등) + 배경색만. 애플/구글/카카오 브랜드 가이드 **미준수** → App Store 심사 거절 리스크. 카카오 글자색도 비공식값(`#3C1E1E`).

**After** — 레이아웃만 통일(full-width · 높이 52 · radius 12 · gap 12)하고 색·로고·문구는 각 브랜드 공식 스펙대로:

| 제공자 | 구현                                                                                               | 공식값                                                        |
| ------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| 애플   | `expo-apple-authentication`의 **공식 `AppleAuthenticationButton`** (HIG 100% 준수, 로고·문구 내장) | 검정 버튼, cornerRadius 12, 52px                              |
| 구글   | 커스텀 버튼 + **공식 4색 G 로고 SVG**                                                              | 배경 #FFFFFF, 테두리 #747775, 텍스트 #1F1F1F                  |
| 카카오 | 커스텀 버튼 + **공식 말풍선 심볼 SVG**                                                             | 배경 #FEE500, 텍스트·심볼 검정 85%, radius 12 (가이드 명시값) |

- **`react-native-svg@15.15.3` 추가** — 로고를 SVG로 인라인(해상도 무관 선명, 에셋 파일 불필요). SDK 55 호환 버전.
- 순서: iOS=애플 먼저, Android=카카오 먼저 (기존 `ordered` 정렬 유지 — 한국 앱 관행).

**설계 판단**: "버튼을 똑같이"가 아니라 **"레이아웃만 통일, 브랜드 색·로고·문구는 각 가이드대로"** — 사용자는 색으로 브랜드를 인지하므로 색이 다른 게 정상. 애플은 직접 커스텀 시 심사 리스크가 있어 공식 네이티브 버튼 사용.

**확인 필요(Follow-up)**: 카카오 심볼은 공식 *형태*로 재현했으나 가이드의 "형태·비율·색상 변경 불가" 규정상, 빌드 후 실제 카카오 버튼과 시각 대조 권장. 미세하게 다르면 `KakaoSymbol.tsx`의 `d="..."` 한 줄만 공식 SVG로 교체.

**파일**: `apps/mobile/src/app/auth.tsx`, `apps/mobile/src/components/GoogleLogo.tsx`, `apps/mobile/src/components/KakaoSymbol.tsx`, `apps/mobile/package.json`

## 12. WebView 콜드 로드 견고화 (자동 재시도 + 스톨 타임아웃 + 기본 에러 억제)

**증상**: 대시보드에 있다가 전체/집기록 탭을 처음 누르면 한번씩 네이티브 "다시 시도"(ErrorFallback) 화면이 떴다. 탭마다 독립 WebView(ADR-035)라 첫 진입 시 원격 URL(ADR-036)을 콜드 로드하는데, 자동 재시도가 없고 타임아웃이 빡빡(15초)해서 잠깐의 네트워크 끊김도 곧장 에러 화면이 됐다. 진짜 네이티브 앱엔 없는 "웹뷰 티".

**개선** (`apps/mobile/src/components/WebViewScreen.tsx`):

- **자동 무음 재시도**: 실패 시 스피너 유지하며 최대 2회 reload(800ms backoff), 소진 후에만 ErrorFallback → 잠깐의 끊김은 사용자 모르게 복구.
- **스톨 기반 타임아웃**: 15초 절대 → 30초 + 진행마다 재무장. "느리지만 받는 중"인 로드는 살리고 "멈춘" 로드만 실패 처리.
- **RNW 기본 에러 페이지 제거**: onError에서 `preventDefault()` → "NSURLErrorDomain / Error loading page" 영문 기본 화면 플래시 제거, 우리 디자인(스피너 → ErrorFallback)만 노출.
- **진단 로그**(`__DEV__`): 실패 소스(onError/httpError/stall) + 재시도 횟수 — 원인 추적용.

**검증**: 실기기에서 Vite 서버만 중단 후 탭 전환 → 자동 2회 재시도 → ErrorFallback 1회(무한 reload 없음), 기본 에러 페이지 미노출, 복구 정상.

**판단**: 구조 전환(단일 WebView)·오프라인 셸은 비용이 커 보류, 견고화만 선반영(상세 ADR-084). Codex 리뷰 P1(onLoadEnd가 재시도 상태를 덮어쓰던 버그) 반영.

**파일**: `apps/mobile/src/components/WebViewScreen.tsx`
