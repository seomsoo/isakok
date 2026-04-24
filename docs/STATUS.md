# 프로젝트 상태

> 마지막 업데이트: 2026-04-24 (2차 Codex 리뷰 수정 후)

## 현재 단계

6단계: 집 상태 기록 + 리포트 — 구현 완료, 1차+2차 Codex 리뷰 수정 완료, 검증 통과, PR 생성 전

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

#### 대시보드

- **DdayCard**: D-Day 숫자 + 원형 진행률 (가로 프로그레스 바 제거 -- 원형으로 충분)
- **GreetingHeader**: D-Day 기반 동적 인사 문구
- **ActionSection**: 오늘 할 일 + 밀린 할 일 통합, guide_type 우선순위 정렬 (critical > warning > tip), 인라인 뱃지, 체크박스 좌측 + 화살표 우측, 최대 3개 표시
- **UpcomingSection**: 내일/이번 주/다음 주 그룹핑, 점(dot) + 호버 효과, 최대 6개 미리보기
- **MotivationCard**: 진행률 기반 동적 응원 메시지
- **PhotoPromptCard**: D-Day 전후 문구 분기, 집기록 유도 CTA
- **PageHeader, DevTabBar, CircularProgress, Badge, Skeleton**: 공통 컴포넌트

#### 대시보드 훅/서비스

- useCurrentMove, useTodayItems (overdue + today + upcoming 분리), useToggleItem (낙관적 업데이트)
- useTimelineItemsForProgress (진행률 계산용)
- services/checklist.ts: getTodayItems, getOverdueItems, batchCompleteItems
- services/move.ts: getCurrentMove
- queryKeys.ts: 쿼리 키 상수

#### 타임라인

- TimelinePage, PeriodSection, CompletedSection, TimelinePromptCard
- useTimelineItems 훅
- 정렬 (시간순/카테고리별), 검색, Truck -> Home 프로그레스 바

#### 설정

- SettingsPage, MoveInfoSection, MoveEditSheet, SettingsMenuList
- useUpdateMove 훅
- services/settings.ts: updateMoveWithReschedule

#### 데이터 변경 (Supabase 원격 반영 완료)

- **guide_type 재분류**: 13개 항목 수정 (10 tip->warning, 4 warning->critical)
- **카테고리명 단축**: 업체/이사방법->업체, 정리/폐기->정리, 행정/서류->행정, 공과금/정산->정산, 통신/구독->통신, 짐싸기/포장->포장, 집상태기록->기록, 이사당일->당일, 입주후->입주
- **제목 단축**: 30개 항목 모바일 표시 최적화
- seed.sql, master-checklist-data.md 동기화 완료

### 4단계: 항목 상세 + 체크 토글 + 메모

#### DB 스키마 확장

- supabase/migrations/00005_guide_structure.sql: master_checklist_items에 guide_steps, guide_items, guide_note, guide_url 컬럼 추가
- supabase/migrations/00006_seed_guide_structure.sql: 46개 항목에 구조화된 가이드 데이터 시드

#### 페이지/라우트

- ChecklistDetailPage (/checklist/:itemId) — 상세페이지 진입점
- App.tsx: ToastProvider 마운트 + 라우트 등록, 대시보드/타임라인에서 항목 클릭 시 상세로 이동

#### 상세페이지 컴포넌트

- **DetailHeader**: D-day 트럭 칩 + 카테고리/중요도 배지, 큰 제목, 상대일자. 과거 항목은 "지금 해도 괜찮아요" 임시 처리 (5단계에서 모드별 교체됨)
- **GuideStepsSection**: Toss Stepper 스타일 (원형 번호 + 세로 연결선), "이렇게 하세요" 섹션
- **GuideItemsSection**: "미리 준비할 것" 체크리스트 (로컬 상태, 짐 챙기기 UX)
- **GuideNoteSection**: Steps 없을 때 Tip 단독 섹션 (TipCard 래퍼)
- **RelatedLinkCard**: "바로가기" 외부 링크 카드 (Globe 아이콘 + 이름/설명)
- **MemoSection**: 자동 높이 조정 textarea + 디바운스 저장(1s) + in-flight 직렬화(최신 값 승자), 저장 중 스피너 + 저장됨 피드백
- **TipCard**: 민트 배경 + primary 좌측 바 + Lightbulb/Tip 라벨 (재사용 공통)
- **SectionTitle**: 섹션 제목 공통화 (h3 semibold, 우측 슬롯 지원)
- **CompletionStamp**: 완료 시 우측 원형 도장 오버레이 (-14deg 회전, success 톤)
- **CompletionToggleButton**: 하단 sticky CTA (완료로 표시 / 다시 할 일로 되돌리기)

