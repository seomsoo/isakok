# 5단계: 스마트 재배치 (4모드) 스펙 (SDD)

> 목표: 이사일까지 남은 기간에 따라 체크리스트를 자동으로 재배치하고, 시간 압박에 비례해 UI를 전환하여 유저가 압도당하지 않도록 돕는다
> 이 단계가 끝나면: D-30+, D-14~29, D-7~13, D-1~6 각 상황에서 최적화된 대시보드/전체 리스트/상세페이지가 동작하는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 긴급도 모드 판별 함수 (`getUrgencyMode`)
- 4모드별 대시보드 UI 분기 (인사문구, 섹션 제목, 진행률 기준)
- 4모드별 전체 리스트 그룹핑 변경
- 4모드별 상세페이지 날짜 텍스트 교체 (3~4단계 "오늘" 임시 처리 → 모드별 적절한 표현)
- 빠듯 모드: 과거 미완료 항목의 표시용 날짜를 중요도순으로 남은 날에 자동 분배
- 초급한 모드: 선택 항목(is_skippable=true) "여유 되면" 접힘 UI
- 모드 전환 안내 배너 (이사일 변경 시 원타임 표시)
- 진행률 함수 확장 (급한/초급한 → 필수 기준)
- 모드별 텍스트 상수 파일

### 안 하는 것

- DB 변경 없음 — 전부 프론트엔드 표시 레이어에서 처리
- assigned_date(DB)는 원래 값 유지, 표시용 날짜만 프론트에서 오버라이드
- 집 상태 기록 UI (6단계)
- AI 맞춤 가이드 (7단계)
- 인증/비회원 분기 (8단계)
- 네이티브 탭바 (9단계)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
packages/shared/src/
├── utils/
│   ├── urgencyMode.ts                    ← 생성 (모드 판별 + 날짜 재분배 로직)
│   ├── progress.ts                       ← 수정 (필수 기준 진행률 추가)
│   └── dateLabel.ts                      ← 수정 (모드별 날짜 표시 분기)
└── constants/
    └── urgencyText.ts                    ← 생성 (모드별 UI 텍스트 상수)

apps/web/src/
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── GreetingHeader.tsx         ← 수정 (모드별 인사문구 분기)
│   │   │   ├── ActionSection.tsx          ← 수정 (모드별 섹션 제목 + 정렬 변경)
│   │   │   ├── DdayCard.tsx              ← 수정 (모드별 진행률 기준 전환)
│   │   │   ├── MotivationCard.tsx        ← 수정 (초급한 모드 격려 메시지)
│   │   │   ├── UpcomingSection.tsx        ← 수정 (급한/초급한에서 숨김)
│   │   │   └── ModeTransitionBanner.tsx   ← 생성 (모드 전환 안내 배너)
│   │   └── hooks/
│   │       ├── useTodayItems.ts          ← 수정 (모드별 항목 분류 로직)
│   │       └── useUrgencyMode.ts         ← 생성 (모드 판별 + 이전 모드 기억)
│   │
│   ├── timeline/
│   │   ├── components/
│   │   │   ├── PeriodSection.tsx          ← 수정 (모드별 그룹핑 전환)
│   │   │   └── SkippableSection.tsx       ← 생성 (초급한 "여유 되면" 접힘 섹션)
│   │   └── hooks/
│   │       └── useTimelineItems.ts       ← 수정 (모드별 그룹핑 로직)
│   │
│   └── checklist-detail/
│       └── components/
│           └── DetailHeader.tsx           ← 수정 (모드별 날짜 텍스트 교체)
│
└── stores/
    └── modeStore.ts                      ← 생성 (이전 모드 기억, 전환 배너 dismiss 상태)
```

---

## 2. 패키지 설치

```bash
# 이 단계에서 추가 패키지 없음 — 기존 date-fns로 충분
```

---

## 3. 핵심 유틸리티 (packages/shared)

### 3-1. 긴급도 모드 판별

```typescript
// packages/shared/src/utils/urgencyMode.ts

/**
 * 이사일까지 남은 일수에 따라 긴급도 모드를 반환
 *
 * 설계 근거:
 * - 마스터 체크리스트가 D-30~D+7 기준으로 설계됨
 * - 30일+ 여유가 있으면 기존 날짜 그대로 표시 (여유 모드)
 * - 14~29일이면 과거 항목만 재분배 (빠듯 모드)
 * - 7~13일이면 날짜 자체를 없애고 긴급도 그룹으로 전환 (급한 모드)
 * - 1~6일이면 필수만 강조하고 나머지 접힘 (초급한 모드)
 *
 * UX 참고:
 * - Things 3: 밀린 항목에 죄책감 안 주는 부드러운 톤
 * - Todoist Smart Schedule: 밀린 항목을 남은 날에 자동 분배
 * - 이사앱 고유: 절대 데드라인(이사일) 기반 모드 자동 전환
 */
export type UrgencyMode = 'relaxed' | 'tight' | 'urgent' | 'critical'

