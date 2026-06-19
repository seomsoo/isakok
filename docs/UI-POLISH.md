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

## 13. 마이크로 인터랙션 정합 패스 (gap-fill + DESIGN.md §8 정합)

**증상**: 마이크로 인터랙션이 화면마다 들쭉날쭉. 어떤 곳은 적용돼 있고(Button pressed, Toast 진입, FAB 회전, 일부 카드 `active:scale`) 어떤 곳은 비어 있었다 — 스켈레톤→콘텐츠 급교체(페이드 없음), 시트 진입 애니메이션 없음(PhotoDetailSheet·PushPermissionSheet·MoveEditSheet), Toast 퇴장 애니메이션 없음, 햅틱 전무, duration 혼재(100/150/200/500ms), 미사용 `check-pop` 키프레임. "AI 티" 제거(화면 룩)와 별개로, 누락을 채우고 기존 불일치를 DESIGN.md §8에 맞춰 일관화.

**개선**:

- **공유 프리미티브** — `requestHaptic(style)` 헬퍼 추가(`nativeBridge.ts`): 웹→네이티브 `REQUEST_HAPTIC` 래핑(네이티브 expo-haptics 핸들러는 기존 배선, `WebViewScreen.tsx`). 비네이티브에선 `sendToNative` dev 폴백으로 무음. `index.css`에 `@keyframes fadeIn`·`.animate-fade-in`(200ms)·`.animate-sheet-in`(슬라이드업 300ms cubic-bezier(0.33,1,0.68,1)) 추가, `check-pop`을 250→150ms로 §8 정합, `prefers-reduced-motion`에서 커스텀 키프레임 무효화. `useCheckPop` 훅 — 완료가 false→true로 바뀌는 순간에만 scale pop(목록 진입 시 전 체크가 한꺼번에 튀는 것 방지).
- **시스템 컴포넌트** — Toast 퇴장(opacity 150ms ease-in, `ToastProvider`가 제거 전 leaving 상태 유지), ProgressBar·타임라인 인라인 진행바 500→300ms, CircularProgress `stroke-dashoffset` transition 추가(값 변할 때 채워짐).
- **갭 채우기** — 페이지 콘텐츠 등장 페이드(Dashboard·Photos·Timeline·ChecklistDetail, 콘텐츠 컨테이너 1개에만), 시트 진입(PhotoDetailSheet·PushPermissionSheet 슬라이드업+백드롭 페이드 / MoveEditSheet 페이드), press 피드백·duration 100ms 정합(ActionSection·PreCheckItem·RelatedLinkCard·DeleteAccount 확인 버튼), HousingTypeGrid press scale, 체크 토글 pop(ChecklistItem·PreCheckItem), FAB 메뉴 등장 페이드.
- **햅틱 배치** — 토글은 `useToggleItem` onMutate에 **중앙화**(완료=success / 해제=light / 실패=error → 리스트·액션·상세 어디서 눌러도 단일 지점). 칩 선택(SelectionChip)·인앱 탭(PhotoTopTabs)=light, 이사정보 저장 성공(MoveEditSheet)·미디어 업로드 완료=success, 파괴적 확정(계정 삭제·사진 삭제)=heavy.

**판단**:

- 등장 페이드는 **페이지 콘텐츠 컨테이너 1개에만** 적용 — 섹션별로 걸면 stagger(§8-3 금지)·이중 페이드가 됨. DESIGN.md §8-2에 "콘텐츠/리스트 등장" 행 추가, §8-3에 "컨테이너 단위 페이드는 허용" 단서 명시.
- MoveEditSheet는 전체화면 모달이라 슬라이드 대신 **페이드** — §8-3 "화면 전체 슬라이드 전환 금지"(네이티브 전환과 충돌) 준수. 진짜 바텀시트(PhotoDetail·PushPermission)만 슬라이드업.
- 햅틱 토글을 단일 지점으로 모음 — 스펙의 "리스트=light / 상세 완료=success" 분리 대신, 완료는 어디서든 success로 통일(완료의 보람을 일관되게). DevTabBar(웹 탭) 햅틱은 생략 — 네이티브에선 숨겨지고 네이티브 탭바가 자체 햅틱 처리(`(tabs)/_layout.tsx`).
- 신규 모션 라이브러리 미도입 — 기존 Tailwind 키프레임 + SSGOI 유지(CSS-only).