#### 공통 컴포넌트

- **SectionDivider**: 섹션 간 8px bg-border/50 띠 (TimelinePage와 동일 패턴)
- **Toast / ToastProvider**: 메모 저장 실패 등 알림용 전역 토스트

#### 훅/서비스

- useChecklistItemDetail: 상세 조회 훅
- useUpdateMemo: 메모 업데이트 (디바운스 1s, 토스트 에러 처리)
- useToggleItem: 대시보드 훅 재사용, invalidation 범위 확장 (itemDetail 키 추가)
- useUpdateMove: console.error → toast.error 전환 (성공 토스트 포함)
- services/checklist.ts: getChecklistItemDetail, updateItemMemo 추가

#### 공유 유틸 (4단계)

- packages/shared/utils/dateLabel.ts: getRelativeDateLabel(d-day offset → 한국어 레이블), formatDateKorean, **parseLocalDate**(YYYY-MM-DD 로컬 파싱)
- packages/shared/constants/linkMeta.ts: URL → 사이트 이름/설명 메타 매핑

#### Codex 리뷰 수정 (4단계)

- **[P1] MemoSection 자동저장 경쟁상태** → `inFlightRef` + `pendingRef`로 in-flight 직렬화(최신 값만 서버 반영)
- **[P2] DetailHeader/formatDateKorean UTC 파싱 버그** → `parseLocalDate` 도입, YYYY-MM-DD를 로컬 생성자로 파싱

#### 문서/Git (4단계)

- docs/specs/04-detail.md(스펙), 04-detail-verify.md(검증 리포트, 종합 판정 ✅)
- docs/wireframe/detail.png
- CLAUDE.md PR 템플릿 확장: Spec → What → Why → Verify → DB/Migration(조건부) → Follow-ups → Screenshot(조건부) 고정 순서
- PR #5 머지 완료

### 5단계: 스마트 재배치 (이번 세션)

#### 공유 패키지

- packages/shared/src/utils/urgencyMode.ts: `getUrgencyMode(daysUntilMove)` 4모드 판별 (relaxed ≥30 / tight 14~29 / urgent 7~13 / critical ≤6), `rescheduleOverdueItems` 빠듯 모드 7일 균등 분배 (중요도순)
- packages/shared/src/utils/urgencyMode.test.ts: 8 테스트 (모드 경계 + 재배치 정렬·순환)
- packages/shared/src/utils/progress.ts: `calculateEssentialProgress` 추가 (필수 항목만 카운트)
- packages/shared/src/constants/urgencyText.ts: 모드별 카피 (인사·액션 제목·진행률 라벨·그룹 라벨·전환 메시지·격려 문구)
- packages/shared/src/index.ts: 신규 export 정리
- packages/shared/tsconfig.json: declaration/baseUrl/paths 정리

#### 웹앱

- apps/web/src/features/dashboard/hooks/useUrgencyMode.ts: 모드 + 전환 감지 + 메시지 생성
- apps/web/src/stores/modeStore.ts: previousMode + transitionDismissed (모드 변경 시 dismissed 자동 리셋)
- apps/web/src/features/dashboard/components/ModeTransitionBanner.tsx: role/aria-live 배너, X 닫기
- apps/web/src/features/timeline/components/SkippableSection.tsx: "여유 되면" 그룹 (기본 접힘, critical 격려)
- 카드 컴포넌트 모드 분기: GreetingHeader, DdayCard(CircularProgress aria-label 모드별), MotivationCard, ActionSection, UpcomingSection, PhotoPromptCard
- 데이터 훅 모드 연동: useTodayItems(`useDashboardItemsWithMode`로 essential 필터), useTimelineItems(skippableItems 분리 + 5/2그룹 재구성), PeriodSection 그룹 라벨
- 페이지 와이어: DashboardPage(모드별 progress·배너), TimelinePage(skippable 합성 empty-state)
- 체크리스트 상세: DetailHeader/ChecklistDetailPage 과거 항목 톤다운

