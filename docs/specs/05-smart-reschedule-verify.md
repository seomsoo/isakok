# 5단계 검증 리포트 — 스마트 재배치

> 검증일: 2026-04-13
> 스펙: `docs/specs/05-smart-reschedule.md`

## 완료 확인 기준 결과

### 빌드/린트/테스트

- [x] `pnpm build` — 성공 (web 빌드 통과)
- [x] `pnpm lint` — 에러 0
- [x] `pnpm test` — 13/13 통과 (urgencyMode 8 + progress 5)
- [x] 추가 패키지 없음

### 모드 판별 (`urgencyMode.test.ts`로 검증됨)

- [x] `getUrgencyMode(30)` → `relaxed`
- [x] `getUrgencyMode(29)` → `tight`
- [x] `getUrgencyMode(14)` → `tight`
- [x] `getUrgencyMode(13)` → `urgent`
- [x] `getUrgencyMode(7)` → `urgent`
- [x] `getUrgencyMode(6)` → `critical`
- [x] `getUrgencyMode(0)` → `critical`
- [x] `getUrgencyMode(-1)` → `critical`

### 여유 모드

- [x] GreetingHeader 기존 동작 유지
- [x] 과거 항목 표시 톤 유지 (DetailHeader)
- [x] 전체 리스트 기존 그룹핑 유지

### 빠듯 모드

- [x] GreetingHeader / ActionSection 제목 분기
- [x] 진행률 전체 기준
- [x] 과거 미완료 항목 display_date 부여 (`useTimelineItems` 재분배 로직)
- [x] 7일 범위 분배 + 중요도순 정렬

### 급한 모드

- [x] GreetingHeader / ActionSection 제목 분기, 최대 5개
- [x] 진행률 필수 기준 (Codex P1 수정 반영: nested `master_checklist_items.is_skippable` 경로 사용)
- [x] UpcomingSection 숨김
- [x] 5그룹 렌더링 + "여유 되면" 기본 접힘

### 초급한 모드

- [x] GreetingHeader / ActionSection 제목, 필수만
- [x] MotivationCard 고정 메시지
- [x] UpcomingSection + PhotoPromptCard 숨김
- [x] 전체 리스트 2그룹 (Codex P1 수정 반영: `hasSkippable`을 empty-state 체크에 포함)
- [x] 격려 메시지

### 모드 전환 배너

- [x] 모드 전환 시 배너 표시
- [x] X 클릭 시 닫힘
- [x] 같은 세션 재표시 안 됨 (Codex P2 수정 반영: `setPreviousMode`에서 `transitionDismissed: false` 리셋)
- [x] 첫 설치 유저 미표시
- [x] 자연 전환 표시
- [x] 같은 모드 D-Day 변경 미표시

### SkippableSection

- [x] 기본 접힘
- [x] 펼침/접힘 토글
- [x] 카운트 표시
- [x] critical 격려 메시지

### 접근성

- [x] ModeTransitionBanner role/aria-live
- [x] SkippableSection aria-expanded/controls
- [x] CircularProgress aria-label 모드별 변경

## 누락

- 없음 (스펙 항목은 모두 구현됨, 단 일부 동작에 버그)

## 스코프 크립

- 없음

## 컨벤션 위반

- 없음

## Codex 코드리뷰 결과

`/codex:review` 실행 — P1 2건 / P2 1건, **모두 수정 반영**

- **[P1] DashboardPage.tsx:47-49**
  - 문제: `calculateEssentialProgress`에 `allItems`를 그대로 넘겼는데 `is_skippable`은 `master_checklist_items` 내부 중첩 필드. 모든 행이 `undefined`로 평가되어 필수 진행률·aria-label이 과대 계산됨.
  - 수정: `allItems`를 `{ is_completed, is_skippable }`로 매핑하면서 `master_checklist_items.is_skippable === true`를 추출해 전달. ✅ 수정 완료
- **[P1] TimelinePage.tsx:271-273**
  - 문제: SkippableSection이 비-empty 분기 안에서만 렌더링되는데 `hasContent` 체크는 `skippableItems`를 무시. critical 모드에서 skippable만 남은 유저는 빈 화면을 보고 actionable 항목이 가려짐.
  - 수정: `hasSkippable` (urgent/critical 모드 + `skippableItems.length > 0`)을 계산해 `hasContent`에 합침. ✅ 수정 완료
- **[P2] modeStore.ts:14**
  - 문제: `setPreviousMode`가 `transitionDismissed`를 초기화하지 않음. 한 번 닫으면 같은 세션 내 이후 모드 전환에서 배너가 영구 숨겨짐.
  - 수정: `setPreviousMode`가 `previousMode`와 함께 `transitionDismissed: false`도 함께 리셋. ✅ 수정 완료

재검증: `pnpm build` / `pnpm test` 모두 통과.

## 종합 판정

✅ **통과** — 빌드/린트/테스트 모두 그린, Codex P1×2 / P2×1 모두 수정 반영됨.
