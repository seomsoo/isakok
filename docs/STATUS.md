# 프로젝트 상태

> 마지막 업데이트: 2026-05-29 (10-4 코드 구현 + /verify + 🔴 수정 반영 완료 — Phase A + §1~§8 + ADR-083. 🟡는 별도 PR. 커밋/PR → 배포·콘솔 작업 대기)

## 현재 단계

10-4단계: 정식 출시 준비 (공개 전 하드닝 + 부가 기능) — **코드 구현 + /verify + 🔴 수정 완료, 커밋/PR·배포 대기**

pnpm lint/typecheck/test(16/16)/build 통과 (Deno Edge Functions는 Node 빌드 제외 → deno check/배포 시 검증). feat/10-4-public-release 브랜치.
/verify 결과 docs/specs/10-4-public-release-verify.md: 🔴 5건 + dead code 모두 수정 반영 — (1) Kakao 웹훅 Authorization(KakaoAK) 헤더 검증 추가(공식 문서 확인, 스펙§5/ADR-078 정정), (2) Apple revoke best-effort(try/catch로 삭제 비차단), (3) 세션 불일치 시 pendingRef 재INSERT(orphan 방지), (4) 동시 업로드 가드(requestPicker), (5) 사진 조회 에러 상태(ErrorMessage). 🟡(a11y·perf·로그인 후 업로드 자동재개)는 follow-up PR로 분리.
ADR-075 결정으로 dev=prod 단일 프로젝트 운영 (분리 트리거 도달 시 Pro upgrade + 분리).

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
- PR #45: https://github.com/seomsoo/isakok/pull/45 (2026-05-21 머지 완료)

### 10-2: RLS 활성화 + Edge Function/Storage 보안

#### 마이그레이션 (00016~00020)

- 00016_enable_rls.sql: 7개 테이블 RLS ENABLE + 정책 생성 (users SELECT only, moves SELECT/INSERT/UPDATE, photos CRUD, ai_guide_cache/system_config 정책 정리, rate_limit_log service_role only)
- 00017_storage_policy.sql: dev permissive 정책 DROP + photos_select_own/insert_own/delete_own (foldername[1] = auth.uid()::text), UPDATE 정책 없음
- 00018_rate_limit.sql: rate_limit_log 테이블 + idx_rate_limit_log_window_start + increment_rate_limit RPC, RLS ENABLE + 0 정책 (service_role only)
- 00019_migrate_anonymous.sql: migrate_anonymous_to_user RPC (auth.uid() 검증, source==target 체크, provider='anonymous' 체크, keep_target/replace_with_source/keep_both 전략), REVOKE FROM PUBLIC + GRANT TO authenticated
- 00020_rpc_ownership_guard.sql: **옛 8인자 update_move_with_reschedule DROP** (P0 보안 수정) + 9인자 소유권 가드 재생성 + apply_ai_guides REVOKE/GRANT service_role only

#### Edge Function 보안

- generate-ai-guide/index.ts: JWT 인증 추가 (extractUserId + 401), move 소유권 검증 (403), CORS origin 제한 (resolveCorsOrigin/makeCorsHeaders 패턴 통일, 레거시 corsHeaders 제거)
- kakao-token-exchange/index.ts: CORS origin 제한 + Vary:Origin, rate limit (user 분당 5회 + IP 시간당 30회, fail-closed 503), IP sha256 해시
- \_shared/cors.ts: 레거시 `corsHeaders` export 제거, `x-debug-timing` 헤더를 공용 `makeCorsHeaders`에 추가

#### Storage 경로 변경

- apps/web/src/services/photos.ts: Storage 경로 `{userId}/{moveId}/{room}_{timestamp}` (photoType segment 제거), prefix ownership guard
- apps/web/src/features/photos/hooks/useSignedUrls.ts: userId 파라미터 추가, enabled 조건 강화

#### 검증 스크립트

- scripts/verify/rls-smoke.ts: A/B 익명 세션 격리 테스트 (move/checklist/users/master/config/ai_cache), service_role 시드 행 삽입 후 cache 테스트 (false positive 방지), Storage signed URL 격리 테스트
- scripts/dev-wipe.sql: child→parent 순서 DELETE, master/cache/config 보존, Storage 삭제, master_version 정합성 비교 쿼리

#### Codex 리뷰 수정

- [P1] 옛 8인자 update_move_with_reschedule overload DROP 누락 → 00020_rpc_ownership_guard.sql에 `DROP FUNCTION IF EXISTS` 추가 (PostgreSQL overloading으로 RLS 우회 가능했음)
- [P2] rls-smoke.ts ai_guide_cache 빈 테이블 false positive → service_role로 시드 행 삽입 후 authenticated 읽기 검증

#### spec-reviewer 수정 (🔴 3건 모두 완료)

- 00020 마이그레이션 분리 + 옛 overload DROP
- generate-ai-guide CORS origin 제한 (레거시 wildcard 제거)
- 스펙 §8 마이그레이션 범위 불일치 해소 (00020 파일 생성)

#### 문서

- docs/specs/10-2-rls-security.md (스펙 v3, 979줄)
- docs/specs/10-2-verify.md (검증 리포트 ✅ 통과)
- docs/DECISIONS.md: ADR-065 (RPC 소유권 보강 — 옛 overload DROP 필수) 추가

#### Git

- feat/10-2-rls-security 브랜치, 13개 커밋 (1~3 파일/커밋 컨벤션)
- PR #47: https://github.com/seomsoo/isakok/pull/47 (2026-05-25 squash 머지 완료)

#### 런타임 검증 (2026-05-25 완료)

- [x] DB 마이그레이션: `supabase db push` — 00016~00020 적용 완료 (00012~00015는 10-1에서 이미 적용, `migration repair --status applied`로 동기화)
- [x] RLS 스모크 테스트: `rls-smoke.ts` **16/16 통과** — A/B 유저 격리, 공개 테이블 읽기, ai_guide_cache 차단, users UPDATE 차단, Storage signed URL 격리
- [x] Edge Function 보안: generate-ai-guide JWT없음→401, 잘못된origin→403 / kakao-token-exchange 잘못된origin→403, JWT없음→401
- [x] Storage 테스트: 브라우저에서 사진 업로드 (userId prefix 경로) + signed URL 썸네일 정상 렌더링, 콘솔 에러 0건
- [x] RATE_LIMIT_SALT 등록: `supabase secrets set` 완료 (openssl rand -hex 32)
- [ ] EAS Secrets (모바일): Google Sign-In iosUrlScheme 설정 문제로 `eas env:list` CLI 실패 — EAS 빌드 설정 단계에서 같이 해결 예정
- [x] 10-1 추가 검증 (2026-05-25): #40 만료 refresh token 재가입 (3/3 통과), #60 provider trigger 갱신 (DB 직접 검증), #79 401 인터셉터 코드 경로 확인 (네이티브 E2E만 잔존)
- [x] 임시 테스트 스크립트 정리: check-provider.ts, check-provider-update.ts, test-expired-refresh.ts, test-401-response.ts 삭제 (rls-smoke.ts만 유지)

### iOS 실기기 테스트 + UI 폴리시 (2026-05-25)

#### 브릿지 확장

