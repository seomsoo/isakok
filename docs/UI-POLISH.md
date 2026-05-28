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