export function getUrgencyMode(daysUntilMove: number): UrgencyMode {
  if (daysUntilMove >= 30) return 'relaxed'
  if (daysUntilMove >= 14) return 'tight'
  if (daysUntilMove >= 7) return 'urgent'
  return 'critical' // 1~6일, 0일(당일), 음수(이사 후)도 포함
}
```

> **왜 이사 후(음수)도 critical인가?**: 이사 후에도 전입신고, 도어락 변경 등 해야 할 항목이 남아있음.
> 이사 후 항목은 d_day_offset > 0이라 assigned_date가 미래이므로 "밀린 할 일"이 아님.
> 단, 이사 후 1주일이 지나면 전부 과거가 되므로 critical 모드가 적절.

### 3-2. 표시용 날짜 재분배 (빠듯 모드 전용)

```typescript
// packages/shared/src/utils/urgencyMode.ts (계속)

interface ChecklistItemForReschedule {
  id: string
  assigned_date: string // YYYY-MM-DD (DB 원본)
  is_completed: boolean
  guide_type: 'critical' | 'warning' | 'tip'
}

interface RescheduledItem {
  id: string
  display_date: string // 오버라이드된 표시용 날짜 YYYY-MM-DD
}

/**
 * 빠듯 모드에서 과거 미완료 항목의 표시용 날짜를 재분배
 *
 * 알고리즘:
 * 1. 과거 미완료 항목만 필터링
 * 2. 중요도순 정렬 (critical → warning → tip, 같은 중요도 내에서 assigned_date 오름차순)
 * 3. 오늘 ~ min(D-Day, 오늘+7일) 범위에 균등 분배
 * 4. 하루에 배치되는 개수가 자연스럽게 결정됨 (강제 cap 없음)
 *
 * 예시: 과거 미완료 8개, 남은 날 20일 → 오늘~7일 범위(7일)에 분배 → 하루 약 1.1개
 * 예시: 과거 미완료 15개, 남은 날 14일 → 오늘~7일 범위(7일)에 분배 → 하루 약 2.1개
 *
 * 왜 D-Day까지가 아니라 7일인가?
 * - 14~29일 남은 유저에게 2~3주 뒤 항목을 보여주면 "지금 안 해도 되네" 심리 유발
 * - 7일 내로 보여줘야 행동 유도 효과가 있음
 * - 이미 미래에 배치된 항목(이번 주~이사 주)은 건드리지 않으므로 겹침 없음
 */
export function rescheduleOverdueItems(
  items: ChecklistItemForReschedule[],
  today: string, // YYYY-MM-DD
  movingDate: string, // YYYY-MM-DD
): RescheduledItem[] {
  // 1. 과거 미완료만 필터
  const overdueItems = items.filter((item) => !item.is_completed && item.assigned_date < today)

  if (overdueItems.length === 0) return []

  // 2. 중요도순 정렬
  const priorityOrder = { critical: 0, warning: 1, tip: 2 }
  const sorted = [...overdueItems].sort((a, b) => {
    const pDiff = priorityOrder[a.guide_type] - priorityOrder[b.guide_type]
    if (pDiff !== 0) return pDiff
    return a.assigned_date.localeCompare(b.assigned_date)
  })

  // 3. 분배 범위: 오늘 ~ min(movingDate, today+7일)
  //    addDays, differenceInCalendarDays는 date-fns 사용
  //    실제 구현 시 parseLocalDate 사용 필수 (UTC 파싱 버그 방지)
  const maxSpreadDays = Math.min(
    differenceInCalendarDays(parseLocalDate(movingDate), parseLocalDate(today)),
    7,
  )
  const spreadDays = Math.max(maxSpreadDays, 1) // 최소 1일

  // 4. 균등 분배
  return sorted.map((item, index) => ({
    id: item.id,
    display_date: format(addDays(parseLocalDate(today), index % spreadDays), 'yyyy-MM-dd'),
  }))
}
```

> **왜 하루 최대 cap을 안 두나?**: 빠듯 모드의 남은 날이 최소 14일, 체크리스트 총 25~30개에서
> 과거 미완료는 현실적으로 최대 15개 정도. 7일에 분배하면 하루 2~3개로 자연 수렴.
> 인위적인 cap을 추가하면 넘치는 항목의 처리 로직이 필요해지고, 엣지케이스만 늘어남.

### 3-3. 진행률 함수 확장

```typescript
// packages/shared/src/utils/progress.ts (수정)

/**
 * 기존 calculateProgress — 전체 기준 (여유/빠듯 모드용)
 * 3단계에서 만든 함수 그대로 유지
 */
export function calculateProgress(items: { is_completed: boolean }[]) {
  const total = items.length
  const completed = items.filter((item) => item.is_completed).length
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}

/**
 * 필수 기준 진행률 (급한/초급한 모드용)
 * is_skippable=false 항목만 카운트
 *
 * 왜 분리하나?
 * - 급한/초급한 모드에서 "12/22 완료"라고 보여주면 숫자가 압도적
 * - "필수 2/5 완료"라고 보여주면 "5개만 하면 된다"는 심리 효과
 * - Things 3 패턴: 죄책감 대신 달성 가능한 목표를 제시
 */
export function calculateEssentialProgress(
  items: { is_completed: boolean; is_skippable: boolean }[],
) {
  const essentials = items.filter((item) => !item.is_skippable)
  const total = essentials.length
  const completed = essentials.filter((item) => item.is_completed).length
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}
```

### 3-4. 모드별 UI 텍스트 상수

```typescript
// packages/shared/src/constants/urgencyText.ts

import type { UrgencyMode } from '../utils/urgencyMode'

/**
 * 모드별 UI 텍스트를 한 파일에서 관리
 * 기획자/디자이너가 텍스트를 바꾸고 싶을 때 이 파일 하나만 수정
 */