**검증**: `pnpm lint`·`typecheck`·`build` 통과. 온보딩 스모크(Playwright) — 렌더 정상, JS 에러 없음(favicon 404만), SelectionChip 클릭 시 `[NativeBridge] (dev fallback) … REQUEST_HAPTIC` 발화 확인(햅틱 배선 end-to-end). 브라우저에선 진동 체감 불가 → 실기기 follow-up.

**Follow-up**: 실기기(TestFlight)에서 햅틱 세기 체감 + 데이터 의존 화면(대시보드·타임라인·사진 시트)의 등장 페이드·체크 pop·시트 진입을 실제 데이터로 시각 확인(dev=prod 단일 프로젝트라 온보딩 제출은 prod 쓰기 발생, 본 패스에선 미수행).

**파일**: `packages/shared/src/utils/nativeBridge.ts`, `packages/shared/src/index.ts`, `apps/web/src/index.css`, `apps/web/src/shared/hooks/useCheckPop.ts`, `apps/web/src/shared/components/{Toast,ToastProvider,ProgressBar,CircularProgress,ChecklistItem}.tsx`, `apps/web/src/pages/{Dashboard,Photos,Timeline,ChecklistDetail}Page.tsx`, `apps/web/src/features/dashboard/{components/ActionSection,hooks/useToggleItem}`, `apps/web/src/features/{onboarding/components/{SelectionChip,HousingTypeGrid,PushPermissionSheet},photos/components/{PhotoDetailSheet,PhotoTopTabs,PhotoUploadFab,DeletePhotoDialog},photos/hooks/useMediaUploadListener,settings/components/{MoveEditSheet,DeleteAccountSheet},pre-check/components/PreCheckItem,checklist-detail/components/RelatedLinkCard}`, `docs/DESIGN.md`

## 14. 에러 상태 통일 — 네이티브 느낌 (gap-fill + ErrorBoundary)

**증상**: 에러 처리가 화면마다 제각각이었다 — 일부는 아예 없고(Dashboard·Timeline·PhotoReport·PhotoTrash는 `isError` 분기 없이 멈춤/빈 화면), 있어도 비일관(ChecklistDetail은 자체 UI, Photos는 `ErrorMessage`). 게다가 `apps/web/CLAUDE.md`가 "최상위 Error Boundary"를 명시했지만 **실제 코드엔 없어서**(grep 0건) 렌더 크래시 시 흰 화면. WebView 앱에서 흰 화면·멈춤·브라우저 기본 에러는 가장 큰 "웹 티"라 §13 인터랙션과 한 결로 흡수.

**개선** — 에러를 3레이어로 일원화:

- **렌더 크래시 → `ErrorBoundary` 신규** (`shared/components/ErrorBoundary.tsx`): React 제약상 유일하게 class. App.tsx `TransitionLayout`에서 `Outlet`을 pathname 키로 감싸 화면 이동 시 자동 복구. 폴백은 `ErrorMessage` 톤("문제가 발생했어요" + 다시 시도). **재시도 = 상태 리셋**(`window.location.reload` 금지 — WebView 콜드로드 깜빡임 = 웹 티).
- **조회 실패 → `ErrorMessage` + `refetch`** (early-return): 누락 4페이지(Dashboard·Timeline·PhotoReport·PhotoTrash) 추가, ChecklistDetail 자체 UI를 공통으로 교체. 주 데이터(move) 실패=전체 폴백 / 보조 섹션(대시보드 항목·타임라인) 실패=그 자리에 인라인 `ErrorMessage`로 헤더·탭바 유지. 재시도는 TanStack `refetch()`(제자리, reload 아님). 훅은 이미 `useQuery` 전체를 반환해 `isError`/`refetch` 노출 — 페이지 배선만.
- **동작 실패 → `toast.error`** (기존 일관, 감사만): mutation은 이미 toast로 normalize. §13에서 실패에 `requestHaptic('error')`도 붙어 촉각까지 일관.

