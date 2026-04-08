# 프로젝트 상태

> 마지막 업데이트: 2026-04-08

## 현재 단계

3단계: 대시보드 + 타임라인 + 설정 — 구현완료-검증대기

## 완료된 것

### 1단계: Supabase 세팅

- supabase/migrations/00001~00004: 테이블, RPC, RLS, Storage
- supabase/seed.sql: 마스터 체크리스트 46개
- apps/web/src/lib/supabase.ts: 클라이언트 초기화
- packages/shared/src/types/database.ts: Supabase 타입
- docs/specs/01-supabase-setup.md, 01-verify.md

### 2단계: 온보딩

- 온보딩 3스텝 폼: StepMovingDate, StepHousingType, StepContractAndMove
- CalendarPicker, HousingTypeGrid, SelectionChip, CheckTip 컴포넌트
- OnboardingPage (라우트 + ProgressBar + 뒤로가기)
- OnboardingFooter: 하단 CTA 공통 컴포넌트, 상단 블러 그라데이션
- useCreateMove 훅 + move 서비스
- onboardingStore (Zustand)
- LandingPage, DashboardPage (플레이스홀더)
- Button, ProgressBar, OfflineBanner 공통 컴포넌트
- cn.ts (clsx + tailwind-merge), queryClient.ts
- **ProgressBar 리디자인**: Truck -> Home 아이콘 이동 방식 (완료 시 트럭이 집 아이콘으로 변환)
- **Pre-check 페이지**: 온보딩 완료 후 밀린 항목 사전 체크 (일회성, 자동 건너뛰기)

### 디자인 시스템

- OKLCH 디자인 토큰 전환 (index.css @theme)
- 타이포 토큰: --text-h1 ~ --text-caption 6개
- design-style-guide.md, component-design-spec.md 추가
- 토스 스타일 기반 디자인 톤 변경

### 3단계: 대시보드 + 타임라인 + 설정

#### 대시보드 (완료)

- **DdayCard**: D-Day 숫자 + 원형 진행률 (가로 프로그레스 바 제거 -- 원형으로 충분)
- **GreetingHeader**: D-Day 기반 동적 인사 문구
- **ActionSection**: 오늘 할 일 + 밀린 할 일 통합, guide_type 우선순위 정렬 (critical > warning > tip), 인라인 뱃지, 체크박스 좌측 + 화살표 우측, 최대 3개 표시
- **UpcomingSection**: 내일/이번 주/다음 주 그룹핑, 점(dot) + 호버 효과, 최대 6개 미리보기
- **MotivationCard**: 진행률 기반 동적 응원 메시지
- **PhotoPromptCard**: D-Day 전후 문구 분기, 집기록 유도 CTA
- **PageHeader, DevTabBar, CircularProgress, Badge, Skeleton**: 공통 컴포넌트

#### 대시보드 훅/서비스 (완료)

- useCurrentMove, useTodayItems (overdue + today + upcoming 분리), useToggleItem (낙관적 업데이트)
- useTimelineItemsForProgress (진행률 계산용)
- services/checklist.ts: getTodayItems, getOverdueItems, batchCompleteItems
- services/move.ts: getCurrentMove
- queryKeys.ts: 쿼리 키 상수

#### 타임라인 (완료)

- TimelinePage, PeriodSection, CompletedSection, TimelinePromptCard
- useTimelineItems 훅
- 정렬 (시간순/카테고리별), 검색, Truck -> Home 프로그레스 바

#### 설정 (완료)

- SettingsPage, MoveInfoSection, MoveEditSheet, SettingsMenuList
- useUpdateMove 훅
- services/settings.ts: updateMoveWithReschedule

#### 데이터 변경 (Supabase 원격 반영 완료)

- **guide_type 재분류**: 13개 항목 수정 (10 tip->warning, 4 warning->critical)
- **카테고리명 단축**: 업체/이사방법->업체, 정리/폐기->정리, 행정/서류->행정, 공과금/정산->정산, 통신/구독->통신, 짐싸기/포장->포장, 집상태기록->기록, 이사당일->당일, 입주후->입주
- **제목 단축**: 30개 항목 모바일 표시 최적화
- seed.sql, master-checklist-data.md 동기화 완료

#### 검증 (진행 중)

- docs/specs/03-verify.md 작성 완료
- 빌드/린트/테스트 모두 통과
- Codex 코드리뷰 완료 (P2 이슈 2건 발견)
- 미사용 컴포넌트 삭제: CategoryChips, ProgressStepper (의도적 미사용)

## 진행 중인 것

- 3단계 검증 P2 이슈 수정 대기

## 다음 할 것

1. P2 수정: `/photos` 라우트 등록 (placeholder 페이지 또는 DevTabBar에서 비활성화)
2. P2 수정: PreCheckPage 에러 핸들링 (쿼리 실패 시 에러 UI 표시)
3. 스펙 문서 동기화: DevTabBar 아이콘/라벨 변경 반영 (타임라인->전체, TrendingUp->ClipboardList)
4. feat/dashboard-core -> main PR 생성

## 알려진 문제

- `/photos` 라우트 미등록: DevTabBar 집기록 탭 클릭 시 랜딩으로 fallthrough (P2)
- PreCheckPage 에러 핸들링: overdue 쿼리 실패 시 pre-check 무조건 건너뜀 (P2)

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 -- auth.uid()가 NULL일 때 가드 스킵됨. 반드시 `IS DISTINCT FROM` 사용
- Tailwind v4 font-size 토큰: `--font-size-*`가 아니라 `--text-*` 네임스페이스 사용해야 `text-h1` 유틸리티가 생성됨
- 커밋 단위: 한번에 몰아서 커밋하지 않음. 작업 단위(파일 1~3개) 기준으로 분리 커밋 (플러그인 사용이 원인)
- ActionSection 뱃지 레이아웃: 제목 위에 뱃지 배치 시 세로 정렬이 어색함 -> 같은 줄 인라인 배치가 깔끔