/** 대시보드 GreetingHeader */
export const GREETING_TEXT: Record<UrgencyMode, string> = {
  relaxed: '여유 있게 준비해요',
  tight: '하나씩 챙겨볼까요',
  urgent: '이사가 곧이에요!',
  critical: '이사가 코앞이에요!',
}

/** 대시보드 ActionSection 제목 */
export const ACTION_SECTION_TITLE: Record<UrgencyMode, string> = {
  relaxed: '지금 해두면 편해요',
  tight: '먼저 챙기면 좋은 것',
  urgent: '지금 바로 해야 해요',
  critical: '꼭 해야 할 것',
}

/** 대시보드 진행률 포맷 */
export const PROGRESS_LABEL: Record<UrgencyMode, (completed: number, total: number) => string> = {
  relaxed: (c, t) => `${c}/${t} 완료`,
  tight: (c, t) => `${c}/${t} 완료`,
  urgent: (c, t) => `필수 ${c}/${t} 완료`,
  critical: (c, t) => `필수 ${c}/${t} 완료`,
}

/** 초급한 모드 격려 메시지 */
export const CRITICAL_ENCOURAGEMENT = '다 못해도 괜찮아요. 필수만 챙기세요.'

/** 전체 리스트 그룹명 (급한/초급한 모드) */
export const URGENCY_GROUP_LABELS = {
  now: '지금 바로',
  thisWeek: '이번 주',
  movingDay: '이사 전날·당일',
  afterMove: '이사 후',
  canSkip: '여유 되면',
} as const

/** 모드 전환 배너 메시지 */
export const MODE_TRANSITION_MESSAGE: Record<string, string> = {
  'relaxed→tight': '이사일이 가까워졌어요. 남은 할 일을 다시 배치했어요.',
  'relaxed→urgent': '이사가 곧이에요! 중요한 것부터 보여드릴게요.',
  'relaxed→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
  'tight→urgent': '이사가 곧이에요! 중요한 것부터 보여드릴게요.',
  'tight→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
  'urgent→critical': '이사가 코앞이에요! 꼭 해야 할 것만 모아뒀어요.',
}
```

### 3-5. 날짜 표시 함수 수정

```typescript
// packages/shared/src/utils/dateLabel.ts (수정)

/**
 * 3~4단계에서는 과거 항목을 "오늘"로 임시 처리했음.
 * 5단계에서 모드별 분기 추가:
 *
 * - relaxed: 기존 그대로 (assigned_date 기준 표시)
 * - tight: display_date 사용 (재분배된 날짜)
 * - urgent/critical: 날짜 대신 그룹명으로 대체 (상세에서만 날짜 표시)
 */
export function getRelativeDateLabel(
  assignedDate: string,
  movingDate: string,
  mode: UrgencyMode,
  displayDate?: string, // 빠듯 모드에서 오버라이드된 날짜
): string {
  const effectiveDate = mode === 'tight' && displayDate ? displayDate : assignedDate
  const today = format(new Date(), 'yyyy-MM-dd')

  // 급한/초급한 모드에서는 전체 리스트에서 그룹명이 날짜를 대체하므로
  // 상세페이지에서만 이 함수가 호출됨 → 원래 assigned_date 기준으로 표시
  if (mode === 'urgent' || mode === 'critical') {
    if (effectiveDate < today) return '지금 해도 괜찮아요'
    // 나머지는 기존 로직 유지
  }

  // 기존 3~4단계 로직 (여유/빠듯 공통)
  if (effectiveDate < today) {
    // 빠듯 모드에서는 display_date가 오늘 이후이므로 여기 안 옴
    // 여유 모드에서 과거 항목은 이제 "밀린 할 일" 대신 부드러운 표현
    return '지금 해도 괜찮아요'
  }
  if (effectiveDate === today) return '오늘'
  // ... (내일, 이번 주, 이사 전날, 이사 당일, 이사 후 — 기존 로직 유지)
}
```

> **3단계 "오늘" 임시 처리 제거**: `assigned_date < today`일 때 "오늘"로 표시하던 것을
> "지금 해도 괜찮아요"로 교체. Things 3 패턴 반영 — 죄책감 없는 부드러운 표현.

---

## 4. Zustand 스토어

### stores/modeStore.ts

```typescript
interface ModeStore {
  /** 이전 모드 (모드 전환 감지용) */
  previousMode: UrgencyMode | null
  setPreviousMode: (mode: UrgencyMode) => void

  /** 모드 전환 배너 닫힘 상태 */
  transitionDismissed: boolean
  dismissTransition: () => void
  resetTransition: () => void
}
```

- `previousMode`: 대시보드 진입 시 현재 모드와 비교하여 전환 여부 판별
- `transitionDismissed`: X 버튼 클릭 시 true → 배너 숨김
- `resetTransition()`: 이사일 변경(설정) 시 호출 → 다시 보여줄 수 있게

> **왜 persist 안 하나?**: 배너는 세션 단위로 관리하면 충분.
> 새로고침 후 다시 보여도 1줄 배너라 부담 없고, 모드가 바뀌지 않았으면 어차피 안 뜸.

---

## 5. 커스텀 훅

### 5-1. useUrgencyMode

```typescript
// features/dashboard/hooks/useUrgencyMode.ts

