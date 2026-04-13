# 프로젝트 상태

> 마지막 업데이트: 2026-04-13

## 현재 단계

5단계: 스마트 재배치 (4모드) — 구현 완료, 검증 통과, PR #6 리뷰 대기

## 완료된 것

### 1단계: Supabase 세팅

- supabase/migrations/00001~00004: 테이블, RPC, RLS, Storage
- supabase/seed.sql: 마스터 체크리스트 46개
- apps/web/src/lib/supabase.ts: 클라이언트 초기화
- packages/shared/src/types/database.ts: Supabase 타입

### 2단계: 온보딩

- 3스텝 폼 + Pre-check 페이지, useCreateMove + onboardingStore, 디자인 시스템 OKLCH 전환

### 3단계: 대시보드 + 타임라인 + 설정

- 대시보드: DdayCard, GreetingHeader, ActionSection, UpcomingSection, MotivationCard, PhotoPromptCard
- 타임라인: PeriodSection, CompletedSection, useTimelineItems
- 설정: SettingsPage, MoveEditSheet, useUpdateMove, updateMoveWithReschedule RPC
- 데이터: guide_type 재분류, 카테고리·제목 단축

### 4단계: 항목 상세 + 체크 토글 + 메모

- ChecklistDetailPage + DetailHeader, GuideStepsSection, GuideItemsSection, GuideNoteSection, RelatedLinkCard, MemoSection (디바운스 + in-flight 직렬화), CompletionStamp, CompletionToggleButton
- ToastProvider, SectionDivider, SectionTitle, TipCard 공통화
- useChecklistItemDetail, useUpdateMemo, getChecklistItemDetail, updateItemMemo
- packages/shared/utils/dateLabel.ts (parseLocalDate 포함)
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

## 진행 중인 것

- 없음 (PR #6 리뷰/머지 대기)

## 다음 할 것

1. PR #6 리뷰 & squash merge (feat/smart-reschedule → main)
2. 머지 후 로컬 main pull + `/commit-commands:clean_gone`
3. 6단계 스펙 작성: docs/specs/06-property-photo.md (집 상태 기록 — 방별 사진, EXIF, SHA-256, Storage 업로드)

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
- `noUncheckedIndexedAccess` 켜진 packages/shared에서 `arr[n].field` 직접 접근 금지 → optional chaining
- verify 리포트의 Codex 리뷰 항목을 갱신할 때 원래 "문제" 설명을 지우지 말 것 → "문제 + 수정" 두 줄 구조 유지
- `is_skippable` 같은 nested 필드는 `master_checklist_items.is_skippable` 경로로 추출해 progress util에 넘길 것 — 최상위로 가정 시 모두 undefined 처리되어 과대 계산
- 모드 전환 배너의 dismissed 플래그는 모드 변경 시 반드시 리셋 (`setPreviousMode`에서 같이 처리)
