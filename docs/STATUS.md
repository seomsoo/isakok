# 프로젝트 상태

> 마지막 업데이트: 2026-05-21 (10-1 PR #45 CI 통과, gitleaks 해결)

## 현재 단계

10-1단계: 네이티브 인증 + 세션 브릿지 — PR #45 CI 통과, 머지 대기

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
- DESIGN.md, component-design-spec.md 추가
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

### 7단계: AI 맞춤 가이드

#### DB 마이그레이션 (00007~00012)

- 00007: ai_guide_cache ALTER (generating_at 컬럼) + claim_ai_guide_generation/apply_ai_guides RPC
- 00008: system_config 테이블 (master_checklist_version=1)
- 00009: guide_content 보강 3건 (#11, #41, #42) + master_version bump
- 00010: sort_order 오프셋 보정
- 00011: claim RPC INSERT 후 즉시 true 반환
- 00012: stale lock 30초 → 150초 확장 (LLM 120초 + 30초 버퍼)

#### Edge Function (supabase/functions/)

- generate-ai-guide/index.ts: moveId만 수신 → moves 직접 조회(ADR-018) → 캐시 확인 → claim lock(ADR-019) → Claude API → apply_ai_guides batch
- \_shared/: anthropic.ts, cacheKey.ts, supabaseAdmin.ts, conditionsValidator.ts, logger.ts, cors.ts
- \_shared/prompts/checklist-guide.ts: 프롬프트 v1.0.1 + parseResponse + normalizeGuides (6개 가드)

#### 클라이언트

- ai-guide feature: useGenerateAiGuide (useMutation), aiGuide service (invoke), queryKeys
- aiGuideStore (Zustand): trigger key = `${moveId}_${housing}_${contract}_${move}` — 조건 변경 시 자동 재트리거
- DashboardPage: useEffect에서 1회 백그라운드 트리거
- PersonalizedTipCard: Sparkles 아이콘 + 조건 태그 0~3개 + "맞춤 팁" 라벨
- GuideNoteSection: useRef snapshot (ADR-020, 세션 내 스왑 방지)
- GuideStepsSection: tip prop 제거 (순수 단계 목록)

#### Shared 패키지

- types/aiGuide.ts, constants/aiGuide.ts, utils/cacheKey.ts, utils/conditionTags.ts
- index.ts: 신규 export 추가

#### Codex 리뷰 수정

- [P1] trigger key 일반화: move.id → `${moveId}_${conditions}` (조건 변경 시 재트리거)
- [P1] 에러 시 master_version: 0 리셋 (stale 캐시 영구 제공 방지)
- [P2] lock timeout 30초 → 150초 (00012 마이그레이션)

#### spec-reviewer 수정

- 마이그레이션 번호 00005~00008 → 00007~00012 스펙 정정
- hasSteps prop 미사용 제거
- 스펙 문서에 lock 150초, master_version:0 리셋, cacheKey prompt_version 불일치 반영

#### 문서

- docs/specs/07-ai-guide.md (스펙 v2), 07-ai-guide-verify.md (검증 리포트 ✅ 통과)
- docs/DECISIONS.md: design-decisions-v2.md에서 통합 리네임

#### Git

- feat/ai-guide 브랜치, 15개 작업 단위 커밋 (1~3 파일/커밋 컨벤션)
- PR #8: https://github.com/seomsoo/isakok/pull/8

### 8단계-1: 하네스 코어

#### 정책/에이전트/가드

- `.claude/policies/auto-fix-scope.md`: 교정 루프 적용 범위 정책 (§0~§6 전체)
- `.claude/commands/auto-fix.md`: /auto-fix 명령어 (§0 사전 가드 + 3회 루프 + 출력 형식)
- `.claude/agents/auto-fixer.md`: auto-fixer sub-agent (절대 원칙 6개, 거부 사례, 한계 표명)
- `.claude/agents/spec-reviewer.md`: 컴포넌트 설계 검토 섹션 추가
- `scripts/auto-fix/check-scope.ts`: 경로/패턴 매칭 가드 (중첩 경로, untracked, .skip/.todo/.only 패턴)
- `docs/auto-fix-log/.gitkeep`: 교정 로그 디렉토리

#### 커밋훅 (Husky v9)

- `.husky/pre-commit`: lint-staged 실행
- `.husky/commit-msg`: commitlint 검증
- `.husky/pre-push`: pnpm verify (빌드/린트/타입체크/테스트 전체)
- `.lintstagedrc.cjs`: prettier --write (monorepo에서 eslint --fix 문제로 prettier-only)
- `commitlint.config.cjs`: conventional commits 룰 3개

#### CI

- `.github/workflows/ci.yml`: PR 트리거, lint/typecheck/test/build 4단계 순차 (Node 22, pnpm auto-detect)
- 브랜치 보호 룰: GitHub UI 수동 설정 완료

#### 프로젝트 설정

- `package.json`: `packageManager: pnpm@10.27.0`, verify/verify:fast/auto-fix:check-scope 스크립트
- `turbo.json`: typecheck 태스크 추가
- `apps/web/package.json`: typecheck 스크립트 추가, build에서 tsc -b → tsc --noEmit -p tsconfig.app.json
- `packages/shared/package.json`: test → vitest run, test:watch → vitest

#### Codex 리뷰 수정

- [P2] `check-scope.ts` 중첩 경로 매칭 보강 (`(^|\/)` 접두사) — `f01e46d`
- [P2] `check-scope.ts` untracked 파일 스캔 추가 (`git ls-files --others`) — `f01e46d`
- [P2] `check-scope.ts` 테스트 비활성화 패턴 확장 (`.skip/.todo/.only`) — `f01e46d`

#### 시나리오 테스트 (5건 전체 통과)

- /auto-fix 루프: 의도적 lint 에러 → 자동 수정 통과
- 거부 범위 차단: apps/web/package.json 수정 → check-scope 감지, exit 1
- 휴리스틱 차단: `as any` 추가 → check-scope 감지, exit 1
- dirty tree 중단: dirty working tree → /auto-fix 즉시 중단
- main 브랜치 중단: main에서 /auto-fix → 즉시 중단

#### 문서

- docs/specs/08-1-harness-core.md (스펙), 08-1-verify.md (검증 리포트 ✅ 완전 통과)

#### Git

- feat/quality-harness 브랜치
- 커밋: f01e46d (check-scope 가드 패턴 강화), d3008bd (auto-fixer agent + spec-reviewer), fe9b2fa (lint-staged prettier-only), 241b20e (tsconfig.app.json), 9a8f35a (husky commit hooks)

### 8단계-2: 하네스 CI 봇

#### 에이전트 6종

- `.claude/agents/security-auditor.md`: 민감정보 흐름, RLS 정책, 인증 코드 의미 분석 (패턴 매칭은 Gitleaks/ESLint가 담당)
- `.claude/agents/pr-summarizer.md`: PR 변경사항 자동 요약 (사실만 기술, 평가 금지)
- `.claude/agents/ux-state-reviewer.md`: loading/empty/error/success 4상태 검토
- `.claude/agents/web-a11y-reviewer.md`: WCAG 2.1/2.2 기준 의미 분석 (24×24/44×44 터치 타겟)
- `.claude/agents/native-a11y-reviewer.md`: RN accessibility props (9단계 Expo 셸에서 활성)
- `.claude/agents/perf-budget-reviewer.md`: 번들 사이즈, 렌더링, 이미지 최적화 검토
- 모든 에이전트에 prompt injection 방어 문구 포함

#### CI 워크플로우

- `.github/workflows/ci.yml`: PR 번호 artifact 저장 step 추가 (verify 앞, head_sha/head_ref 포함)
- `.github/workflows/pr-summarize.yml`: PR opened 시 trusted tools(main) + workspace(PR) 분리 패턴, 파일 읽기 댓글 게시 (기존 댓글 업데이트), actor/fork 가드
- `.github/workflows/auto-fix-bot.yml`: workflow_run 트리거, pull_request CI 실패에만 동작, 7단계 가드 (CI 실패/PR 한정/actor/fork/mode/시도 횟수/일일 예산), trusted tools 패턴, dry-run 댓글 게시, apply 모드 정의 (활성화는 별도 운영 결정)
- `.github/workflows/gitleaks.yml`: 시크릿 스캔 (push/PR/주간 스케줄)
- `.github/dependabot.yml`: 주간 의존성 업데이트 (npm, github-actions 그룹)

#### 보조 스크립트

- `scripts/auto-fix/fetch-logs.mjs`: CI 실패 로그 다운로드 (maxBuffer 50MB / 출력 5MB 분리)
- `scripts/auto-fix/check-attempts.mjs`: 같은 PR 시도 횟수 체크 (`execFileSync` argument array — shell injection 방지)
- `scripts/auto-fix/run.mjs`: Claude API 호출 + patch 생성, `HARNESS_LLM_MODEL` 환경변수, `--workspace` 인자, dry-run 시 git apply 차단, prompt injection 방어 문구 자동 추가
- `scripts/auto-fix/budget-guard.mjs`: 일일 토큰 사용량 best-effort 관측 (`--check` / `--record`)

#### 8-1 정책 보강 (8-2 PR에 통합)

- `.claude/policies/auto-fix-scope.md` §2-1에 `scripts/auto-fix/**` 거부 범위 추가
- `scripts/auto-fix/check-scope.ts`의 `DENIED_PATH_PATTERNS`에 `/^scripts\/auto-fix\//` 추가

#### 부가 도구

- `eslint-plugin-jsx-a11y`: root package.json 설치 + eslint.config.js recommended 룰 적용
- `.gitleaks.toml`: allowlist에 docs 전체 제외 없음, regex 더미값만 허용

#### 운영 문서

- `docs/harness-ops.md`: 모드 전환 절차(off→dry-run→apply), 비용 모니터링(best-effort), 장애 대응 5개 시나리오
- `docs/architecture/harness-engineering.md`: 면접 카드용 시스템 설명

#### Codex 리뷰 수정 (모두 반영)

- [P1] `check-attempts.mjs` shell injection — `execSync` → `execFileSync` + argument array 전환
- [P2] `auto-fix-bot.yml` cache-dependency-path — `cache-dependency-path: tools/pnpm-lock.yaml` 추가
- [P2] `auto-fix-bot.yml` head_branch → head_sha checkout — artifact 다운로드를 workspace checkout 앞으로 이동, `pr-info/head_sha`로 checkout

#### 문서

- docs/specs/08-2-harness-ci-bot.md (스펙 v2-fix), 08-2-verify.md (검증 리포트 ✅ 통과)

#### Git

- feat/harness-ci-bot 브랜치 → PR #11 머지 완료

### 8단계-3: 하네스 실동작 검증 + 프롬프트 튜닝

#### GitHub Secrets/Variables 등록

- `ANTHROPIC_API_KEY_HARNESS` (Secret): 하네스 전용 Anthropic API 키 (로컬 키와 분리)
- `AUTO_FIX_BOT_TOKEN` (Secret): Fine-grained PAT (Contents RW, PRs RW, Actions R)
- `AUTO_FIX_MODE` (Variable): `dry-run` (off → dry-run 전환 완료)
- `AUTO_FIX_DAILY_TOKEN_LIMIT` (Variable): `100000` (기본값)
- `HARNESS_LLM_MODEL` (Variable): `claude-sonnet-4-6` (기본값)

#### 워크플로우 버그 수정 (테스트 PR #22, #24로 발견)

- auto-fix-bot.yml: `package_json_file: tools/package.json` 추가 (pnpm 버전 인식 실패 수정) — PR #23
- auto-fix-bot.yml: check-attempts step에 `working-directory: workspace` 추가 (git repo 컨텍스트) — PR #25
- auto-fix-bot.yml: fetch-logs step에 `working-directory: workspace` 추가 (gh run view도 git 필요) — PR #26
- pr-summarize.yml: summarizer step에 `GH_TOKEN` 환경변수 추가 (PR 본문 조회 실패 수정) — PR #23
- run.mjs: diff 내용을 프롬프트에 직접 포함 (30KB 제한 + 트렁케이트) — PR #23

#### 에이전트 프롬프트 튜닝 (PR #27, #28, #29)

- pr-summarizer.md: 테이블 기반 간결 포맷 + AI Summary 제목 + 사이즈 라벨(XS~XL) + Start here(핵심 파일) + Heads up(해당 시만)
- auto-fixer.md: Problem/Fix/Scope check 3섹션 구조 + AI Auto-fix Report 제목
- run.mjs: "최종 마크다운만 출력, 중간 사고 금지, 추가 파일 읽지 마라" 지시 강화
- auto-fix-bot.yml: dry-run 댓글 래퍼 간결화

#### Dependabot 정리

- Actions PR 5개 머지: checkout v6, setup-node v6, download-artifact v21, github-script v9, action-setup v6 (#12~#16)
- npm 메이저 업데이트 PR 5개 닫기: ESLint 10, TypeScript 6, Vite 8, Vitest 4, minor-and-patch (#17~#21)
- GitHub Settings에서 auto-merge 기능 활성화

#### 실동작 검증 결과 (테스트 PR #24)

- CI: lint 실패 정상 감지 ✅
- pr-summarize: diff 기반 정확한 요약 댓글 ✅ (중간 사고 출력 제거 확인)
- auto-fix-bot (dry-run): lint 에러 분석 + 수정 제안 댓글 ✅
- gitleaks: 시크릿 스캔 통과 ✅

#### Git

- 워크플로우 수정: PR #23, #25, #26 (각 1 파일씩 분할 머지)
- 프롬프트 튜닝: PR #27, #28, #29 (에이전트 정의 + run.mjs + 워크플로우)

### 9↔10 단계 스왑 문서 반영

#### 변경 사유

- 아키텍처 설계 기준으로 Expo 셸(WebView 래핑)을 먼저, 인증을 나중에 하는 게 적합
- 인증 없이도 WebView 래핑은 독립적으로 가능
- 인증 도입 시 WebView 세션 동기화 등 복잡도가 높아 네이티브 셸이 먼저 안정화돼야 함

#### 변경 내역 (23개 파일)

- 구 9단계 (인증+RLS) → 신 10단계
- 구 10단계 (Expo 셸) → 신 9단계
- 구 8단계 인증/RLS 참조도 10단계로 정리 (하네스 삽입 전 구 번호 잔재)
- native-a11y-reviewer "비활성" → "활성" 전환
- 대상: CLAUDE.md, AGENTS.md, 에이전트 정의 2개, 정책 1개, CLAUDE.md 하위 3개, STATUS.md, project-overview.md, DECISIONS.md, harness-engineering.md, 스펙 13개

#### 스펙

- docs/specs/09-expo-shell.md: 이미 새 번호(9단계=Expo)로 작성 완료

#### Git

- docs/swap-stage-9-10 브랜치, 9개 커밋 (1~3 파일/커밋 컨벤션)
- PR #31: https://github.com/seomsoo/isakok/pull/31 (머지 완료)

### 9단계: Expo 셸 + WebView 래핑

#### 네이티브 셸 구조

- apps/mobile/src/app/\_layout.tsx: RootLayout (SafeAreaProvider + StatusBar + SplashScreen 타임아웃)
- apps/mobile/src/app/(tabs)/\_layout.tsx: TabLayout (홈/전체/집기록 3탭, Ionicons, COLORS 기반 스타일)
- apps/mobile/src/app/(tabs)/index.tsx: HomeTab → WebViewScreen path="/"
- apps/mobile/src/app/(tabs)/timeline.tsx: TimelineTab → WebViewScreen path="/timeline"
- apps/mobile/src/app/(tabs)/photos.tsx: PhotosTab → WebViewScreen path="/photos"

#### 핵심 컴포넌트

- WebViewScreen.tsx: WebView 래핑 + 로딩/에러/오프라인 폴백
  - WEB_READY 메시지 수신 시 로딩 해제 + splash 숨김 (Codex 수정 — 원래 빠져있었음)
  - onLoadProgress >= 0.95 보강 (Android onLoadEnd 불안정 대응)
  - WEBVIEW_LOAD_TIMEOUT_MS (15초) 타임아웃 → 에러 상태 전환
  - useSafeAreaInsets로 상태바 영역 확보 (paddingTop)
- LoadingFallback.tsx: 로딩 중 스피너 UI
- ErrorFallback.tsx: 에러 시 "다시 시도" 버튼
- OfflineFallback.tsx: 오프라인 시 안내 UI

#### 훅/유틸

- useNetworkStatus.ts: NetInfo 기반 온라인/오프라인 감지
- useWebViewRef.ts: WebView ref + reload/goBack 메서드
- splash.ts: hideSplashOnce (SplashScreen.hideAsync 1회 보장)
- urlAllowlist.ts: WebView URL 화이트리스트 (**DEV**에서 localhost, 192.168._, 10._ 허용)

#### 설정

- config.ts: Platform.OS 분기 (Android → 10.0.2.2, iOS → localhost), COLORS 상수
- app.json: usesCleartextTraffic: true (Android WebView HTTP 허용), expo-font 플러그인
- eas.json: development/preview/production 빌드 프로필
- package.json: android:reverse, android, ios 스크립트 추가

#### 웹앱 브릿지 연동

- apps/web/src/App.tsx: WebReadySignal 컴포넌트 (isNativeWebView → sendToNative WEB_READY)
- packages/shared/src/utils/nativeBridge.ts: isNativeWebView(), sendToNative() 유틸
- packages/shared/src/types/bridge.ts: 브릿지 메시지 타입 정의

#### 기존 ADR 추가 (docs/DECISIONS.md)

- ADR-034: Expo 셸 먼저, 인증은 다음 단계로
- ADR-035: 탭별 WebView 3개 구조 (vs 단일 WebView)
- ADR-036: WebView 원격 URL 로드 (vs 로컬 번들)
- ADR-037: 로그인 분기 랜딩 페이지 제거 + 트렌드 반영
- ADR-038: 네이티브→웹 브릿지에 dispatchEvent 방식 채택

#### Android 에뮬레이터 검증 (완료)

- EAS development 빌드 → API 35 에뮬레이터 설치
- 대시보드 진입 ✅, 탭 전환 (전체/집기록) ✅, 상태바 safe area ✅
- WebView HTTP 로딩 ✅ (usesCleartextTraffic + 10.0.2.2 + Vite --host 0.0.0.0)

#### iOS 검증 (미완료)

- iOS 26.3 시뮬레이터 런타임 다운로드 + 로컬 빌드 시도 → SimRuntime 검사 단계에서 부팅 실패 (검은 화면)
- Apple Developer 계정 등록 대기 중 (실기기 테스트용)

### 10-1 사전 작업 (2026-05-20 완료)

- [x] Apple Developer: App ID + Sign in with Apple Capability + Services ID + Key
- [x] Google Cloud: OAuth Client iOS / Android / Web 3개 + Android SHA-1 등록
- [x] Kakao Developers: 네이티브 앱 키 + 플랫폼 키 등록 + 키해시
- [x] Supabase dev 콘솔: Manual Linking ON, Anonymous ON, Confirm Email OFF
- [x] Supabase dev Apple provider: Client IDs만 (Secret 비움, ADR-053)
- [x] Supabase dev Google provider: Client IDs 3개 + Skip nonce checks ON (ADR-052)
- [x] Vercel: production 환경변수 = dev Supabase 연결 (ADR-051)
- [x] Expo apps/mobile/.env: Google/Kakao 키 채움

### 10-1 Spike (2026-05-20 완료)

- linkIdentity({ provider, token }) 실측 검증 ✅ 통과
- 익명 user.id 유지 + is_anonymous false 전환 + Google identity 추가 확인
- 본 구현은 메인 경로 (linkIdentity) 확정, `as any` 캐스트 유지
- 결과: docs/specs/10-1-spike-result.md

### 10-1 본 구현 (2026-05-21 코드 작성 완료, 커밋 대기)

#### 신규 파일

- apps/mobile/src/app/auth.tsx — 네이티브 로그인 화면
- apps/mobile/src/auth/ — AuthService, bootstrap, broadcast, session, sessionState, supabaseNative, providers/ (Apple/Google/Kakao + types)
- apps/web/src/auth/ — useSession, webSessionListener, authError (401 인터셉터)
- supabase/migrations/00013_anonymous_users.sql, 00014_auth_provider_links.sql
- supabase/functions/kakao-token-exchange/ — Kakao 토큰 교환 Edge Function

#### 수정 파일

- apps/mobile/app.config.ts — app.json → app.config.ts 전환, process.env로 키 참조 (ADR-055)
- apps/mobile/eas.json — env 블록 제거, EAS Secrets 방식으로 전환 (ADR-055)
- apps/mobile/.env.example — Supabase/Google/Kakao 키 템플릿
- apps/mobile/src/app/\_layout.tsx — bootstrapAuth + auth 라우트
- apps/mobile/src/components/WebViewScreen.tsx — WEB_READY 시 세션 주입, localStorage 정리
- apps/web/src/App.tsx — WebReadySignal에 setupWebSessionListener 추가
- apps/web/src/lib/supabase.ts — 네이티브 환경 분기 (persistSession/autoRefreshToken)
- apps/web/src/lib/queryClient.ts — QueryCache/MutationCache 401 인터셉터
- apps/web/src/pages/OnboardingPage.tsx — 우상단 로그인 버튼
- apps/web/src/pages/PhotosPage.tsx, PhotoRoomPage.tsx — userId 인자 전달
- apps/web/src/features/dashboard/hooks/useCurrentMove.ts — userId 기반 조회
- apps/web/src/features/onboarding/hooks/useCreateMove.ts — userId fallback fetch
- apps/web/src/services/move.ts — TEMP_USER_ID 제거, userId 인자
- packages/shared/src/types/bridge.ts — AUTH_SESSION/REQUEST_SESSION_REFRESH 메시지 추가

#### 수동 셋업 완료 (2026-05-21)

- [x] Edge Function 배포: `supabase functions deploy kakao-token-exchange`
- [x] `npx expo prebuild --clean` (config plugins 반영)
- [x] iOS 시뮬레이터 빌드 (`npx expo run:ios`) + 런타임 테스트
- 상세 절차: docs/specs/10-1-manual-setup.md

#### iOS 시뮬레이터 테스트 결과 (2026-05-21)

- [x] anonymous 세션 → 온보딩 → 대시보드 정상
- [x] 카카오 로그인 (Edge Function 경유) 성공
- [x] 구글 로그인 (signInWithIdToken + conflict 메시지) 성공
- [x] conflict 시 화면 유지 + "홈으로 돌아가기"
- [x] 온보딩 우상단 로그인 버튼 → auth 화면 이동
- [x] 탭 전환 시 세션 유지
- [x] pnpm build / lint / test 통과
- 상세 결과: docs/specs/10-1-test-result.md

#### Codex 리뷰 + verify 수정 (2026-05-21)

- P1 3건 + P2 3건 수정 완료 (queryKey 불일치, RLS 활성화, 접근성 3건, userId guard, .gitignore, Kakao orphan rollback)
- user_id 필터 전면 추가: checklist.ts(7개), photos.ts(7개), settings.ts(RPC) — 서비스→훅(12개)→페이지(8개)→컴포넌트(5개) 관통 반영
- 마이그레이션 00015: RPC 소유권 검증 (`create_move_with_checklist` auth.uid() 체크 활성화, `update_move_with_reschedule` p_user_id 파라미터 추가)
- photos.ts JSDoc `@param` 태그 7개 함수 추가 (checklist.ts와 일치)
- PhotoTrashPage mutation userId null guard 추가 (PhotoRoomPage/PhotosPage 패턴 일치)
- move.ts stale JSDoc 갱신 ("RLS 꺼진 상태" → `@param userId`)
- 검증 리포트: docs/specs/10-1-verify.md (종합 ✅ 통과)

#### gitleaks CI 해결 (2026-05-21)

- gitleaks가 PR 전체 커밋 히스토리를 스캔 → 과거 커밋의 공개 키(Supabase anon key JWT, Kakao app key)를 시크릿으로 감지
- 시도한 접근: (1) docs 토큰 redaction (2) .gitleaks.toml regex allowlist (3) .gitleaksbaseline (4) commit allowlist — 모두 부분 실패
- 최종 해결: `app.json` → `app.config.ts` 전환 + `eas.json` env 제거 + `git rebase -i`로 fix 커밋을 원래 커밋에 fixup → 히스토리에서 키 완전 제거
- ADR-055 기록 완료

#### Git

- feat/10-1-native-auth 브랜치, 18개 커밋 (1~3 파일/커밋 컨벤션)
- PR #45: https://github.com/seomsoo/isakok/pull/45 (CI 통과, 머지 대기)

## 진행 중인 것

- **10-1 PR #45 머지 대기**

## 다음 할 것

1. **PR #45 머지** (squash merge)
2. **EAS Secrets 등록** — `eas secret:create`로 7개 키 등록 (EAS 빌드 전 필수)
3. **10-2 스펙 작성** — verify 리포트 미검증 항목 (토큰 만료, 디바이스 A/B, Apple 실기기, curl 테스트 등)을 검증 체크리스트로 포함
4. **Apple 실기기 테스트** — 시뮬레이터에서 불가, 기기 등록 + 코드 서명 필요
5. **Android 에뮬레이터 테스트** — 9단계 검증 완료 상태, auth 로직 추가 검증

## 알려진 문제

- urgent/critical 모드 격려 문구는 사용자 상황별 맞춤 교체 검토 (Follow-up)
- previousMode는 현재 세션 단위. 10단계 인증 후 서버 영속 검토 (Follow-up)
- CLAUDE.md import 별칭 `@shared/` vs 실제 `@moving/shared` 불일치 (빌드 문제 없음, 정리 필요)
- shared/constants/aiGuide.ts dead code (VALID_HOUSING_TYPES 등 미사용 상수)

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
- CI 워크플로우에서 `execSync`로 사용자 제어 가능한 값(브랜치명 등)을 쉘 보간하지 말 것 → `execFileSync` + argument array 사용 (GH_TOKEN 환경에서 command injection 위험)
- auto-fix-bot 워크플로우에서 trusted tools를 `tools/` 경로에 체크아웃하면, `gh` CLI 명령어는 git repo 컨텍스트가 필요하므로 `working-directory: workspace` 지정 필수 (pnpm setup도 `package_json_file: tools/package.json` 명시 필요)
- Claude API 단일 응답(비-에이전트)에서 중간 사고 출력을 막으려면 프롬프트에 "최종 마크다운만 출력, 추가 파일을 읽으려 하지 마라" 명시 필요 — 에이전트 정의만으로는 부족, user prompt에도 중복 지시
- Android WebView 무한 스피너 디버깅 시 네트워크 레이어만 의심하지 말 것 — 에뮬레이터 브라우저에서 접속 되면 네트워크는 정상. 앱 코드의 로딩 상태 해제 경로(onLoadEnd, onMessage의 WEB_READY 처리)를 먼저 확인
- Android 에뮬레이터에서 adb reverse는 에뮬레이터 재시작/ADB 재연결 시 풀림 — 10.0.2.2 + Vite `--host 0.0.0.0` 조합이 더 안정적 (adb reverse 불필요)
- Vite dev server를 `--host 0.0.0.0` 없이 기동하면 IPv6 `[::1]`에서만 리슨 — Android 에뮬레이터의 10.0.2.2는 IPv4 전용이라 접속 불가
- iOS 26.3 시뮬레이터 런타임은 부팅 불안정 (SimRuntime 검사에서 무한 대기) — 안정 버전(iOS 18.x) 사용 권장
- `@react-native-seoul/kakao-login` config plugin을 `app.json`에 누락하면 `RNKakaoLogins.init()` assertionFailure로 앱 크래시 — prebuild 전 config plugins 목록 반드시 확인
- iOS 시뮬레이터에서 앱 삭제해도 WebView localStorage는 안 지워짐 — SecureStore도 앱 컨테이너와 별개로 유지될 수 있음. 세션 초기화 필요 시 `xcrun simctl erase <device-id>` 사용
- `supabase.ts` 모듈 레벨에서 `isNativeWebView()` 호출하면 `window.__IS_NATIVE_WEBVIEW__`가 아직 설정 안 된 시점에 평가될 수 있음 — `typeof window !== 'undefined' && window.__IS_NATIVE_WEBVIEW__ === true`로 직접 체크
- WebView `injectedJavaScriptBeforeContentLoaded`로 localStorage 정리해도 native SecureStore에 세션이 남아있으면 `WEB_READY` 응답 시 다시 주입됨 — localStorage 정리만으로는 세션 초기화 불충분