/**
 * 현재 모드 판별 + 모드 전환 감지
 * @param movingDate - YYYY-MM-DD
 * @returns { mode, isTransitioned, transitionMessage }
 */
export function useUrgencyMode(movingDate: string) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const daysUntilMove = differenceInCalendarDays(parseLocalDate(movingDate), parseLocalDate(today))
  const mode = getUrgencyMode(daysUntilMove)

  const { previousMode, setPreviousMode, transitionDismissed } = useModeStore()

  // 모드 전환 감지
  const isTransitioned = previousMode !== null && previousMode !== mode && !transitionDismissed

  const transitionKey = previousMode ? `${previousMode}→${mode}` : null
  const transitionMessage = transitionKey ? (MODE_TRANSITION_MESSAGE[transitionKey] ?? null) : null

  // 현재 모드를 저장 (다음 비교용)
  useEffect(() => {
    if (previousMode !== mode) {
      setPreviousMode(mode)
    }
  }, [mode])

  return { mode, daysUntilMove, isTransitioned, transitionMessage }
}
```

### 5-2. useTodayItems 수정

```typescript
// features/dashboard/hooks/useTodayItems.ts (수정)

/**
 * 기존: overdue + today + upcoming을 분리 반환
 * 수정: mode에 따라 항목 분류 방식 변경
 *
 * - relaxed: 기존 그대로
 * - tight: 과거 항목에 display_date 부여 후 날짜 기준 재정렬
 * - urgent: "지금 바로"(과거+오늘 critical/warning) + "이번 주" 분리
 * - critical: "꼭 해야 할 것"(is_skippable=false) + "여유 되면" 분리
 */
```

> 구체적인 코드는 기존 useTodayItems의 반환 구조를 유지하되,
> mode 파라미터를 받아 내부 분류 로직만 분기.
> 기존 사용처(DashboardPage)에서는 mode를 전달하면 됨.

### 5-3. useTimelineItems 수정

```typescript
// features/timeline/hooks/useTimelineItems.ts (수정)

/**
 * 기존: "이번 주 / 다음 주 / N주 후 / 이사 주 / 이사 후" 상대시간 그룹핑
 * 수정: mode에 따라 그룹핑 방식 변경
 *
 * - relaxed: 기존 그대로 (주 단위 상대시간)
 * - tight: 기존 + 과거 항목에 display_date 반영 (재분배된 날짜로 그룹 이동)
 * - urgent: "지금 바로 / 이번 주 / 이사 전날·당일 / 이사 후 / 여유 되면" 5그룹
 * - critical: "꼭 해야 할 것 / 여유 되면" 2그룹
 */
```

---

## 6. 모드별 UI 상세

### 6-1. 여유 모드 (relaxed, D-30+)

**변경 없음** — 3~4단계에서 구현한 그대로 동작.

- 대시보드: "여유 있게 준비해요" + 전체 기준 진행률
- 전체 리스트: 이번 주 / 다음 주 / 이사 주 / 이사 후
- 상세: 기존 날짜 표시

> 유일한 변경: 과거 항목 표시가 "오늘" → "지금 해도 괜찮아요"로 교체.

### 6-2. 빠듯 모드 (tight, D-14~29)

**핵심 변경: 과거 미완료 항목의 표시용 날짜 재분배**

대시보드:

```
┌──────────────────────────────┐
│ 하나씩 챙겨볼까요             │  ← GreetingHeader (변경)
│ 새 집으로 이사까지            │
│                              │
│ ┌──────────────────────────┐ │
│ │ D-18        12/22 완료   │ │  ← DdayCard (전체 기준 진행률 유지)
│ └──────────────────────────┘ │
│                              │
│ ── 먼저 챙기면 좋은 것 ── 5 ─ │  ← ActionSection 제목 (변경)
│                              │
│ ○ 이사업체 견적 비교    필수  │  ← 중요도순 정렬 유지
│ ○ 관리비 정산 확인      주의  │
│ ○ 인터넷 이전 신청            │
└──────────────────────────────┘
```

전체 리스트:

- 그룹핑은 여유 모드와 동일 (이번 주 / 다음 주 / ...)
- **차이점**: 과거 미완료 항목이 "이번 주" 그룹에 재분배된 display_date로 삽입
- 날짜 표시도 display_date 기준 ("오늘", "내일", "4월 10일 (목)" 등)

상세:

- 재분배된 display_date 기준으로 D-day 칩 + 날짜 텍스트 표시
- 원본 assigned_date와 다를 수 있지만, 유저에게는 자연스러움

### 6-3. 급한 모드 (urgent, D-7~13)

**핵심 변경: 날짜 기반 그룹 → 긴급도 기반 그룹으로 전환**

대시보드:

```
┌──────────────────────────────┐
│ 이사가 곧이에요!              │  ← GreetingHeader (변경)
│ 새 집으로 이사까지            │
│                              │
│ ┌──────────────────────────┐ │
│ │ D-9      필수 2/5 완료   │ │  ← DdayCard (필수 기준 진행률)
│ └──────────────────────────┘ │
│                              │
│ ── 지금 바로 해야 해요 ── 3 ─ │  ← ActionSection 제목 (변경)
│                              │
│ ○ 전입신고 서류 준비    필수  │
│ ○ 관리비 정산 확인      주의  │
│ ○ 가스 안전점검 신청    주의  │
└──────────────────────────────┘
```

- **UpcomingSection 숨김** — 급한 모드에서 "다가오는 일정"은 인지 부하만 추가
- ActionSection에 더 많은 항목 표시 (최대 5개로 확장)

전체 리스트 (그룹 전환):

```
┌──────────────────────────────┐
│ ── 지금 바로 ──────── 8 ──── │  ← 과거 미완료 + 오늘 항목 (critical/warning 우선)
│                              │
│ ○ 전입신고 서류 준비    필수  │
│ ○ 관리비 정산 확인      주의  │
│ ○ 이사업체 견적 비교    필수  │
│ ○ ...                        │
│                              │
│ ════════════════════════════ │
│                              │
│ ── 이번 주 ──────── 4 ────── │  ← 오늘 이후 ~ 이사 전날 전
│                              │
│ ○ 인터넷 이전 신청            │
│ ○ 우체국 주소변경             │
│ ○ ...                        │
│                              │
│ ════════════════════════════ │
│                              │
│ ── 이사 전날·당일 ──── 6 ─── │  ← d_day_offset -1, 0
│                              │
│ ○ 냉장고 비우기        주의  │
│ ○ 짐 최종 확인               │
│ ○ ...                        │
│                              │
│ ════════════════════════════ │
│                              │
│ ── 이사 후 ──────── 5 ────── │  ← d_day_offset > 0
│                              │
│ ○ 전입신고                   │
│ ○ ...                        │
│                              │
│ ════════════════════════════ │
│                              │
│ ▼ 여유 되면            4     │  ← 접힘 (is_skippable=true + tip)
│                              │
│ ┌──────────────────────────┐ │
│ │ ✓ 완료               3개 >│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