**판단**:

- 재시도를 reload 아닌 제자리 `refetch`/상태 리셋으로 — 콜드로드 깜빡임 제거가 "네이티브 느낌"의 핵심 조건. 복구 시 §13의 `.animate-fade-in`으로 콘텐츠 부드럽게 등장.
- 섹션 단위 에러 우선 — "페이지가 통째로 깨졌다"가 아니라 "이 부분만 못 불러왔다"로 보이게 앱 크롬 유지.
- `ErrorBoundary`는 라우트 키로 마운트 → 별도 reset 로직 없이 네비게이션만으로 복구.
- 컨벤션을 `apps/web/CLAUDE.md` "UI 패턴"에 3레이어로 명문화(서술과 실제 일치화).

**검증**: `pnpm lint`·`typecheck`·`build` 통과. (에러 화면 실제 트리거는 네트워크 차단 등 필요 → 실기기/수동 follow-up.)

**Follow-up**: `ErrorBoundary`에서 Sentry 캡처 연동 검토(현재 `console.error`, 전역 핸들러 의존) · 데이터 의존 화면에서 실제 네트워크 실패로 에러 UI 시각 확인.

**파일**: `apps/web/src/shared/components/ErrorBoundary.tsx`, `apps/web/src/App.tsx`, `apps/web/src/pages/{Dashboard,Timeline,ChecklistDetail,PhotoReport,PhotoTrash}Page.tsx`, `apps/web/CLAUDE.md`

## 15. UX 라이팅 가이드 도입 + 앱 문구 정합 + 이모지 정리

**배경**: 앱 문구 정본이 없어 DESIGN.md §1-5의 톤 원칙 3줄만 있었고, 실제 문구는 화면마다 미세하게 달랐다(격식체·수동형·과한 경어 혼재). 사용자가 작성한 `docs/ux-writing-guide.md`를 **문구 정본**으로 채택하고 기존 문서·코드를 거기에 맞춰 정합.

**문서 연결**: DESIGN.md(헤더 상호참조 + §1-5 "문구 정본=ux-writing-guide.md, 이 문서는 시각만"), `docs/CLAUDE.md`(문서 인덱스 등록), `apps/web/CLAUDE.md`(스타일·에러 3레이어에서 문구 가이드 가리킴). 약관·개인정보처리방침은 **합쇼체 유지** — 가이드 §1 "약관 안내 해요체"는 짧은 안내 문구를 뜻하지 법률 전문(全文)은 아니라고 해석(법적 고지 성격).

**문구 정합(코드)** — 적극 개선:

- 능동형(§2): "삭제/수정/복사되었어요" → "삭제/수정/복사했어요"(DeleteAccountSheet·useUpdateMove·PhotoReportPage), "N장 저장 완료" → "N장 저장했어요"(§5)
- 해요체(§1): "복구할 수 없습니다" → "없어요", sr-only "불러오는 중입니다" → "불러오고 있어요"
- 과한 경어 제거(§4): "직접 끊으실 수" → "끊을 수", "동의합니다" → "동의해요"
- 다이얼로그(§7): 메인 버튼 "삭제하기" → "계정 삭제하기"(무엇이 사라지는지 명시), 확인 다이얼로그 "취소/삭제" → "닫기/삭제하기"
- 에러 = 원인+해결(§3): "네트워크 오류가 발생했어요" → "연결이 끊겼어요. 다시 시도해주세요"
- 풀어쓰기(§5): "먼저 처리해보세요" → "먼저 해보세요"