- packages/shared/src/types/bridge.ts: `NAVIGATE_TAB`, `SET_TAB_BAR` 메시지 타입 추가
- apps/mobile/src/components/WebViewScreen.tsx: NAVIGATE_TAB(탭 전환), ROUTE_CHANGE(온보딩/pre-check 탭바 숨김), SET_TAB_BAR(모달 탭바 숨김) 핸들러 + `useNavigation` + TAB_BAR_STYLE/TAB_BAR_HIDDEN 상수 + `onRouteChange` prop 제거
- apps/web/src/App.tsx: WebReadySignal에 pathname 변경 시 `ROUTE_CHANGE` 전송 추가

#### 크로스탭 네비게이션

- apps/web/src/features/dashboard/components/UpcomingSection.tsx: "전체 보기" 링크에 네이티브 탭 전환 (`NAVIGATE_TAB: timeline`)
- apps/web/src/features/dashboard/components/ActionSection.tsx: "전체 보기" 링크에 네이티브 탭 전환 (`NAVIGATE_TAB: timeline`)
- apps/web/src/features/dashboard/components/PhotoPromptCard.tsx: "기록 시작하기" 버튼에 네이티브 탭 전환 (`NAVIGATE_TAB: photos`)

#### 대시보드 헤더 개선

- apps/web/src/pages/DashboardPage.tsx: PageHeader(이사콕 로고) 제거, greeting 텍스트 + 설정 아이콘을 단일 header로 통합

#### 설정 화면 로그인/로그아웃

- apps/web/src/features/settings/components/SettingsMenuList.tsx: 익명→로그인 버튼(REQUEST_LOGIN), 회원→로그아웃 버튼(REQUEST_LOGOUT, critical 컬러) 분기
- apps/web/src/auth/webSessionListener.ts: AUTH_LOGOUT 수신 시 `queryClient.clear()` + `window.location.replace('/')` 추가

#### 사진 상세 탭바 숨김

- apps/web/src/features/photos/components/PhotoFullscreenViewer.tsx: mount 시 `SET_TAB_BAR visible:false`, unmount 시 `visible:true` (Codex 수정 — PhotoDetailSheet가 아닌 실제 사용 컴포넌트)
- apps/web/src/features/photos/components/PhotoDetailSheet.tsx: 미사용 SET_TAB_BAR 코드 + isNativeWebView/sendToNative import 제거

#### 키보드 확대 방지

- apps/web/index.html: viewport meta에 `maximum-scale=1.0` 추가 (iOS WebView에서 font-size < 16px input 포커스 시 자동 확대 방지)

#### 텍스트 선택/길게 누르기 차단

- apps/web/src/index.css: `body.native-webview` + `html.native-webview` 스코프에 `-webkit-user-select: none`, `-webkit-touch-callout: none`, `user-select: none` + textarea/input만 선택 허용
- apps/mobile/src/components/WebViewScreen.tsx: `contextmenu`, `selectstart`, `dragstart` 이벤트 capture 단계 차단 (textarea/input/contenteditable 예외) — CSS만으로 iOS WebView 일부 요소에서 새는 케이스 보완 (Codex 수정)

#### EntryRedirect 세션 대기

- apps/web/src/pages/EntryRedirect.tsx: 네이티브 WebView에서 세션 주입 전 onboarding으로 리다이렉트되는 문제 → SESSION_WAIT_MS(3초) 타임아웃 + userId 수신 시 즉시 진행

#### app.config.ts 조건부 플러그인

- apps/mobile/app.config.ts: kakaoAppKey/googleIosUrlScheme 없을 때 config plugin 스킵 (EAS CLI 실패 방지)

#### 기타 수정

- apps/web/src/features/photos/hooks/useUploadPhoto.ts: 디버그 에러 메시지 복원
- apps/web/src/pages/PhotosPage.tsx: 디버그 에러 메시지 복원
- packages/shared/src/utils/photoHash.ts: `crypto.subtle` 미지원 환경(HTTP non-localhost) FNV-1a 해시 폴백 추가
- scripts/dev-wipe.sql: Storage SQL 직접 삭제 불가 (protect_delete 트리거) → 주석 처리 + 대시보드 수동 삭제 안내
- apps/web/src/index.css: body에 `background-color: var(--color-neutral)` 추가 (사진탭 흰색 갭 수정)

#### 10-1/10-2 verify 실측 완료 (이전 세션 포함, 2026-05-25)

- 10-1 #55 Apple 로그인 ✅ (실기기 Sign in with Apple 성공)
- 10-1 #57 Kakao 로그인 ✅ (Edge Function 경유 링킹)
- 10-1 #59 Kakao custom-linked ✅
- 10-1 #60 linkIdentity 후 provider 갱신 ✅ (DB trigger 확인)
- 10-1 #78 로그아웃 AUTH_LOGOUT ✅ (설정 화면 로그아웃 + WebView 3개 broadcast)
- 10-2 #75 linkIdentity 후 provider 갱신 실측 ✅
- 10-2 #83 dev wipe 후 데이터 0건 확인 ✅

### 10-3 단계: 계정 삭제 + 약관 + release-gate (2026-05-26 ~ 2026-05-27)

> ADR-075 결정으로 dev=prod 단일 프로젝트 운영. 분리 트리거(10-4 폐쇄 테스트·DB 50%·MAU 1000+·스키마 큰 변경) 도달 시 Pro upgrade + 분리.

#### 약관 페이지 (②)

- `apps/web/src/pages/PrivacyPage.tsx` (신규) — PIPC 구조 + §3-1 인벤토리 (소셜식별자/이사정보/사진EXIF·SHA-256/메모/익명세션/해시IP) + 처리위탁(Supabase Seoul·Vercel·Anthropic·Apple/Google/Kakao) + 정보주체 권리 + 만 14세 미만 제한 + 보호책임자 usnimoes@gmail.com
- `apps/web/src/pages/TermsPage.tsx` (신규) — 11개 조항 (목적/정의/약관 효력/회원가입/서비스 제공/회원 의무/탈퇴·자격상실/면책/책임 제한/준거법/문의). 면책 조항에 "정보 제공 목적·법률 자문 아님" 명시
- `packages/shared/src/constants/routes.ts` — PRIVACY, TERMS 추가 (공개 라우트, 세션 게이트 바깥)
- `apps/web/src/App.tsx` — `/privacy`, `/terms` 라우트 추가
- `apps/web/src/features/settings/components/SettingsMenuList.tsx` — placeholder URL 제거, 실제 라우트로 navigate + mailto 보호책임자 이메일로 교체

#### 계정 삭제 Edge Function (①)