**"지금 바로" 그룹 정렬 규칙:**

1. guide_type 우선순위 (critical=0, warning=1, tip=2)
2. 같은 우선순위 내에서 assigned_date 오름차순

**"여유 되면" 그룹 기준:**

- `is_skippable === true` AND `guide_type === 'tip'`인 항목
- 기본 접힘 상태
- 접힘 바: "▼ 여유 되면 · 4" (탭하면 펼침)

### 6-4. 초급한 모드 (critical, D-1~6)

**핵심 변경: 필수만 강조, 나머지 최소화**

대시보드:

```
┌──────────────────────────────┐
│ 이사가 코앞이에요!            │  ← GreetingHeader (변경)
│ 새 집으로 이사까지            │
│                              │
│ ┌──────────────────────────┐ │
│ │ D-3      필수 2/5 완료   │ │  ← DdayCard (필수 기준)
│ └──────────────────────────┘ │
│                              │
│ 💛 다 못해도 괜찮아요.        │  ← MotivationCard (격려 고정)
│    필수만 챙기세요.           │
│                              │
│ ── 꼭 해야 할 것 ──── 3 ──── │  ← ActionSection (필수만)
│                              │
│ ○ 전입신고 서류 준비    필수  │
│ ○ 관리비 정산 확인      필수  │
│ ○ 이사업체 최종 확인    필수  │
└──────────────────────────────┘
```

- **UpcomingSection 숨김**
- **PhotoPromptCard 숨김** — 이사 코앞에 사진 촬영 유도는 부적절
- MotivationCard: 진행률 기반 동적 메시지 대신 **격려 고정 메시지**
- ActionSection: `is_skippable=false` 항목만 표시

전체 리스트:

```
┌──────────────────────────────┐
│ ── 꼭 해야 할 것 ──── 5 ──── │  ← is_skippable=false만
│                              │
│ ○ 전입신고 서류 준비    필수  │
│ ○ 관리비 정산 확인      필수  │
│ ○ 이사업체 최종 확인    필수  │
│ ○ 냉장고 비우기        필수  │
│ ○ 짐 최종 확인         필수  │
│                              │
│ ════════════════════════════ │
│                              │
│ ▼ 여유 되면           18     │  ← 접힘 (is_skippable=true 전부)
│                              │
│ ┌──────────────────────────┐ │
│ │ ✓ 완료               3개 >│ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

- "여유 되면" 그룹에 `is_skippable=true` **전부** 포함 (급한 모드보다 범위 확대)
- 기본 접힘 + 접힘 바 하단에 격려 메시지: "다 못해도 이사에 큰 문제 없어요"

---

## 7. ModeTransitionBanner 컴포넌트

### 7-1. 동작 조건

배너가 표시되는 조건:

1. 이사일이 변경되어 모드가 바뀜 (설정 > 이사 정보 수정 후)
2. 날짜가 지나 자연스럽게 모드가 전환됨 (D-30 → D-29 = relaxed → tight)
3. `transitionDismissed`가 false

배너가 표시되지 않는 조건:

- 첫 설치 유저 (previousMode가 null)
- 같은 모드 내에서 D-Day만 바뀜 (모드 전환 없음)
- 이미 X 버튼으로 닫음

### 7-2. 디자인

```
┌────────────────────────────────────┐
│ 💡 이사일이 가까워졌어요.           × │
│    남은 할 일을 다시 배치했어요.       │
└────────────────────────────────────┘
```

- 위치: DdayCard 바로 위 (GreetingHeader 아래)
- 배경: `bg-tertiary` (민트)
- 좌측: Lightbulb 아이콘 (primary, 16px)
- 우측: X 버튼 (muted, 16px) → `dismissTransition()` 호출
- 텍스트: body-sm, secondary
- 라운드: rounded-xl
- 패딩: px-4 py-3
- 진입 애니메이션: 없음 (심플하게)

### 7-3. 자연 전환 시 타이밍

날짜가 지나면서 모드가 바뀌는 경우(예: 어제까지 D-30이었는데 오늘 D-29):

- `useUrgencyMode`가 대시보드 렌더링 시 매번 현재 모드를 계산
- `previousMode`와 다르면 `isTransitioned = true`
- 배너 표시 → 유저가 닫으면 `dismissTransition()`
- 다음 날 또 모드가 바뀌면? → `setPreviousMode`가 이미 업데이트되어 있으므로, tight→urgent 같은 전환만 새로 감지

> **왜 매일 뜨지 않나?**: D-29(tight)에서 배너를 보고 닫으면, D-28~D-14까지는 같은 tight 모드이므로 안 뜸.
> D-13(urgent)이 되어야 다시 배너가 뜸. 모드 전환은 최대 3번(relaxed→tight→urgent→critical).

---

## 8. SkippableSection 컴포넌트

### 급한/초급한 모드에서 "여유 되면" 그룹

```typescript
interface SkippableSectionProps {
  items: ChecklistItem[]
  mode: 'urgent' | 'critical'
  onToggle: (id: string, isCompleted: boolean) => void
}
```

**레이아웃:**

```
┌──────────────────────────────────┐
│ ▼ 여유 되면                  4   │  ← 접힘 바 (탭하면 토글)
├──────────────────────────────────┤
│                                  │  ← 펼치면:
│ ○ 택배 주소변경                  │
│ ○ 정수기 필터 교체               │
│ ○ 비상약 챙기기                  │
│ ○ 식물 이동 준비                 │
│                                  │
│ 다 못해도 이사에 큰 문제 없어요   │  ← critical 모드에서만 표시
└──────────────────────────────────┘
```

- 접힘 바: `bg-background-tertiary rounded-xl px-4 py-3`
- 화살표: `ChevronDown` (펼침 시 `ChevronUp`으로 전환)
- 라벨: "여유 되면" + 카운트 pill
- 카운트 pill: `bg-border rounded-full px-2 text-caption text-muted`
- 기본 상태: **접힘**
- 격려 메시지 (critical 모드): `text-body-sm text-muted px-4 py-2`, 좌측 정렬
- 항목 스타일: 일반 ChecklistItem과 동일 (뱃지 없음)

---

## 9. 기존 컴포넌트 수정 상세

### 9-1. GreetingHeader

- `mode` prop 추가
- `GREETING_TEXT[mode]`에서 인사문구 가져옴
- 서브텍스트 "새 집으로 이사까지"는 모드 무관 고정

### 9-2. DdayCard

- `mode` prop 추가
- 여유/빠듯: `calculateProgress()` (전체 기준)
- 급한/초급한: `calculateEssentialProgress()` (필수 기준)
- 진행률 라벨: `PROGRESS_LABEL[mode](completed, total)`

### 9-3. ActionSection

- `mode` prop 추가
- 제목: `ACTION_SECTION_TITLE[mode]`
- 급한/초급한: 최대 표시 개수 3 → 5로 확장
- 초급한: `is_skippable=false` 항목만 필터링

### 9-4. MotivationCard

- `mode` prop 추가
- 초급한: 진행률 기반 동적 메시지 대신 `CRITICAL_ENCOURAGEMENT` 고정 표시
- 나머지 모드: 기존 진행률 기반 동적 메시지 유지

### 9-5. UpcomingSection

- `mode` prop 추가
- 급한/초급한: `return null` (렌더링하지 않음)
- 여유/빠듯: 기존 동작 유지

### 9-6. PhotoPromptCard

- `mode` prop 추가
- 초급한: `return null` (렌더링하지 않음)
- 나머지: 기존 동작 유지

### 9-7. DetailHeader

- `mode` prop 추가
- 기존 "과거 항목 → 지금 해도 괜찮아요" 임시 처리 유지 (이미 Things 3 패턴)
- 빠듯 모드: display_date 기반으로 D-day 칩 계산
- 급한/초급한: D-day 칩 숨김 (과거 항목), 날짜 텍스트는 원본 assigned_date 기준

### 9-8. PeriodSection

- `mode` prop 추가
- 여유/빠듯: 기존 그룹 라벨 유지
- 급한/초급한: `URGENCY_GROUP_LABELS`에서 그룹 라벨 가져옴

---

## 10. 데이터 흐름 (모드별)

### 빠듯 모드 — 표시용 날짜 오버라이드 흐름

```
1. useCurrentMove() → movingDate 획득
2. useUrgencyMode(movingDate) → mode = 'tight'
3. useTimelineItems(moveId) → 서버에서 전체 항목 조회 (assigned_date는 DB 원본)
4. rescheduleOverdueItems(items, today, movingDate) → display_date 맵 생성
5. items.map(item => ({
     ...item,
     display_date: displayDateMap[item.id] ?? item.assigned_date,
   }))