#### Codex 리뷰 수정 (모두 반영)

- [P1] DashboardPage essential progress가 nested `master_checklist_items.is_skippable`를 못 봐 과대 계산 → 매핑 추가
- [P1] TimelinePage empty-state가 `skippableItems`를 무시해 critical 모드에서 SkippableSection 가려짐 → `hasSkippable` 합치기
- [P2] `setPreviousMode`가 `transitionDismissed`를 리셋 안 해 한 번 닫으면 영구 숨김 → 모드 변경 시 false로 리셋

#### 문서/프로세스

- docs/specs/05-smart-reschedule.md, 05-smart-reschedule-verify.md (✅ 통과)
- .claude/commands/verify.md: Codex 리뷰 항목은 "문제 + 수정" 양쪽 모두 기록 규칙 추가
- ~/.claude/projects/.../memory/feedback_verify_report.md: 같은 규칙을 메모리로 영속화

#### Git

- feat/smart-reschedule 브랜치, 12개 작업 단위 커밋 (1~3 파일/커밋 컨벤션)
- PR #6: <https://github.com/seomsoo/isakok/pull/6> (Spec/What/Why/Verify/Follow-ups 템플릿)

### 6단계: 집 상태 기록 + 리포트

#### 페이지/라우트

- PhotosPage (`/photos`) — 입주/퇴실 토글 + 방별 카드 리스트
- PhotoRoomPage (`/photos/:room`) — 방별 사진 추가/조회/메모/삭제
- PhotoReportPage (`/photos/report`) — 방별 사진 요약 리포트 (읽기 전용, 공유 CTA)
- PhotoTrashPage (`/photos/trash`) — 최근 삭제 (복구/영구삭제)

#### 리포트 컴포넌트

- ReportHeader: 타입 배지(입주/퇴실) + 날짜 제목 + 통계 (사진·메모·공간)
- ReportRoomSection: 방 라벨 + N장 카운트, 3열 그리드 (에디토리얼 번호 배지), "메모" 라벨 + 번호.텍스트 (line-clamp-2)
- TipCard: ShieldCheck 아이콘 + SHA-256 증거 안내
- 공유: Web Share API + clipboard 폴백, DevTabBar 미표시 (몰입형)

#### 사진 관련 컴포넌트

- PhotoTopTabs (입주/퇴실 토글, tablist + aria-selected)
- PhotoInfoBanner (dismiss 가능, localStorage 기반)
- RoomSection (썸네일 가로 스크롤 + 추가 버튼)
- PhotoGrid, PhotoCard, PhotoEmptyState, RoomTipCard
- PhotoUploadFab (카메라 + 갤러리), PhotoUploadButton
- PhotoFullscreenViewer (핀치줌 1~4x, 더블탭, portal)
- DeletePhotoDialog (바텀시트, overflow 경고)
- DeletedPhotosSection (최근 삭제 리스트)

#### 훅

- usePhotos, useUploadPhoto, useDeletePhoto, useRestorePhoto
- useDeletedPhotos, useSignedUrls, useUpdatePhotoMemo
- queryKeys.ts (photoKeys 상수)

#### 서비스 (services/photos.ts)

- uploadPhoto (Storage + DB 2단계, EXIF 추출, SHA-256 해시, 리사이즈)
- getPhotosByMove, getDeletedPhotos, createSignedUrls
- softDeletePhoto, hardDeletePhoto (Storage 에러 체크 포함)
- updatePhotoMemo, restorePhoto

#### 유틸

- exif.ts: EXIF DateTimeOriginal → taken_at
- photoHash.ts: SHA-256 해시 (Web Crypto API)
- resizeImage.ts: 클라이언트 리사이즈 (긴 변 1920px, WebP 80%)