- `supabase/functions/delete-account/index.ts` (신규) — service_role admin client, 스펙 §2-2 순서:
  - CORS (resolveCorsOrigin/makeCorsHeaders) → 미허용 403, OPTIONS 204, POST 외 405
  - JWT 검증 (anon client `getUser`) → 미인증 401
  - **회원 전용 가드** — `is_anonymous`이면 403 (스펙 결정 #3 회원 전용 확정 + ADR-074 연계)
  - rate limit `increment_rate_limit('delete-account:user:{id}', 분당 3회)` → 초과 429 (P1)
  - **재귀 Storage `list()`** — `{userId}` → moveId 폴더들 → 파일들 (storage.objects 직접 조회 X, public Storage API만)
  - chunk(100) `remove()` + 1~3회 retry → 최종 실패 시 stage='storage-remove' 500
  - **삭제 후 prefix 재조회 잔여 0건 검증** → > 0 시 stage='storage-verify' 500 (deleteUser 진행 X)
  - `auth_provider_links` 명시 삭제 (deleteUser 전; partial cleanup 시 로그)
  - `auth.admin.deleteUser(userId)` → public.\* CASCADE 자동 (4 테이블)
- `import 'npm:@supabase/supabase-js@2'` (jsr→npm) — admin SDK 호환 안정화 (Kakao 디버깅 과정에서 발견)
- 에러 응답 트리밍: client엔 일반 메시지(`'DELETE_ACCOUNT_FAILED'` 등), server는 console.error로 상세 stage·code

#### 브릿지 + Provider revoke (mobile)

- `packages/shared/src/types/bridge.ts` — `REQUEST_DELETE_ACCOUNT` (web→native), `ACCOUNT_DELETE_RESULT { ok, stage? }` (native→web) 추가
- `apps/mobile/src/auth/providers/types.ts` — `AuthProvider`에 optional `revoke()` 추가 (timeout으로 감싸야 함, PII 없는 errorCode만 warn 로그)
- `apps/mobile/src/auth/providers/KakaoProvider.ts` — `revoke()` = `unlink()` (@react-native-seoul/kakao-login)
- `apps/mobile/src/auth/providers/GoogleProvider.ts` — `revoke()` = `GoogleSignin.revokeAccess()`
- `apps/mobile/src/auth/providers/AppleProvider.ts` — revoke 미구현 (10-4)

#### AuthService.deleteAccount (mobile)

- `apps/mobile/src/auth/AuthService.ts` — `deleteAccount(): Promise<DeleteAccountResult>` 추가:
  - delete-account Edge Function 호출 (401/네트워크오류 시 stage='auth-expired'/'network'로 익명 복구 경로 진입)
  - 모든 provider revoke best-effort + **5s timeout** (`withTimeout`) + PII 없는 짧은 warn 로그
  - provider signOut + session.clear + clearCurrentSession
  - `broadcastToWebViews({ type: 'AUTH_LOGOUT' })` + `broadcastToWebViews({ type: 'ACCOUNT_DELETE_RESULT', payload: { ok, stage } })`
  - `ensureAnonymousSession()` → 새 anon id 발급 + AUTH_SESSION broadcast
- `apps/mobile/src/components/WebViewScreen.tsx` — `REQUEST_DELETE_ACCOUNT` 케이스 추가

#### 계정 삭제 UI (web)

- `apps/web/src/features/settings/components/DeleteAccountSheet.tsx` (신규) — 2단계 confirm 시트:
  - step `info` — 안내(무엇이 지워지나 4가지 + 되돌릴 수 없음) + 동의 체크박스 + "계정 삭제로 진행하기" critical CTA
  - step `confirm` — "정말 삭제하시겠어요?" 경고 + "네, 삭제할게요" critical CTA + 취소
  - step `pending` — 로딩 표시
  - `ACCOUNT_DELETE_RESULT` 메시지 수신 시 useToast로 결과 표시 (ok/auth-expired/network/기타)
- `apps/web/src/features/settings/components/SettingsMenuList.tsx` — 회원 전용 "계정 삭제" 항목 (danger). 익명 사용자는 노출 X
- `apps/web/src/pages/SettingsPage.tsx` — DeleteAccountSheet 토글

#### Android WebView 카메라 (§5-2)

- `apps/mobile/app.config.ts` — `android.permissions: ['CAMERA']` 추가. `<input accept="image/*" capture>`가 카메라 띄울 수 있게. 실기기 결과로 적절성 최종 확인 (Task #11)

#### dev→prod 하드닝 게이트 (다른 Claude 안전 분석 반영)

ADR-075 채택과 함께 즉시 수행한 안전 게이트:

##### 1. 마지막 클린 와이프 + dev-wipe.sql 삭제 ⚠️ 1순위

- service_role 직접 호출로 Storage 48 paths + auth.users 22명(anon 19 + non-anon 3) + rate_limit_log 16건 + public.users·moves·user_checklist_items·property_photos·auth_provider_links 전부 CASCADE 정리
- 보존: master_checklist_items 46, ai_guide_cache 4, system_config 1
- **`scripts/dev-wipe.sql` 삭제** — dev=prod 결정으로 project-ref 가드가 prod를 가리켜 장전된 총. 일회용 cleanup 스크립트는 작업 후 함께 삭제

##### 2. 자동 백업 워크플로우 ⚠️ 2순위

- `.github/workflows/db-backup.yml` (신규) — 매일 KST 03:00 cron + workflow_dispatch
- `pg_dump --schema=public --no-owner --no-acl --quote-all-identifiers` → gzip → `actions/upload-artifact@v7` (90일 retention)
- GitHub Secret `SUPABASE_DB_URL` (사용자가 reset password 후 direct connection URI 등록)
- 실행 검증은 PR 머지 후 (workflow_dispatch는 default branch 필수)

##### 3. 키 rotation — Legacy JWT 무효화 + 새 체계 전환

- Supabase Dashboard → API Keys → **"Disable JWT-based API keys"** 클릭 → 옛 `anon`/`service_role` Legacy HS256 JWT 영구 무효
- 새 publishable/secret API key 체계로 전환:
  - `.env.local`, `apps/web/.env.local`, `apps/mobile/.env`의 `*_SUPABASE_ANON_KEY` → `sb_publishable_***`
  - secret key는 chat에 잠시 노출됐으나 향후 Edge Functions이 인프라 자동 inject — 추가 새 secret 발급은 사용자가 risk acceptance로 skip
- supabase-js 2.106.1 — 새 publishable key 호환 확인 (RLS smoke 16/16 통과)

##### 4. kakao-token-exchange 에러 응답 트리밍

- 옛 client 응답: `{"error":"updateUser failed code=unexpected_failure status=500 msg=Error updating user"}` (server 내부 정보 노출)
- 새 client 응답: `{"error":"KAKAO_USER_UPDATE_FAILED"}` 등 일반 코드만
- server console.error는 `[kakao-exchange:updateUserById]`에 code/status/name/message/email/hasRealEmail 상세 (dashboard logs만 보임)

##### 5. gitleaks 히스토리 전수 스캔

- `gitleaks detect --log-opts="--all"` → 290 commits, **17건 누출 발견**:
  - `apps/mobile/eas.json` (c17b2dc5): JWT × 3 + generic-api-key × 3
  - `apps/mobile/app.json` (c17b2dc5): generic-api-key × 1
  - `.gitleaksbaseline` (9d0336b2): JWT × 6 + generic-api-key × 4
- 노출 키: Supabase anon JWT + Kakao native app key + Google client IDs
- 대응: rotation으로 노출 키 무효(Legacy JWT disable로 anon/service_role 즉시 무효). git history rewrite는 Task #21 (작업 마지막).
- service_role 키는 git history엔 없음 ✓ (다만 이번 세션 chat 컨텍스트에 노출됨 — Legacy disable로 무효화)

##### 6. OAuth provider 콘솔 — internal URL 등록

- **Google Cloud OAuth Web 클라이언트** — 승인된 JavaScript 원본 + 리디렉션 URI에 `https://isakok.vercel.app` 추가
- **Supabase Auth URL Configuration** — Site URL + Redirect URLs에 `https://isakok.vercel.app` 추가
- **Kakao Developers**는 native SDK + Edge Function exchange 흐름이라 콘솔 web 등록 불필요. 10-4 Kakao 웹훅 단계에서 함께 마무리
- **Apple**은 native flow (expo-apple-authentication)라 콘솔 작업 없음
- **Edge Function CORS** (`supabase/functions/_shared/cors.ts`) — `https://isakok.vercel.app` 이미 ALLOWED_ORIGINS에 포함됨

##### 7. internal 웹 배포 (Vercel)

- 기존 production Vercel deployment를 internal alias로 사용 (dev=prod). 고정 alias = `isakok.vercel.app` (스펙 §4-6 stable alias 요구 충족)
- Vercel 환경변수 `VITE_SUPABASE_ANON_KEY` → `sb_publishable_***`로 갱신 + redeploy

##### 8. EAS Secrets (production scope)

ADR-055 정신("EAS Secrets + app.config.ts로 관리, eas.json env block 금지") 일관. Expo dashboard에서 production scope에 7개 등록:

```
EXPO_PUBLIC_WEB_APP_URL          = https://isakok.vercel.app
EXPO_PUBLIC_SUPABASE_URL         = https://ybcqinanfcarhqkclvue.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY    = sb_publishable_***   (Sensitive)
EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID = (apps/mobile/.env 값)
EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID = (.env 값)
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID = (.env 값)
EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY = (.env 값, Sensitive)
```

- `apps/mobile/.env`는 dev LAN URL (localhost:5173) 그대로 — 시뮬레이터 dev 흐름용
- `apps/mobile/eas.json` 보강 — production profile에 `extends: 'base'` + `android.buildType: 'app-bundle'` + `autoIncrement: true` + `cli.appVersionSource: 'remote'` (versionCode EAS 서버 관리)

#### 검증 — delete-account + Provider revoke (실기기/시뮬레이터)

스펙 §8 핵심 항목 매트릭스 (Apple + Kakao + Google 3 provider):

| 항목                                                               |                    Apple                    |         Kakao          |            Google            |
| ------------------------------------------------------------------ | :-----------------------------------------: | :--------------------: | :--------------------------: |
| 로그인 → 사진 업로드(선택) → 계정 삭제 → onboarding 복귀           |                     ✅                      |   ✅ (Codex fix 후)    |              ✅              |
| `removed_paths=N` 로그 + Edge Function `OK` 응답                   |                ✅ (paths=2)                 |           ✅           |              ✅              |
| **`protect_delete` 트리거가 Storage API `remove()`를 막는지 실측** | ✅ **우회 성공** (스펙 §2-2 #3 대응 불필요) |       — (사진 0)       |          — (사진 0)          |
| `auth_provider_links` CASCADE 정리                                 |               N/A (link 없음)               |           ✅           |              ✅              |
| `auth.admin.deleteUser` + public.\* CASCADE                        |                     ✅                      |           ✅           |              ✅              |
| 새 anon id 발급 + AUTH_SESSION broadcast                           |                     ✅                      |           ✅           |              ✅              |
| **revoke 동작** (warn 로그 유무)                                   |             N/A (10-4 deferred)             | **✅** `unlink()` 성공 | **✅** `revokeAccess()` 성공 |
| JWT 없음 401 (gateway-level)                                       |               ✅ (curl 검증)                |         (동일)         |            (동일)            |
| anonymous → 403 코드 검증                                          |              ✅ (코드 review)               |           —            |              —               |
| 재귀 list nested 파일 수집                                         |                     ✅                      |           —            |              —               |
| 잔여 prefix 재조회 0건 통과 후 deleteUser                          |               ✅ (Apple 흐름)               |           —            |              —               |

미검증/deferred:

- Apple revoke (10-4 token revoke endpoint 도입)
- rate limit 429 (P1, 같은 user JWT로 4회 호출 불가 — 코드 review로 충분)

검증 user들:

- Apple: `2bf1334d-f825-4f2e-9784-4e0f63616c10` (사진 2장 → 모두 삭제)
- Kakao: `d46fda66-c132-4354-a210-a7abb3f97bce` (kakao_id=4905562841, 고유 placeholder 이메일)
- Google: `63ea462f-916f-4773-bf1d-3b12e648d754`
- 검증 종료 후 모든 user 0건, auth_provider_links 0건, Storage 0건 확인

자동 검증:

- `scripts/verify/rls-smoke.ts` — 새 publishable key로 16/16 통과 (A/B 격리, 공개 테이블, ai_guide_cache 차단, users UPDATE 차단, Storage signed URL 격리)
- supabase-js 2.106.1이 새 publishable key 호환 검증

#### Codex 인계 작업 — Kakao 로그인 non-2xx 디버깅

**문제**: Apple 계정 삭제 후 Kakao 로그인 시도 시 `status=500 / unexpected_failure (updateUser failed)`. Metro logs / dashboard / service_role DB 진단으로 추적.

**1차 원인**: Supabase Edge Runtime의 `jsr:@supabase/supabase-js@2`에서 `admin.auth.admin.updateUserById()`가 `unexpected_failure` 반환. **같은 admin SDK 호출이 Node.js script로는 정상 동작** (격리 시도 5가지 payload 모두 OK) → Edge Function 환경 회귀.

**2차 원인**: 옛 테스트에서 만든 orphan auth user가 placeholder 이메일 `kakao_${kakaoId}@isakok.invalid`를 점유 → 같은 placeholder로 새 user 만들려고 할 때 409 email duplicate. UI에서 "홈으로 돌아가기"는 conflict=true 처리 화면이지 진짜 성공이 아니었음.

**Codex 수정** (`supabase/functions/kakao-token-exchange/index.ts`):

- `jsr:@supabase/supabase-js@2` → `npm:@supabase/supabase-js@2`
- `admin.auth.admin.updateUserById` SDK 호출 → **Auth Admin REST API 직접 호출** (`PUT /auth/v1/admin/users/{id}` with apikey + Bearer service_role)
- Kakao placeholder 이메일을 고유값으로: `kakao_{kakaoId}_{anonymousUserId}@isakok.invalid`
- `app_metadata: { provider: 'kakao', providers: ['kakao'] }` — providers 배열 추가 (새 GoTrue 형식)
- 409 → 더 이상 conflict=true 성공처럼 처리 안 함. 클라이언트가 명확한 에러("이미 다른 계정에 연결된 카카오 계정이에요")로 처리
- `apps/mobile/src/auth/AuthService.ts` — 임시 `[KakaoExchange:DEBUG]` console.error 제거

**검증** (Codex 후 사용자 재시도): rate_limit_log에서 13:19~13:57 사이 6회 시도 모두 통과 (count=1만 추가). `d46fda66` user가 정상 anon=false 전환 + `auth_provider_links`에 (kakao, 4905562841) 매핑 추가. 그 후 계정 삭제까지 정상 완료.

#### Conflict 확인 다이얼로그 (2026-05-27)

익명 사용자가 이미 데이터가 있는 기존 계정으로 로그인할 때 사전 확인:

- `apps/mobile/src/auth/AuthService.ts` — `SignInResult`에 `conflict-pending` 모드 추가. `confirm()` 클로저로 실제 전환 지연
- `apps/mobile/src/app/auth.tsx` — `Alert.alert` 기반 네이티브 다이얼로그 (iOS HIG `style: 'destructive'`). 취소 시 익명 세션 유지
- `conflictStuck` state + 기존 conflict 에러 메시지 제거
- `docs/UI-POLISH.md` §8에 Before/After 패턴 문서화

#### 앱 아이콘 + 스플래시 (2026-05-27)

- `apps/mobile/assets/icon.png` — 1024×1024 실제 로고 (집+체크마크, 흰색 배경, 둥근 모서리). iOS 앱 아이콘용
- `apps/mobile/assets/adaptive-icon.png` — 40% 투명 배경 버전 (Android adaptive icon foreground). 70%→50%→35%→40% 반복 후 확정
- `apps/mobile/assets/splash-icon.png` — 70% 투명 배경 버전 (Android 스플래시)
- `apps/mobile/assets/splash-icon-ios.png` (신규) — 30% 투명 배경 버전 (iOS 스플래시). 20%→30% 반복 후 확정
- `apps/mobile/app.config.ts` — `ios.splash` 별도 설정 (iOS 전용 이미지 + 배경색)

#### Kakao Maven 자동 주입 플러그인 (2026-05-27)

- `apps/mobile/plugins/kakao-maven.js` (신규) — `withProjectBuildGradle` config plugin. `prebuild --clean` 시 자동으로 `build.gradle`에 Kakao Maven repo 주입
- `apps/mobile/app.config.ts` — plugins 배열에 `'./plugins/kakao-maven'` 추가
- `prebuild --clean`이 수동 build.gradle 수정을 날리는 문제 해결

#### iOS ATS 예외 (2026-05-27)

- `apps/mobile/app.config.ts` — `NSAppTransportSecurity: { NSAllowsArbitraryLoads: true }` 추가 (iOS WebView에서 HTTP dev 서버 접근용)

#### Play Console 등록 (2026-05-27~28, Task #10 완료)

- 앱 생성: `com.isakok.app`, 한국어, 무료
- 앱 콘텐츠: 전체이용가 (IARC), 타겟 18+, 데이터 안전성 (계정식별자·이름·이메일·사진 수집, 제3자 공유 없음, 암호화 전송, 삭제 가능)
- 개인정보처리방침 URL: `https://isakok.vercel.app/privacy`
- 스토어 등록정보: 제목 "이사콕 - 이사 일정 관리", 설명, 카테고리 "도구", 스크린샷 (실기기 캡처)
- EAS production AAB 빌드 → 내부 테스트 트랙 업로드 → 테스터 그룹 생성 → opt-in 링크 배포

#### Play App Signing SHA-1 + OAuth/Kakao 등록 (2026-05-28, Task #9 완료)

- Play Console → 앱 서명 → SHA-1 확인: `63:9D:67:E2:FD:AE:F1:61:92:F3:40:43:F2:49:61:89:21:BB:42:D3`
- Google Cloud Console → "Isakok Android" OAuth 클라이언트에 Play App Signing SHA-1 추가 (기존 debug SHA-1과 별도)
- Kakao Developers → 키 해시 추가: SHA-1 hex → binary → base64 변환 (`Y51n4v2u8WGS80BD8klhiSG7Qts=`)

#### 실기기 검증 (2026-05-28, Task #11 완료)

Play Store 내부 테스트 빌드 + iOS 실기기 빌드 검증:

| 항목                    | Android (Play Store) |  iOS (실기기)  |
| ----------------------- | :------------------: | :------------: |
| Google 로그인           |          ✅          | ✅ (이전 세션) |
| Kakao 로그인            |          ✅          | ✅ (이전 세션) |
| 온보딩 → 대시보드       |          ✅          |       ✅       |
| 탭 전환 (전체/집기록)   |          ✅          |       ✅       |
| 계정 삭제 → 온보딩 복귀 |          ✅          | ✅ (이전 세션) |
| 앱 아이콘 표시          |          ✅          |       ✅       |
| 스플래시 스크린         |          ✅          |       ✅       |

#### .gitignore 추가

- `app.json`, `apps/web/app.json`, `apps/web/ios/` — Expo prebuild 생성 파일 제외

#### Git

- `feat/10-3-internal-release` 브랜치 (origin/main에서 분기)
- 1개 commit pushed: `856f7d5 ci: add daily db backup workflow`
- 나머지 변경 (12 modified + 5 untracked)은 working tree 보존 — 다른 세션에서 검증 + 커밋 분할 + 단일 squash PR 예정
- 임시 디버그 코드 없음 (Codex가 정리). 일회용 진단 스크립트(`scripts/verify/kakao-debug.ts`, `kakao-update-test.ts`, `delete-test-user.ts`, `wipe-all.ts`) 삭제 완료. `rls-smoke.ts`만 보존 (검증 도구)

### 10-4단계: 정식 출시 준비 (공개 전 하드닝 + 부가 기능) (2026-05-29)

> 스펙: docs/specs/10-4-public-release.md (v2). 코드 구현 완료, /verify·Codex 리뷰·커밋 분할·배포·콘솔 작업 대기.
> 전 섹션 검증: pnpm lint/typecheck/test(16/16)/build 통과. supabase/functions(Deno)는 Node 빌드 제외라 deno check/배포 시 검증.

#### Phase A: 스키마/공통 기반

- supabase/migrations/00021_apple_refresh_token.sql: auth_provider_links에 `apple_refresh_token` 컬럼(service_role only) + provider CHECK `('kakao','apple')` 완화 (ADR-077)
- supabase/functions/\_shared/deleteUserData.ts (신규): 삭제 코어 — listUserStoragePaths / deleteUserStorage / deleteUserDatabaseRows / deleteUserCompletely + DeleteUserError(stage). delete-account/cleanup/kakao-unlink-webhook 공용 (ADR-082)
- delete-account/index.ts: 코어 재사용 리팩터링 (CORS/JWT/익명가드/rate limit/stage별 응답 동작 보존)

#### §1 사진 저장 게이트 (ADR-074 구현)

- PhotoUploadFab.tsx, PhotoEmptyState.tsx: `isAnonymous`/`onRequestLogin` prop — 익명이면 촬영/갤러리 탭 시 **파일 선택 전** REQUEST_LOGIN(source: photo_gate). EmptyState에 "보증금 분쟁 증거" 가치 문구
- PhotoRoomPage.tsx, PhotosPage.tsx: `isAnonymous` 주입 + 게이트 분기 (handleAddTrigger/handlePick)
- bridge.ts: REQUEST_LOGIN payload에 'photo_gate'가 이미 존재 → 변경 불필요

#### §2 네이티브 미디어 입력 (ADR-079, ADR-083)

- bridge.ts: 미사용 OPEN_CAMERA/PHOTO_TAKEN → `OPEN_MEDIA_PICKER{kind,multi,moveId,room,photoType,maxSelect}` / `MEDIA_UPLOADED{moveId,room,photoType,items[],failed}`로 교체
- apps/mobile/src/media/mediaUpload.ts (신규): expo-image-picker → EXIF taken_at 추출(압축 전) → expo-image-manipulator 리사이즈(긴 변 1920px)+압축(WebP 80%/JPEG 폴백, ~300KB) → SHA-256 → createAuthedClient로 Storage 직접 업로드. 다중 부분 실패는 failed 카운트
- apps/mobile/src/auth/supabaseNative.ts: createAuthedClient(accessToken) 추가 (사용자 JWT로 Storage RLS 통과)
- WebViewScreen.tsx: OPEN_MEDIA_PICKER 핸들러 → pickAndUploadMedia → MEDIA_UPLOADED 회신
- apps/web/src/services/photos.ts: uploadPhoto(Storage+DB) 제거 → insertUploadedPhotos(DB INSERT only) 추가
- apps/web/src/features/photos/hooks/useMediaUploadListener.ts (신규): MEDIA_UPLOADED 수신 → 세션 일치 검증(storage_path userId == 세션 userId, 불일치 시 REQUEST_SESSION_REFRESH + toast) → insertUploadedPhotos → invalidate + toast
- 제거: useUploadPhoto.ts, features/photos/utils/exif.ts, resizeImage.ts (웹 업로드 경로 대체) + apps/web exifreader 의존성
- app.config.ts: NSPhotoLibraryUsageDescription 제거(PHPicker 권한 불필요), NSCameraUsageDescription 유지, expo-image-picker 플러그인(photosPermission:false, cameraPermission:false)
- 의존성 추가: expo-image-picker(~55.0.20), expo-image-manipulator(~55.0.17), base64-arraybuffer

#### §3 cleanup (ADR-076)

- supabase/functions/cleanup/index.ts (신규): 익명 user 파기 + 휴지통 30일 hard delete + orphan 24h, 단일 함수 3처리. DRY_RUN 모드 + structured log + CLEANUP_TOKEN 검증. \_shared/deleteUserData 재사용. 한 처리 실패해도 나머지 진행
- migrations/00022_cleanup.sql: get_anonymous_cleanup_candidates RPC (last_activity_at 30일 경과 + 미래 active move 없음, is_anonymous만, service_role only)
- supabase/functions/cleanup/cron-setup.sql: Supabase Cron(pg_cron+pg_net+Vault) 수동 설정 SQL + 사전 준비(verify_jwt=false 배포, CLEANUP_TOKEN/DRY_RUN secret, Vault cleanup_token/project_url)

#### §4 Apple token revoke (ADR-077)

- supabase/functions/\_shared/apple.ts (신규): createAppleClientSecret(ES256 Web Crypto, .p8, 5분 캐시) / exchangeAppleAuthCode / revokeAppleToken(best-effort 5s, invalid_grant 무시) / decodeJwtSub
- supabase/functions/apple-token-exchange/index.ts (신규): code 교환 → refresh_token을 auth_provider_links upsert(provider=apple, provider_user_id=Apple sub, onConflict)
- AppleProvider.ts: authorizationCode 반환 / providers/types.ts: OidcProviderResult.authorizationCode 추가
- AuthService.ts: exchangeAppleToken 헬퍼 + Apple 로그인 3경로(identity-linked / conflict confirm / 직접 signed-in)에서 호출 (best-effort 1회 재시도)
- delete-account/index.ts: deleteUserCompletely 전 apple_refresh_token 조회 → revokeAppleToken (best-effort)

#### §5 Kakao 연결 끊기 웹훅 (ADR-078)

- supabase/functions/kakao-unlink-webhook/index.ts (신규): GET app_id/user_id/referrer_type 파싱 + app_id 검증 + Admin Key 연결 재조회(confirmKakaoUnlinked → **확정 불가 시 보류**) + provider count 분기(kakao만→deleteUserCompletely, 다른 provider 있으면 매핑만 제거) + idempotent + 항상 200

#### §6 충돌 Alert 문구 점검 (ADR-080)

- apps/mobile/src/app/auth.tsx: conflict Alert 문구 보강 ("기존 계정으로 로그인하면 이 기기에서 작성한 내용 사라지고 되돌릴 수 없음 + 취소하면 보관"), destructive 스타일 유지

#### §7 RLS CI (ADR-081)

- .github/workflows/rls-ci.yml (신규): PR/push → supabase/setup-cli + supabase start(로컬 스택) → jq로 로컬 키 파싱 → rls-smoke.ts. CI 범위 = DB RLS 격리만
- scripts/verify/rls-smoke.ts: auth_provider_links(apple_refresh_token 포함) + rate_limit_log 격리 테스트 추가 (service_role로 시드 후 authenticated 차단 확인 — 빈 테이블 false-positive 방지)
- supabase/config.toml: enable_anonymous_sign_ins = true (로컬/CI 전용, prod는 대시보드)

#### §8 OSS 고지 (코드)

- scripts/gen-oss-licenses.mjs (신규): web+mobile+shared production 의존성 → apps/web/src/data/ossLicenses.ts (36~37개) 자동 생성 (devDeps 제외)
- apps/web/src/pages/OssLicensesPage.tsx (신규) + ROUTES.OSS_LICENSES + App.tsx 라우트/drill + SettingsMenuList "오픈소스 라이선스" 링크

#### 사진 압축 결정 (ADR-083 — 대화 중 정정)

- 초안 "무압축"(quality 1, 3~5MB) → 무료 티어 1GB 기준 **~8명**에 소진 발견 → 6단계 방식(긴 변 1920px + WebP 80%, ~300KB, **~110명**)으로 정정. 증거력 핵심(촬영일시 DB 보존 + 식별성 + 압축본 SHA-256) 유지. 대안(원본+썸네일/Supabase 변환)은 원본을 그대로 저장해 저장 못 줄여 역효과 → 기각

#### 문서 (ADR + 스펙)

- docs/DECISIONS.md: ADR-076~083 추가 (10-4 세트 + 압축 정정 ADR-083). 스펙 §10이 "복붙용"이라 번호 공백 방지 위해 세트로 동기화
- docs/specs/10-4-public-release.md: §2 압축 정정(원래 "무압축" 결정은 취소선으로 보존), ADR-079 보완·ADR-083 추가, §11 체크리스트 갱신

#### Git (10-4)

- feat/10-4-public-release 브랜치 (origin/main에서 분기). 미커밋 — /verify 후 커밋 분할(1~3파일/커밋) + squash PR 예정

## 진행 중인 것

- **10-4 코드 구현 완료, 검증·배포 대기** — feat/10-4-public-release 브랜치(미커밋). 다른 세션에서 /verify → Codex 리뷰 → 커밋 분할(1~3파일/커밋) → squash PR. 그 후 사용자 배포·콘솔 액션(아래 "다음 할 것" + "알려진 문제").
- (10-3은 main 머지 완료 — PR #59 `2da4380`, DB 백업 pg_dump 수정 #60)

## 다음 할 것

1. **/verify (다른 세션) + Codex 리뷰** — 10-4 스펙(docs/specs/10-4-public-release.md) 대비 검증 + P등급 수정
2. **Deno Edge Function 타입 검증** — cleanup / apple-token-exchange / kakao-unlink-webhook / delete-account / \_shared(apple, deleteUserData)를 `deno check` 또는 `supabase functions deploy`로 확인 (로컬 deno 미설치라 미실시)
3. **커밋 분할(1~3파일/커밋) + squash PR** → 머지 후 **사용자 배포 액션**: `db push`(00021,00022) / 함수 4종 배포(+ secrets: APPLE_TEAM_ID/KEY_ID/CLIENT_ID/PRIVATE_KEY, CLEANUP_TOKEN, DRY_RUN, KAKAO_APP_ID, KAKAO_ADMIN_KEY) / cron-setup.sql / Kakao·Apple 콘솔 / App Store Connect·App Privacy / 브랜치 보호 RLS CI required check / `npx expo prebuild --clean`

## 알려진 문제

- urgent/critical 모드 격려 문구는 사용자 상황별 맞춤 교체 검토 (Follow-up)
- previousMode는 현재 세션 단위. 10단계 인증 후 서버 영속 검토 (Follow-up)
- CLAUDE.md import 별칭 `@shared/` vs 실제 `@moving/shared` 불일치 (빌드 문제 없음, 정리 필요)
- shared/constants/aiGuide.ts dead code (VALID_HOUSING_TYPES 등 미사용 상수)
- 10-2 폴백 발동(linkIdentity 실패→signInWithIdToken) 영속 로깅 미구현 — 현재 console.warn만, DB 카운트 테이블 추가 검토 필요
- 웹 8개 페이지에서 Error 분기 누락 (ux-state-reviewer 지적, 기존 이슈, 별도 단계)
- EAS CLI `eas env:list` 실행 시 Google Sign-In iosUrlScheme 누락으로 실패 — EAS Secrets 등록은 Expo dashboard 웹 UI로 완료. CLI 이슈는 별도
- **gitleaks 17건 노출 흔적 잔존** (apps/mobile/eas.json, apps/mobile/app.json, .gitleaksbaseline) — rotation으로 노출 키는 무효화. git filter-repo 정리는 Task #21 (PR 머지 직후 작업 마지막 단계)
- **delete-account rate limit 429 동적 검증 미실시** (P1) — 같은 user JWT로 4회 호출 불가(1회 시 user 삭제). 코드 review로 충분
- **Apple Sign in with Apple token revoke 미구현** — 10-4 deferred. 현재 Apple 삭제 흐름은 Supabase user + 앱 데이터만 삭제, Apple 측 앱 연결은 사용자가 설정에서 직접 해제 필요
- **Kakao Developers 콘솔 web 플랫폼 등록 미실시** — native SDK + Edge Function exchange 흐름이라 영향 없음. 10-4 Kakao 웹훅 단계에서 함께 마무리
- **service_role 키 이번 세션 chat 컨텍스트 노출** — Legacy JWT-based API keys disable로 즉시 무효화됨. 새 sb*secret*... 키도 chat에 잠시 노출 — 향후 보안 강박 시 dashboard에서 "+ New secret key" 발급 + 옛 secret disable로 재정리 가능
- **익명 cleanup 작업 미구현** — 30일 미활동 + 이사 일정 도래 시 자동 파기 정책. 약관엔 명시되어 있지만 cron job 미구현. 사진 저장 게이트(ADR-074, 10-5+) 적용 전까지 익명 사진이 서버에 쌓일 수 있음
- **Custom domain 미구매** — `isakok.vercel.app` 사용. WebView 앱이라 도메인 가시성 작아 지금은 ROI 낮음. 10-4 폐쇄 테스트 전 또는 GitHub README 강조 시점에 재검토 (ADR-075 분리 트리거 일부)
- **DB 백업 워크플로우 첫 실행 검증 미실시** — workflow_dispatch는 default branch 필수라 PR 머지 후 검증. 머지 직후 또는 다음날 KST 03:00 cron 자동 실행으로 확인
- **EAS Secrets visibility 분류** — 7개 변수 중 SUPABASE_ANON_KEY + KAKAO_NATIVE_APP_KEY는 Sensitive, 나머지는 Plain text 권장. 사용자가 모두 Sensitive로 통일했어도 안전한 default (동작은 동일)
- **(10-4 코드 해결)** Apple revoke(§4)·익명 cleanup(§3)·Kakao 웹훅(§5) 구현 완료 → 위 "Apple token revoke 미구현"·"익명 cleanup 작업 미구현"·"Kakao 콘솔 web 등록" 항목의 코드 부분 해소. **콘솔 등록·함수 배포·cron 설정은 사용자 액션 잔존**
- **10-4 §2 네이티브 미디어·압축은 EAS 빌드 실기기 검증 필요** — 로컬은 typecheck/lint만 통과. iOS WebP 인코딩은 JPEG 폴백으로 방어하나 실기기 확인 권장
- **Kakao unlink 웹훅 Admin Key 연결 재조회 규격(/v2/user/me + target_id) 미확정** — 구현 직전 Kakao 최신 문서 재확인 필요. 확정 불가 시 보류(안전 기본값)라 미확인이면 삭제 미발생(보수적)
- **Deno Edge Function 6종 로컬 deno check 미실시** (deno 미설치) — 배포/deno check로 타입 검증 필요. IDE의 Deno/npm: 진단은 false positive
- **cleanup orphan 청소는 전체 버킷 스캔** — 대규모에서 비용. 현재 인디 규모 OK, ADR-075 분리 시점 재검토
- **10-4 사용자 액션 미완**: db push(00021,00022) / 함수 4종 배포(+secrets) / cron-setup.sql / Kakao·Apple 콘솔 / App Store Connect·App Privacy / 브랜치 보호 RLS CI required / npx expo prebuild --clean

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
- PostgreSQL `CREATE OR REPLACE FUNCTION`은 동일 시그니처만 대체 — 파라미터 수가 다르면 별개 함수(overload)로 생성됨. SECURITY DEFINER 함수 시그니처 변경 시 반드시 `DROP FUNCTION IF EXISTS`로 옛 버전 제거 (안 하면 RLS 우회 가능)
- Edge Function 레거시 CORS export(`corsHeaders = { 'Access-Control-Allow-Origin': '*' }`)를 남겨두면 새 함수가 실수로 import할 위험 — origin 제한 패턴(`resolveCorsOrigin`/`makeCorsHeaders`)으로 통일 후 레거시 export 즉시 제거
- RLS smoke test에서 `data.length === 0` 단독 assertion은 "접근 거부"와 "빈 테이블"을 구분 못함 — service_role로 시드 행 삽입 후 authenticated로 읽기 시도하거나 error 존재 여부로 판정
- `supabase db push` 시 원격에만 있는 타임스탬프 마이그레이션(직접 적용한 것)이 로컬 마이그레이션과 충돌 — `migration repair --status reverted`로 원격 정리 후 `--status applied`로 이미 적용된 로컬 버전 동기화
- 웹앱을 브라우저에서 직접 열면 세션이 없어 온보딩에서 "session missing" 에러 — 네이티브 Expo가 세션을 주입하는 구조이므로, 브라우저 테스트 시 수동으로 `signInAnonymously()` 호출 후 새로고침 필요
- WebView에서 브릿지 메시지를 보내는 컴포넌트를 파일명으로 추측하지 말 것 — PhotoDetailSheet에 SET_TAB_BAR를 추가했으나 실제 화면은 PhotoFullscreenViewer였음. `grep -r 'import.*Component' src/` 등으로 import 그래프를 확인 후 작업
- Expo Metro 서버를 `--host lan` 없이 시작하면 실기기에서 Metro에 접속 불가 — `npx expo start --host lan` 필수
- `navigation.getParent().setOptions({ tabBarStyle })` 는 Stack navigator를 타겟하므로 탭바 제어 불가 — Tabs 화면에서는 `navigation.setOptions()` 직접 호출이 올바름
- iOS WebView에서 `-webkit-user-select: none`과 `-webkit-touch-callout: none`을 CSS body에만 걸면 일부 하위 요소에서 long-press 메뉴가 새는 경우 있음 — `*` 셀렉터 + `!important` + JS 이벤트 차단(contextmenu/selectstart/dragstart capture) 세 겹 방어 필요
- **Supabase Edge Runtime의 `jsr:@supabase/supabase-js@2`에서 `admin.auth.admin.updateUserById()`가 `unexpected_failure` 반환하는 회귀** — 같은 호출이 Node.js 스크립트로는 정상 동작. **해결책**: (a) import를 `npm:@supabase/supabase-js@2`로 변경 (b) admin SDK 대신 raw `fetch`로 `PUT /auth/v1/admin/users/{id}` 직접 호출 (apikey + Bearer service_role 헤더). kakao-token-exchange가 이 두 패턴 모두 적용
- **Kakao 익명→permanent 전환 시 placeholder 이메일 고정값 사용 금지** — `kakao_${kakaoId}@isakok.invalid` 고정이면 옛 테스트 잔재 orphan user가 같은 placeholder 점유 시 409 email duplicate. **해결책**: `kakao_${kakaoId}_${anonymousUserId}@isakok.invalid` 같은 고유값
- **Edge Function 500 응답에 server 내부 에러 메시지 노출 금지** — `errorResponse(500, err.message)` 형태로 client에 server detail 전달하면 prod 부적합. **해결책**: client 응답은 일반 코드(`'KAKAO_USER_UPDATE_FAILED'` 등), server는 `console.error('[label]', { code, status, message, ... })`로 상세 logging. dashboard logs에서만 보임
- **service_role 키를 chat에 직접 export 금지** (가능하면) — Claude bash에서 `SUPABASE_SERVICE_ROLE_KEY=eyJ...` inline export하면 chat history에 평문 노출. 대신 사용자가 .env.local에 추가 후 Claude는 process.env로 읽기. 단 진단·검증에 효율 우선이면 risk acceptance + 작업 후 rotation
- **`listUsers({ perPage: 200 })`는 anonymous 사용자를 default exclude** — 새 supabase-js 버전 동작. 모든 user 보려면 raw HTTP (`GET /auth/v1/admin/users`) 또는 `getUserById(id)` 직접 호출
- **`git filter-repo`는 작업 도중 실행 금지** — working tree 변경 + stash → filter → unstash 충돌 위험 + 모든 commit hash 변경으로 진행 흐름 꼬임. **해결책**: PR 머지 직후 작업 마지막 단계에서 진행 (Task #21). branch 정리도 함께
- **아이콘/스플래시 에셋 교체 후 반드시 `npx expo prebuild --clean`** — icon.png, adaptive-icon.png 등 변경 시 "prebuild 안 해도 된다"는 틀린 조언. 양 플랫폼 모두 prebuild 필요
- **Android adaptive-icon.png에 흰 배경 금지** — 풀 사이즈 로고+흰 배경이면 OS 마스크 후 아이콘 전체를 덮어버림. 투명 배경 + 40% 캔버스 크기 권장
- **`expo-splash-screen` imageWidth 설정은 양 플랫폼 공통** — iOS만 줄이려고 설정하면 Android도 같이 줄어듦. 플랫폼별 분리는 `ios.splash`/`android.splash` 사용
- **`npx expo run:ios --device` 설치 실패 시 xcodebuild + xcrun devicectl 대안** — `LockdowndClient TypeError: Cannot convert object to primitive value` 에러 발생 시 `xcodebuild -workspace ... -scheme ... -destination 'id=...'` 빌드 + `xcrun devicectl device install app --device ... --path ...` 설치로 우회
- **dev=prod 결정 시 파괴적 스크립트(dev-wipe.sql 등) 즉시 삭제** — project-ref 가드가 이제 prod를 가리켜 실행하면 prod 와이프. "단순 잔재 정리"가 아니라 "dev→prod 하드닝 게이트"로 인식 필요
- **Supabase Free tier project limit은 owner 계정 기준** — `seomsoo (Limit: 2 free projects)` — 같은 계정이 owner/admin인 모든 org를 합쳐 활성 2개. 새 free org 만들어도 동일 카운트. 회피책: 다른 사람 owner의 org에 collaborator(그레이존), Pro upgrade, 또는 dev=prod 통합(ADR-075)
- **WebView 앱에서 custom domain은 사용자 가시성 작아 ROI 낮음** — 도메인은 약관 페이지 클릭/Play Console privacy URL/면접관 GitHub README 등 부수 시점에만 노출. 마케팅·SEO 본격화 또는 10-4 폐쇄 테스트 시점에 검토
- **EAS Environment variables Visibility = `Secret`은 `EXPO_PUBLIC_*`에 부적합** — `Secret`은 빌드 worker만 접근, client bundle에 inline 안 됨 → `process.env`로 못 읽음. publishable·URL 같은 `EXPO_PUBLIC_*`는 `Plain text` 또는 `Sensitive`만
- **GitHub Actions의 `workflow_dispatch`는 default branch에 workflow 파일 필수** — feature branch에만 있으면 404. PR 머지 후 트리거 또는 default branch에 일부 cherry-pick 필요
- **expo-image-picker `quality: 1`은 "최고 화질=압축 최소"라 파일이 오히려 큼** (12MP JPEG ~3-5MB, base64는 JPEG 데이터). 작게 하려면 quality를 낮추거나(압축) expo-image-manipulator로 리사이즈. 증거 사진도 무압축은 무료 티어 1GB를 ~8명에 소진 → 6단계처럼 리사이즈+압축 필수 (ADR-083)
- **사진 압축 시 EXIF "깨짐"은 파일 내 EXIF 블록 strip을 의미** — 촬영일시(taken_at)를 압축 전 picker EXIF에서 추출해 DB 보존하면 증거력 핵심 유지(6단계 동일). 압축 = 증거력 전면 포기 아님
- **원본+압축썸네일 병행 / Supabase 이미지 변환은 스토리지 절감에 역효과** — "원본을 그대로 저장"해 정작 저장 용량을 못 줄임(변환은 대역폭만 + Pro 전용). 무료 티어 저장 목표엔 부적합
- **expo-image-manipulator `manipulateAsync`는 deprecated** (★ 경고) — 신규 컨텍스트 API `ImageManipulator.manipulate().resize().renderAsync().saveAsync()` 사용. deprecation은 lint/typecheck를 깨진 않으나 신규 API가 깔끔
- **Expo 패키지는 SDK 55에서 통합 버전(55.0.x)** — `pnpm --filter @moving/mobile exec expo install <pkg>`로 SDK 호환 버전 자동 선택 (추측 버전 수기 입력 금지)
- **supabase/functions/\*\*(Deno)는 ESLint/tsc 대상 외** (apps/web·mobile·packages/shared만) — IDE의 "Cannot find name 'Deno'/Cannot find module 'npm:'·'https:'" 진단은 false positive. 실검증은 deno check 또는 supabase functions deploy
- **기존 파일을 cat(Bash)으로만 봤으면 Edit 전 Read 도구로 다시 읽어야 함** — Edit는 conversation 내 Read 이력 필수 (routes.ts 편집 시 1회 실패)