6. 그룹핑 함수에 display_date 기준으로 전달
7. UI에서 display_date로 날짜 텍스트 표시
```

> **DB는 건드리지 않음**: display_date는 프론트 메모리에서만 존재.
> 새로고침하면 다시 계산됨 (동일 결과).

### 급한/초급한 모드 — 그룹핑 전환 흐름

```
1. useCurrentMove() → movingDate 획득
2. useUrgencyMode(movingDate) → mode = 'urgent' | 'critical'
3. useTimelineItems(moveId) → 서버에서 전체 항목 조회
4. 날짜 기반 그룹핑 건너뛰고, 긴급도 기반 그룹핑 적용:
   - urgent: now / thisWeek / movingDay / afterMove / canSkip 5그룹
   - critical: essential / canSkip 2그룹
5. 각 그룹을 PeriodSection 또는 SkippableSection으로 렌더링
```

---

## 11. 엣지케이스 / 주의사항

### 이사일이 오늘 (D-Day, daysUntilMove=0)

- `getUrgencyMode(0)` → `'critical'`
- 대부분 항목이 과거 → "꼭 해야 할 것"에 필수만 표시
- 이사 당일 항목(d_day_offset=0)은 "꼭 해야 할 것"에 포함
- 이사 후 항목(d_day_offset>0)은 미래이므로 표시 안 됨 (critical 모드에서는 필수만)

### 이사일이 지남 (D+N, daysUntilMove < 0)

- `getUrgencyMode(-3)` → `'critical'`
- 이사 후 항목(전입신고 등)이 now="지금 바로"에 표시
- 전입신고(D+1)는 이사 다음 날이 지나면 과거가 되므로 "지금 바로"로 올라옴

### 모드 전환 경계일 (D-30, D-14, D-7)

- D-30: relaxed → tight 전환. 전환 배너 표시.
- 경계값은 `>=` 비교이므로 D-30 당일은 relaxed, D-29부터 tight.

### 빠듯 모드에서 과거 미완료가 0개

- `rescheduleOverdueItems()`이 빈 배열 반환
- 나머지 항목은 기존 assigned_date 그대로 → 사실상 여유 모드와 동일한 UI
- 이 경우 배너 문구 "남은 할 일을 다시 배치했어요"는 약간 부정확하지만,
  빠듯 모드 전환 자체가 유의미하므로 배너는 표시

### 완료된 항목의 모드별 처리

- 모든 모드에서 완료 항목은 CompletedSection으로 이동 (기존 동작 유지)
- 급한/초급한에서 is_skippable=true 항목을 완료하면 → "여유 되면" → CompletedSection

### display_date와 낙관적 업데이트

- 체크 토글(useToggleItem)의 낙관적 업데이트는 기존 로직 유지
- display_date는 렌더링 시 매번 계산되므로, 토글 후 재계산 시 항목이 적절히 이동
- 캐시 무효화(invalidateQueries) 후 재계산이므로 타이밍 이슈 없음

### 프리체크와의 관계

- 2단계 프리체크(온보딩 직후 밀린 항목 사전 체크)는 5단계와 독립
- 프리체크에서 체크한 항목은 이미 `is_completed=true`이므로 재배치 대상에서 제외
- 프리체크를 안 한 유저(스킵)는 밀린 항목이 더 많고, 5단계 재배치가 더 큰 효과

### 설정에서 이사일 변경 시

- `updateMoveWithReschedule` RPC 호출 → assigned_date 재계산 (서버)
- 성공 후 `invalidateQueries` → 새 데이터로 `useUrgencyMode` 재계산
- 모드가 바뀌었으면 `modeStore.resetTransition()` → 배너 다시 표시 가능

---

## 12. 접근성 (a11y)

- ModeTransitionBanner: `role="status"` + `aria-live="polite"` (비침습적 안내)
- ModeTransitionBanner X 버튼: `aria-label="안내 닫기"`
- SkippableSection 접힘 바: `aria-expanded="false"` + `aria-controls="skippable-list"`
- SkippableSection 펼침 시: `aria-expanded="true"`
- 격려 메시지: `role="note"` (스크린 리더가 부가 정보로 인식)
- 진행률 라벨 변경: `CircularProgress`의 `aria-label`에 모드별 텍스트 반영
  - 여유/빠듯: `aria-label="진행률 12/22 완료"`
  - 급한/초급한: `aria-label="진행률 필수 2/5 완료"`

---

## 13. 완료 확인 기준 (체크리스트)

### 빌드

- [ ] `pnpm build` — 성공
- [ ] `pnpm lint` — 에러 0
- [ ] 추가 패키지 없음 확인

### 모드 판별

- [ ] `getUrgencyMode(30)` → `'relaxed'`
- [ ] `getUrgencyMode(29)` → `'tight'`
- [ ] `getUrgencyMode(14)` → `'tight'`
- [ ] `getUrgencyMode(13)` → `'urgent'`
- [ ] `getUrgencyMode(7)` → `'urgent'`
- [ ] `getUrgencyMode(6)` → `'critical'`
- [ ] `getUrgencyMode(0)` → `'critical'`
- [ ] `getUrgencyMode(-1)` → `'critical'`

### 여유 모드 (D-30+)

- [ ] 대시보드: 기존 동작과 동일 (GreetingHeader "여유 있게 준비해요")
- [ ] 과거 항목 날짜 표시: "오늘" → "지금 해도 괜찮아요" 교체 확인
- [ ] 전체 리스트: 기존 그룹핑 유지

### 빠듯 모드 (D-14~29)

- [ ] GreetingHeader: "하나씩 챙겨볼까요"
- [ ] ActionSection 제목: "먼저 챙기면 좋은 것"
- [ ] 진행률: 전체 기준 (12/22 완료)
- [ ] 과거 미완료 항목에 display_date 부여 확인
- [ ] display_date가 오늘~7일 범위 내 분배 확인
- [ ] 중요도순 정렬 (critical → warning → tip) 확인
- [ ] 전체 리스트: 재분배된 항목이 올바른 주 그룹에 배치

### 급한 모드 (D-7~13)

- [ ] GreetingHeader: "이사가 곧이에요!"
- [ ] ActionSection 제목: "지금 바로 해야 해요", 최대 5개
- [ ] 진행률: 필수 기준 (필수 2/5 완료)
- [ ] UpcomingSection 숨김
- [ ] 전체 리스트: "지금 바로 / 이번 주 / 이사 전날·당일 / 이사 후 / 여유 되면" 5그룹
- [ ] "여유 되면" 기본 접힘

### 초급한 모드 (D-1~6)

- [ ] GreetingHeader: "이사가 코앞이에요!"
- [ ] ActionSection 제목: "꼭 해야 할 것", 필수 항목만
- [ ] 진행률: 필수 기준 (필수 2/5 완료)
- [ ] MotivationCard: "다 못해도 괜찮아요. 필수만 챙기세요." 고정
- [ ] UpcomingSection + PhotoPromptCard 숨김
- [ ] 전체 리스트: "꼭 해야 할 것 / 여유 되면" 2그룹
- [ ] "여유 되면"에 is_skippable=true 전부, 하단 격려 메시지

### 모드 전환 배너

- [ ] 이사일 변경으로 모드 전환 시 배너 표시
- [ ] X 클릭 시 배너 닫힘, 같은 세션 내 재표시 안 됨
- [ ] 첫 설치 유저(previousMode=null): 배너 미표시
- [ ] 자연 전환(날짜 경과): 배너 표시
- [ ] 같은 모드 내 D-Day 변경: 배너 미표시

### SkippableSection

- [ ] 기본 접힘 상태
- [ ] 탭하면 펼침/접힘 토글
- [ ] 접힘 바에 카운트 표시
- [ ] critical 모드에서 격려 메시지 표시

### 접근성

- [ ] ModeTransitionBanner: `role="status"`, `aria-live="polite"`
- [ ] SkippableSection: `aria-expanded`, `aria-controls`
- [ ] CircularProgress aria-label 모드별 변경

---

## 14. 면접 대비 포인트

### "스마트 재배치 설계를 설명해주세요"

> 이사 앱은 일반 할 일 앱과 달리 이사일이라는 절대 데드라인이 있습니다.
> Todoist, Things 3, Motion 등의 밀린 항목 처리 UX를 분석한 뒤,
> Things 3의 "죄책감 없는 부드러운 톤"과 Todoist Smart Schedule의 "자동 재분배"를
> 이사앱 맥락에 맞게 조합했습니다.
>
> 핵심은 4단계 모드 자동 전환입니다:
>
> - 여유(30일+): 날짜 기반 표시, 기존 방식
> - 빠듯(14~29일): 밀린 항목을 중요도순으로 7일 내 자동 분배
> - 급한(7~13일): 날짜 대신 "지금 바로/이번 주/여유 되면" 긴급도 그룹
> - 초급한(1~6일): 필수만 강조, 나머지 접힘 + "다 못해도 괜찮아요" 격려
>
> DB는 건드리지 않고 프론트 표시 레이어에서만 처리합니다. assigned_date는 원본 유지,
> display_date는 메모리에서 계산됩니다. 이는 서버-클라이언트 책임 분리 원칙을 따른 것이고,
> 모드가 바뀔 때마다 서버 호출 없이 즉시 UI가 전환됩니다.

### "왜 DB를 안 바꾸나요?"

> assigned_date를 서버에서 바꾸면:
>
> 1. 이사일을 다시 변경했을 때 원래 날짜를 복원할 수 없음
> 2. 설정 변경 시마다 전체 항목 UPDATE RPC 호출 필요
> 3. 여러 기기에서 동시 접속 시 충돌 가능성
>
> 프론트에서만 처리하면 원본 날짜가 항상 보존되고, 모드 전환이 즉각적이며,
> 오프라인에서도 동작합니다.

### "Things 3, Todoist와 뭐가 다른가요?"

> Things 3은 밀린 항목을 "조용히" 넘기지만, 그래서 유저가 무시하게 되는 문제가 있습니다.
> Todoist는 빨간 경고로 압박하지만, 70%의 유저가 밀린 항목을 가지고 있을 만큼
> 죄책감만 주고 행동 변화를 만들지 못합니다.
>
> 이 앱은 "시간 압박에 비례해 UI 자체가 전환되는" 접근입니다.
> 여유가 있을 때는 날짜 기반으로 보여주다가, 급해지면 날짜 자체를 없애고
> "지금 바로 할 것 vs 안 해도 되는 것"으로 인지 부하를 줄입니다.
> 이건 기존 할 일 앱에서 잘 안 보이는 패턴이에요.

---

## 15. 다음 단계 연결

5단계 완료 후 → **6단계: 집 상태 기록** (`docs/specs/06-property-photo.md`)

- 방별 사진 촬영 + 입주/퇴실 토글
- EXIF 메타데이터 추출 + SHA-256 해시
- Storage 업로드 + DB 메타데이터 저장
- 사진 갤러리 뷰