#### Codex 리뷰 수정 (1차)

- [P1] PhotoReportPage 로딩 가드 — isPhotosLoading 가드 + Skeleton UI
- [P1] PhotosPage maxCount 적용 — remaining 계산 + slice 적용
- [P2] hardDeletePhoto Storage 에러 체크 — storageError 체크 + throw
- [P2] PhotoRoomPage 동시 업로드 가드 — uploadingCount > 0 조기 리턴

#### Codex 리뷰 수정 (2차 — 리포트 리파인 후)

- [P1] PhotoGrid 메모 autosave stale overwrite — `photo.memo` prop 비교 → `lastSavedRef`(useRef)로 마지막 전송 값 추적, stale 비교 제거
- [P2] PhotoTrashPage 필터 리셋 누락 — 선택된 방 사진이 0건이 되면 `counts` 기반 `FILTER_ALL`로 자동 리셋

#### UI 리파인 (디자인 리뷰 후)

- ReportRoomSection: progress bar → "N장", 해시 배지 제거, 타임스탬프 → 에디토리얼 번호, 메모 미니멀화
- PhotoReportPage: TipCard Lightbulb → ShieldCheck, DevTabBar 제거, 공유 패딩 조정
- PhotoTopTabs 접근성: radiogroup → tablist, aria-checked → aria-selected
- default export 제거 (4개 Photo 페이지)

#### 문서

- docs/specs/06-property-photo.md (스펙), 06-property-photo-verify.md (검증 리포트 ✅ 통과)

## 진행 중인 것

없음

## 다음 할 것

1. PR 생성 (feat/property-photos → main, 6단계 전체 포함)

## 알려진 문제

- guide_content 직접 표시는 7단계 AI 맞춤 가이드 도입 시 custom_guide 우선으로 교체 예정
- urgent/critical 모드 격려 문구는 7단계에서 사용자 상황별 맞춤 교체 검토 (Follow-up)
- previousMode는 현재 세션 단위. 8단계 인증 후 서버 영속 검토 (Follow-up)

## 실패한 접근 (반복 금지)

- RPC 권한 체크에 `!=` 사용 금지 — `IS DISTINCT FROM` 사용
- Tailwind v4 font-size 토큰: `--text-*` 네임스페이스 사용
- 커밋: 작업 단위(파일 1~3개) 분리 — 한 번에 몰아서 커밋 금지
- ActionSection 뱃지: 제목 위 배치 어색 → 같은 줄 인라인
- 상세페이지 섹션 제목에 text-caption uppercase 금지 → text-h3 semibold
- TipCard에 보더+배경 둘 다 약하게 쓰지 말 것 → 좌측 bar + bg-tertiary/50
- YYYY-MM-DD를 `new Date()`에 직접 넣지 말 것 → `parseLocalDate` 사용
- 디바운스 자동저장에서 mutate 즉시 호출 금지 → in-flight ref + pending ref 직렬화
- 디바운스 자동저장의 변경 판별에 서버 prop(예: `photo.memo`)을 쓰지 말 것 — 비동기 fetch 전 stale prop이라 빠른 편집 시 저장 누락. 대신 `lastSavedRef`로 마지막 전송 값 추적
- 필터 UI에서 선택된 항목의 데이터가 0건이 되면 자동으로 전체 필터로 리셋할 것 — 칩이 숨겨져 사용자가 빈 목록에 갇힘
- `noUncheckedIndexedAccess` 켜진 packages/shared에서 `arr[n].field` 직접 접근 금지 → optional chaining
- verify 리포트의 Codex 리뷰 항목을 갱신할 때 원래 "문제" 설명을 지우지 말 것 → "문제 + 수정" 두 줄 구조 유지
- `is_skippable` 같은 nested 필드는 `master_checklist_items.is_skippable` 경로로 추출해 progress util에 넘길 것 — 최상위로 가정 시 모두 undefined 처리되어 과대 계산
- 모드 전환 배너의 dismissed 플래그는 모드 변경 시 반드시 리셋 (`setPreviousMode`에서 같이 처리)