**이모지 정리(§9 "본문에 흩뿌리지 않기")**:

- MotivationCard: 진행률별 이모지(🎉🔥✨💯👋) + critical 💛 전부 제거(`getEmoji` 함수 삭제). 응원 텍스트는 유지.
- roomMeta: 방 아이콘 이모지(🚪🛏🚿🍳🌿📦)는 **렌더링되지 않는 dead 필드**라 interface+데이터에서 통째로 제거(UI 영향 0, 죽은 코드 정리 겸).

**판단**: §8 안심 문구는 온보딩이 주소·연락처를 받지 않아 대상 없음(N/A). `throw new Error`·`console.*`는 개발자용이라 가이드 대상 외.

**검증**: web `typecheck`·`lint` 통과, shared `test` 21/21.

**파일**: `docs/DESIGN.md`, `docs/ux-writing-guide.md`, `docs/CLAUDE.md`, `apps/web/CLAUDE.md`, `apps/web/src/features/settings/components/DeleteAccountSheet.tsx`, `apps/web/src/features/settings/hooks/useUpdateMove.ts`, `apps/web/src/pages/PhotoReportPage.tsx`, `apps/web/src/features/photos/hooks/useMediaUploadListener.ts`, `apps/web/src/features/dashboard/components/{TodaySection,MotivationCard}.tsx`, `apps/web/src/pages/EntryRedirect.tsx`, `packages/shared/src/constants/roomMeta.ts`

## 16. OSS 라이선스 요약형 → 전문형 (전문 포함 + SPDX 합성)

**배경**: 설정 > 오픈소스 라이선스 페이지가 `이름·버전·라이선스명(MIT)`만 나열(요약형). MIT/ISC는 **저작권·허가 고지문 전문**을 배포물에 포함해야 해 라벨만으론 불완전 — `10-4-public-release-verify.md`의 "법무 고지 완전성" follow-up과 연결.

**개선**:

- 생성기(`gen-oss-licenses.mjs`): 각 패키지 `node_modules`의 LICENSE 파일 전문을 읽어 포함(파일명 관례 9종 + `license*` 폴백). 파일을 안 싣는 패키지(Expo 계열 19개 등)는 **SPDX 표준문안(MIT/ISC)을 package.json author로 합성**하고 `synthesized: true` 플래그 부여(license-checker류 관행).
- 결과 데이터: 43개 = 파일 전문 24 + 합성 19 + 누락 0. 크기 +7.9KB(gzip — 라이선스 문구 반복성으로 압축률 높음).
- 페이지: 목록 → **탭하면 전문 펼침(아코디언, 한 번에 하나)**, 접근성(`aria-expanded`/`aria-controls`·쉐브론 회전 motion-reduce 가드), 합성 항목엔 "LICENSE 파일 미포함, 표준 문안 표기" 안내 줄.

**판단**:

- 별도 상세 라우트 대신 아코디언 — 전 페이지 eager import 구조(앱 전반 `React.lazy` 0건)에 맞고 동적 라우트·전환 추가 불필요.
- 양 플랫폼 동시 적용 — WebView가 띄우는 한 페이지 + 데이터에 RN/Expo 의존성 포함.
- **잔여**: 전이 의존성(transitive deps) 미포함은 여전(verify §198). 저빈도 라우트라 code-split 미적용(perf 비차단).

**검증**: `typecheck`·`lint`·`build` 통과(번들 +7.9KB gzip).

**운영**: 의존성 추가/업데이트 후 `node scripts/gen-oss-licenses.mjs` 재실행하면 목록·전문 자동 갱신.

**파일**: `scripts/gen-oss-licenses.mjs`, `apps/web/src/data/ossLicenses.ts`(생성물), `apps/web/src/pages/OssLicensesPage.tsx`
