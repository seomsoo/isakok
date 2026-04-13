# 프로젝트 상태

> 마지막 업데이트: 2026-04-13

## 현재 단계

4단계: 항목 상세 + 체크 토글 + 메모 — 구현 완료, 검증 대기

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

### 4단계: 항목 상세 + 체크 토글 + 메모

#### DB 스키마 확장 (완료)

- supabase/migrations/00005_guide_structure.sql: master_checklist_items에 guide_steps, guide_items, guide_note, guide_url 컬럼 추가
- supabase/migrations/00006_seed_guide_structure.sql: 46개 항목에 구조화된 가이드 데이터 시드

#### 페이지/라우트 (완료)

- ChecklistDetailPage (/checklist/:itemId) — 상세페이지 진입점
- App.tsx 라우트 등록, 대시보드/타임라인에서 항목 클릭 시 상세로 이동

#### 상세페이지 컴포넌트 (완료)

- **DetailHeader**: D-day 트럭 칩 + 카테고리/중요도 배지, 큰 제목, 상대일자. 과거 항목은 "지금 해도 괜찮아요" 임시 처리 (TODO: 5단계에서 모드별 교체)
- **GuideStepsSection**: Toss Stepper 스타일 (원형 번호 + 세로 연결선), "이렇게 하세요" 섹션
- **GuideItemsSection**: "미리 준비할 것" 체크리스트 (로컬 상태, 짐 챙기기 UX)
- **GuideNoteSection**: Steps 없을 때 Tip 단독 섹션 (TipCard 래퍼)
- **RelatedLinkCard**: "바로가기" 외부 링크 카드 (Globe 아이콘 + 이름/설명)
- **MemoSection**: 자동 높이 조정 textarea + 디바운스 저장(1s), 저장 중 스피너 + 저장됨 피드백
- **TipCard**: 민트 배경 + primary 좌측 바 + Lightbulb/Tip 라벨 (재사용 공통)
- **SectionTitle**: 섹션 제목 공통화 (h3 semibold, 우측 슬롯 지원)
- **CompletionStamp**: 완료 시 우측 원형 도장 오버레이 (-14deg 회전, success 톤)
- **CompletionToggleButton**: 하단 sticky CTA (완료로 표시 / 다시 할 일로 되돌리기)

#### 공통 컴포넌트 (완료)

- **SectionDivider**: 섹션 간 8px bg-border/50 띠 (TimelinePage와 동일 패턴)
- **Toast / ToastProvider**: 메모 저장 실패 등 알림용 전역 토스트

#### 훅/서비스 (완료)

- useChecklistItemDetail: 상세 조회 훅
- useUpdateMemo: 메모 업데이트 (디바운스 1s, 토스트 에러 처리)
- useToggleItem: 대시보드 훅 재사용, invalidation 범위 확장
- services/checklist.ts: getChecklistItemDetail, toggleChecklistItem, updateItemMemo

#### 공유 유틸 (완료)

- packages/shared/utils/dateLabel.ts: getRelativeDateLabel(d-day offset → 한국어 레이블), formatDateKorean
- packages/shared/constants/linkMeta.ts: URL → 사이트 이름/설명 메타 매핑

#### UI/UX 폴리싱 (완료)

- 토스 스타일 기반 + 이사앱 아이덴티티: 트럭 칩, 완료 스탬프, 짐 챙기기 UX
- D-day 칩 시각 위계: bg-primary + white 텍스트로 카테고리 배지와 구분
- 섹션 리듬 통일: h3 semibold 섹션 제목, mt-6 pt-5 → 8px 구분띠
- TipCard 배경 강화 (bg-tertiary/50) + 좌측 primary 바 유지
- Stepper 세로선 my-1.5 여백으로 원과 떨어뜨림
- 과거 항목 표시 톤다운 ("지금 해도 괜찮아요", D-day 칩 숨김)

## 진행 중인 것

- 없음 (구현 완료, /verify 대기)

## 다음 할 것

1. /codex:review --background → /codex:result (코드 리뷰)
2. /verify (스펙 대비 검증)
3. 커밋 분리 + PR 생성 (feat/checklist-detail → main)
4. 5단계 스펙 작성: 스마트 재배치 (docs/specs/05-smart-replace.md)

## 알려진 문제

- 과거 항목 날짜 표시는 4단계 임시 처리 (DetailHeader getDDayTag/getDateText에 TODO 주석). 5단계 스마트 재배치에서 모드별 표시로 덮어쓰기

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 -- auth.uid()가 NULL일 때 가드 스킵됨. 반드시 `IS DISTINCT FROM` 사용
- Tailwind v4 font-size 토큰: `--font-size-*`가 아니라 `--text-*` 네임스페이스 사용해야 `text-h1` 유틸리티가 생성됨
- 커밋 단위: 한번에 몰아서 커밋하지 않음. 작업 단위(파일 1~3개) 기준으로 분리 커밋 (플러그인 사용이 원인)
- ActionSection 뱃지 레이아웃: 제목 위에 뱃지 배치 시 세로 정렬이 어색함 -> 같은 줄 인라인 배치가 깔끔
- 상세페이지 섹션 제목에 text-caption(12px) uppercase 사용 금지 — 전체 페이지가 왜소해 보임. text-h3(18px) semibold가 스펙
- TipCard에 보더 + 배경 모두 약하게 쓰지 말 것 — "애매한 중간"이 됨. 둘 중 하나를 확실히(지금은 좌측 bar + bg-tertiary/50)
