# 3단계 검증 결과

> 검증일: 2026-04-08
> 대상 스펙: docs/specs/03-dashboard-timeline.md

---

## 완료 확인 기준 결과

### 빌드/린트/테스트

- [x] `pnpm build` — 성공 (tsc + vite build, 639KB bundle)
- [x] `pnpm lint` — 성공 (ESLint 에러 0)
- [x] `pnpm test` — 성공 (progress.test.ts 5개 통과)

### 파일 존재 여부

- [x] pages: DashboardPage, TimelinePage, SettingsPage, PreCheckPage
- [x] dashboard/components: DdayCard, ActionSection, UpcomingSection, MotivationCard, GreetingHeader, PhotoPromptCard, TodaySection, OverdueSection
- [x] dashboard/hooks: useCurrentMove, useTodayItems, useToggleItem, useTimelineItemsForProgress, queryKeys
- [x] timeline/components: PeriodSection, ProgressStepper, CategoryChips, CompletedSection, TimelinePromptCard
- [x] settings/components: MoveInfoSection, MoveEditSheet, SettingsMenuList
- [x] settings/hooks: useUpdateMove
- [x] services: checklist.ts, settings.ts, move.ts (수정)
- [x] stores: moveStore.ts
- [x] shared/components: ChecklistItem, CircularProgress, Badge, DevTabBar, PageHeader, Skeleton
- [x] packages/shared: progress.ts, progress.test.ts, greetings.ts, categories.ts

### 라우트 등록

- [x] /dashboard → DashboardPage
- [x] /timeline → TimelinePage
- [x] /settings → SettingsPage
- [x] /pre-check → PreCheckPage
- [x] 와일드카드 → Landing 리다이렉트

### 핵심 기능

- [x] 대시보드 진입 가드 (active 이사 없으면 랜딩으로 리다이렉트)
- [x] D-Day 카드 + CircularProgress
- [x] ActionSection (오늘+밀린 통합, guide_type 우선순위 정렬, 최대 3개)
- [x] UpcomingSection (시간대별 그룹핑)
- [x] MotivationCard (진행률 기반 동적 메시지)
- [x] PhotoPromptCard (D-Day 전/후 문구 분기)
- [x] GreetingHeader (동적 인사 문구)
- [x] 체크 토글 (낙관적 업데이트 — useToggleItem)
- [x] 타임라인: 기간별 그룹핑 + CompletedSection
- [x] 타임라인: 정렬 (시간순/카테고리별)
- [x] 타임라인: 검색
- [x] 타임라인: Truck → Home 프로그레스 바
- [x] 설정: MoveInfoSection + MoveEditSheet + SettingsMenuList
- [x] 설정: useUpdateMove (updateMoveWithReschedule RPC)
- [x] moveStore (Zustand)
- [x] Pre-check 페이지 (밀린 항목 사전 체크)

---

## 누락 (스펙에 있는데 구현 안 됨)

1. **`/photos` 라우트 미등록 (P2)** — `ROUTES.PHOTOS`가 routes.ts에 정의되고 DevTabBar에서 사용되지만, App.tsx에 `<Route path={ROUTES.PHOTOS}>` 미등록. 집기록 탭 클릭 시 랜딩으로 fallthrough됨. → **수정 완료** (placeholder 라우트 추가)
2. **PreCheckPage 에러 핸들링 미흡 (P2)** — `getOverdueItems` 실패 시 `overdueItems`가 undefined인 상태에서 `isLoading=false`가 되면, 밀린 항목이 없는 것으로 간주하고 대시보드로 리다이렉트. 쿼리 에러 상태를 체크하지 않음. → **수정 완료** (isError 체크 + 에러 UI 추가)
3. **CategoryChips 미사용** — 파일은 생성됐으나 TimelinePage에서 import하지 않음. 카테고리 필터 기능이 정렬 방식으로 대체됨. → **삭제 완료** (의도적 미사용, 파일 삭제)
4. **ProgressStepper 미사용** — 파일은 생성됐으나 TimelinePage에서 import하지 않음. → **삭제 완료** (의도적 미사용, 파일 삭제)

---

## 스코프 크립 (구현했는데 스펙에 없음)

- **Pre-check 페이지** — 2단계 스펙에 명시된 기능이나, 3단계 브랜치에서 함께 구현됨. STATUS.md에 기록되어 있어 의도된 추가.

---

## 컨벤션 위반

- **DevTabBar 아이콘/라벨 불일치** — 스펙: 타임라인 탭에 `TrendingUp` 아이콘 + "타임라인" 라벨 / 구현: `ClipboardList` 아이콘 + "전체" 라벨. → **의도된 변경**, 스펙 동기화 완료

---

## Codex 코드리뷰 결과

Codex session: `019d6bb4-5661-7110-bf77-27997b2317f2`

| 등급 | 지적사항 | 수정 여부 |
|------|----------|-----------|
| P2 | `/photos` 탭 — App.tsx에 라우트 미등록, 집기록 탭 클릭 시 랜딩 fallthrough | 수정 완료 (placeholder 라우트 추가) |
| P2 | PreCheckPage — overdue 쿼리 실패 시 에러 상태 미처리, 무조건 대시보드 리다이렉트 | 수정 완료 (isError 체크 + 에러 UI) |

---

## 종합 판정

### ✅ 통과

모든 P2 이슈 수정 완료:

1. **[P2] `/photos` 라우트 등록** — App.tsx에 placeholder 라우트 추가 완료
2. **[P2] PreCheckPage 에러 핸들링** — `isError` 체크 + 에러 UI 추가 완료
3. **[P3] 미사용 컴포넌트 삭제** — CategoryChips, ProgressStepper 삭제 완료
4. **[P4] 스펙 동기화** — DevTabBar 아이콘/라벨 변경, 폴더 구조 반영 완료
