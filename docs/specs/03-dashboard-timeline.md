# 3단계: 대시보드 + 타임라인 + 설정 스펙 (SDD)

> 목표: 온보딩 완료 후 유저가 매일 돌아오는 핵심 루프 구현
> 이 단계가 끝나면: 대시보드에서 오늘 할 일 확인 + 체크 토글, 타임라인에서 전체 일정 확인, 설정에서 이사 정보 수정이 가능한 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 대시보드 페이지 (D-Day 카드 + ActionSection(오늘+밀린 통합) + UpcomingSection + MotivationCard + 집기록 유도 CTA)
- 전체 리스트 페이지 (전체 체크리스트 상대시간 그룹핑 + 정렬 옵션)
- 설정 페이지 (이사 정보 수정 → updateMoveWithReschedule)
- 체크 토글 (toggleChecklistItem — 낙관적 업데이트)
- 하단 탭바 DevTabBar (웹 개발용, 9단계에서 네이티브 탭바로 교체)
- 서비스 함수: getCurrentMove, getTodayItems, getTimelineItems, toggleChecklistItem, getOverdueItems, batchCompleteItems
- TanStack Query 훅: useCurrentMove, useTodayItems (useDashboardItems), useTimelineItems, useToggleItem, useTimelineItemsForProgress
- 공통 컴포넌트: CircularProgress, Badge, DevTabBar, PageHeader, Skeleton
- 라우트 추가: /timeline, /settings
- Zustand: moveStore (현재 이사 ID 관리)

### 안 하는 것

- 항목 상세 화면 (4단계)
- 메모 기능 (4단계)
- 스마트 재배치 빠듯/급한/초급한 모드 (5단계 — 3단계는 여유 모드만)
- 집 상태 기록 UI (6단계 — CTA 카드만 보여주기)
- AI 맞춤 가이드 (7단계)
- 인증/비회원 분기 (8단계)
- 네이티브 탭바 (9단계)
- 애니메이션/트랜지션 (기능 완성 후 폴리싱)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
apps/web/src/
├── App.tsx                              ← 수정 (라우트 추가)
│
├── pages/
│   ├── DashboardPage.tsx                ← 수정 (플레이스홀더 → 실제 구현)
│   ├── TimelinePage.tsx                 ← 생성
│   └── SettingsPage.tsx                 ← 생성
│
├── features/
│   ├── dashboard/
│   │   ├── components/
│   │   │   ├── DdayCard.tsx             ← 생성 (D-Day + 원형 진행률)
│   │   │   ├── ActionSection.tsx        ← 생성 (오늘+밀린 할 일 통합, 우선순위 정렬)
│   │   │   ├── UpcomingSection.tsx       ← 생성 (다가오는 일정, 시간대별 그룹핑)
│   │   │   ├── MotivationCard.tsx       ← 생성 (진행률 기반 응원 메시지)
│   │   │   ├── GreetingHeader.tsx       ← 생성 (동적 인사 문구)
│   │   │   ├── PhotoPromptCard.tsx      ← 생성 (집기록 유도 CTA)
│   │   │   ├── TodaySection.tsx         ← 미사용 (ActionSection으로 통합)
│   │   │   └── OverdueSection.tsx       ← 미사용 (ActionSection으로 통합)
│   │   └── hooks/
│   │       ├── useCurrentMove.ts        ← 생성
│   │       ├── useTodayItems.ts         ← 생성 (overdue + today + upcoming 분리 반환)
│   │       ├── useToggleItem.ts         ← 생성 (낙관적 업데이트)
│   │       ├── useTimelineItemsForProgress.ts ← 생성 (원형 진행률 계산용)
│   │       └── queryKeys.ts            ← 생성 (쿼리 키 상수)
│   │
│   ├── timeline/
│   │   ├── components/
│   │   │   ├── PeriodSection.tsx         ← 생성 (기간별 그룹 섹션)
│   │   │   ├── CompletedSection.tsx     ← 생성 (완료 항목 접힘 섹션)
│   │   │   └── TimelinePromptCard.tsx   ← 생성 (하단 프로모 카드)
│   │   └── hooks/
│   │       └── useTimelineItems.ts      ← 생성
│   │
│   └── settings/
│       ├── components/
│       │   ├── MoveInfoSection.tsx       ← 생성 (이사 정보 표시 + 수정)
│       │   ├── MoveEditSheet.tsx         ← 생성 (이사 정보 수정 바텀시트)
│       │   └── SettingsMenuList.tsx      ← 생성 (설정 메뉴 리스트)
│       └── hooks/
│           └── useUpdateMove.ts         ← 생성 (updateMoveWithReschedule 훅)
│
├── shared/
│   └── components/
│       ├── ChecklistItem.tsx            ← 생성 (체크리스트 아이템 행)
│       ├── CircularProgress.tsx         ← 생성 (원형 진행률)
│       ├── Badge.tsx                    ← 생성 (카테고리/상태 뱃지)
│       ├── DevTabBar.tsx               ← 생성 (개발용 하단 탭바)
│       ├── PageHeader.tsx              ← 생성 (페이지 상단 헤더)
│       └── Skeleton.tsx                ← 생성 (스켈레톤 로딩)
│
├── services/
│   ├── move.ts                          ← 수정 (getCurrentMove 추가)
│   ├── checklist.ts                     ← 생성 (getTodayItems, getTimelineItems, toggleChecklistItem, getOverdueItems, batchCompleteItems)
│   └── settings.ts                      ← 생성 (updateMoveWithReschedule 호출)
│
└── stores/
    └── moveStore.ts                     ← 생성 (현재 이사 ID)
```

---

## 2. 패키지 설치

```bash
# 이 단계에서 추가 패키지 없음 — 2단계에서 설치한 것으로 충분
# react-router-dom, @tanstack/react-query, zustand, date-fns 이미 설치됨
```

> **lucide-react**는 0단계에서 이미 설치됨 (아이콘용).

---

## 3. 라우트 설정

### App.tsx 수정

```typescript
// 추가 라우트
<Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
<Route path={ROUTES.TIMELINE} element={<TimelinePage />} />
<Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
```

### 대시보드 진입 가드

- `/dashboard` 접근 시 → `getCurrentMove()` 호출
- active 이사 없으면 → `/` (랜딩)으로 리다이렉트
- active 이사 있으면 → 대시보드 표시
- 구현: `DashboardPage` 내부에서 `useCurrentMove` 결과로 분기

---

## 4. Zustand 스토어

### stores/moveStore.ts

```typescript
interface MoveStore {
  currentMoveId: string | null
  setCurrentMoveId: (id: string) => void
  clear: () => void
}
```

- 온보딩 완료 시 RPC 반환값(move_id)을 여기에 저장
- 대시보드/타임라인에서 이 ID로 데이터 조회
- 새로고침 시 사라짐 → `getCurrentMove()`로 복구 (TanStack Query 캐시)

> **왜 persist 안 하나?**: 2단계와 동일한 판단. 서버에서 active 이사를 조회하면 되므로
> 로컬 스토리지 동기화 복잡도를 추가할 이유가 없음.

---

## 5. 서비스 함수

### services/move.ts (수정)

```typescript
/**
 * 현재 진행 중인 이사 조회 (active 상태 1건)
 * RLS 꺼진 상태이므로 user_id 없이 조회
 * 8단계에서 auth.uid() 기반으로 전환
 */
export async function getCurrentMove(): Promise<Move | null> {
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .eq('status', 'active')
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`[getCurrentMove] ${error.message}`)
  return data
}
```

> **왜 maybeSingle?**: `.single()`은 결과가 0건이면 에러를 던짐. 이사가 없을 수 있으니 `.maybeSingle()` 사용.
> **왜 user_id 없이?**: 3단계에서는 RLS 꺼져있고 인증 없음. 가장 최근 active 이사 1건만 가져옴.
> 8단계에서 RLS 켜면 `auth.uid()` 기반으로 자동 필터링됨.

### services/checklist.ts (생성)

```typescript
/**
 * 오늘 할 일 + 과거 미완료 항목 조회
 * @param moveId - 이사 ID
 * @returns { today: ChecklistItem[], overdue: ChecklistItem[] }
 */
export async function getTodayItems(moveId: string) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('*, master_checklist_items(*)')
    .eq('move_id', moveId)
    .eq('is_completed', false)
    .lte('assigned_date', today)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getTodayItems] ${error.message}`)

  // 프론트에서 오늘 vs 과거 분리
  const todayItems = data?.filter((item) => item.assigned_date === today) ?? []
  const overdueItems = data?.filter((item) => item.assigned_date < today) ?? []

  return { today: todayItems, overdue: overdueItems }
}

/**
 * 전체 체크리스트 조회 (타임라인용)
 * 날짜별 그룹핑은 프론트에서 처리
 */
export async function getTimelineItems(moveId: string) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('*, master_checklist_items(*)')
    .eq('move_id', moveId)
    .order('assigned_date', { ascending: true })
    .order('master_checklist_items(sort_order)', { ascending: true })

  if (error) throw new Error(`[getTimelineItems] ${error.message}`)
  return data ?? []
}

/**
 * 체크리스트 항목 완료/미완료 토글
 * @param itemId - 체크리스트 항목 ID
 * @param moveId - 이사 ID (방어적 스코프 — 다른 이사의 항목 수정 방지)
 * @param isCompleted - 완료 여부
 */
export async function toggleChecklistItem(itemId: string, moveId: string, isCompleted: boolean) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .eq('move_id', moveId) // 방어적 조건: 현재 이사의 항목만 수정 가능
    .select()
    .single()

  if (error) throw new Error(`[toggleChecklistItem] ${error.message}`)
  return data
}
```

### services/settings.ts (생성)

```typescript
/**
 * 이사 정보 수정 + 미완료 항목 재배치 (RPC 호출)
 */
export async function updateMoveWithReschedule(params: {
  moveId: string
  movingDate: string
  housingType: string
  contractType: string
  moveType: string
}) {
  const { data, error } = await supabase.rpc('update_move_with_reschedule', {
    p_move_id: params.moveId,
    p_moving_date: params.movingDate,
    p_housing_type: params.housingType,
    p_contract_type: params.contractType,
    p_move_type: params.moveType,
  })

  if (error) throw new Error(`[updateMoveWithReschedule] ${error.message}`)
  return data
}
```

---

## 6. TanStack Query 훅

### Query Key 상수

```typescript
// features/dashboard/hooks 또는 별도 queryKeys.ts
export const queryKeys = {
  currentMove: ['move', 'current'] as const,
  todayItems: (moveId: string) => ['checklist', 'today', moveId] as const,
  timelineItems: (moveId: string) => ['checklist', 'timeline', moveId] as const,
}
```

### useCurrentMove

```typescript
export function useCurrentMove() {
  return useQuery({
    queryKey: queryKeys.currentMove,
    queryFn: getCurrentMove,
    staleTime: 5 * 60 * 1000, // 5분 — 이사 정보는 자주 안 바뀜
  })
}
```

### useToggleItem (낙관적 업데이트)

```typescript
export function useToggleItem(moveId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ itemId, isCompleted }: { itemId: string; isCompleted: boolean }) =>
      toggleChecklistItem(itemId, moveId, isCompleted),

    // 낙관적 업데이트: UI 먼저 반영
    onMutate: async ({ itemId, isCompleted }) => {
      // 진행 중인 쿼리 취소 (덮어쓰기 방지)
      await queryClient.cancelQueries({ queryKey: queryKeys.todayItems(moveId) })
      await queryClient.cancelQueries({ queryKey: queryKeys.timelineItems(moveId) })

      // 이전 데이터 스냅샷 (롤백용)
      const previousToday = queryClient.getQueryData(queryKeys.todayItems(moveId))
      const previousTimeline = queryClient.getQueryData(queryKeys.timelineItems(moveId))

      // todayItems 캐시에서 해당 아이템 상태 즉시 변경
      queryClient.setQueryData(queryKeys.todayItems(moveId), (old: any) => {
        if (!old) return old
        const toggleItem = (item: any) =>
          item.id === itemId
            ? {
                ...item,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
              }
            : item
        return {
          today: old.today.map(toggleItem),
          overdue: old.overdue.map(toggleItem),
        }
      })

      // timelineItems 캐시에서도 동일하게 변경
      queryClient.setQueryData(queryKeys.timelineItems(moveId), (old: any[]) => {
        if (!old) return old
        return old.map((item: any) =>
          item.id === itemId
            ? {
                ...item,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date().toISOString() : null,
              }
            : item,
        )
      })

      return { previousToday, previousTimeline }
    },

    // 서버 에러 시 롤백
    onError: (_err, _vars, context) => {
      if (context?.previousToday) {
        queryClient.setQueryData(queryKeys.todayItems(moveId), context.previousToday)
      }
      if (context?.previousTimeline) {
        queryClient.setQueryData(queryKeys.timelineItems(moveId), context.previousTimeline)
      }
    },

    // 성공/에러 상관없이 서버 데이터로 동기화
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.todayItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.timelineItems(moveId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.currentMove })
    },
  })
}
```

> **왜 낙관적 업데이트?**: 체크박스 토글은 유저가 가장 자주 하는 액션.
> 서버 응답을 기다리면 체크 → 0.5초 후 반영 → 답답한 UX.
> 먼저 UI를 변경하고, 실패하면 롤백하는 패턴이 토스/당근 등에서도 표준.
> 면접에서 "낙관적 업데이트 구현 경험?" → 이 코드로 설명 가능.

---

## 7. 대시보드 페이지

### 레이아웃 구조

```
┌──────────────────────────────┐
│ 이사콕                     ⚙️ │  ← PageHeader (앱이름 + 설정 아이콘)
│                              │
│ 여유 있게 준비해요            │  ← GreetingHeader (h1, 동적 문구)
│ 새 집으로 이사까지            │  ← 서브텍스트 (body-sm, muted)
│                              │
│ ┌──────────────────────────┐ │
│ │ 새 집으로 이사까지 ╭───╮  │ │
│ │  D-14             │12 │  │ │  ← DdayCard (Teal 배경)
│ │                   │/22│  │ │     원형 진행률 (CircularProgress)
│ │  2026.4.10 (금)   ╰───╯  │ │
│ └──────────────────────────┘ │
│                              │
│ 💪 좋은 시작이에요!           │  ← MotivationCard (진행률 응원)
│                              │
│ 지금 해두면 편해요  3  전체>  │  ← ActionSection (통합, 우선순위 정렬)
│ ┌──────────────────────────┐ │
│ │ ○ 이사업체 견적 비교     │ │
│ │          필수  업체     > │ │  ← 인라인 뱃지 + 체크박스 + 화살표
│ ├──────────────────────────┤ │
│ │ ○ 인터넷 이전 신청       │ │
│ │          주의  통신     > │ │
│ ├──────────────────────────┤ │
│ │ ○ 불필요한 물건 정리     │ │
│ │               정리     > │ │
│ └──────────────────────────┘ │
│                              │
│ 미리 준비하면 좋아요    전체> │  ← UpcomingSection (시간대 그룹핑)
│ ┌──────────────────────────┐ │
│ │ 내일                      │ │
│ │ ┃ 전입신고 서류 준비       │ │
│ ├──────────────────────────┤ │
│ │ 이번 주                   │ │
│ │ ┃ 주소변경 목록 정리       │ │
│ │ ┃ 이사짐 분류하기          │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │ 입주 사진을 찍어두면      │ │  ← PhotoPromptCard (집기록 유도)
│ │ 나중에 보증금을 지켜줘요  │ │
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │  🏠      📈      📷     │ │  ← DevTabBar (홈/타임라인/집기록)
│ │  홈    타임라인   집기록   │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 7-1. GreetingHeader (동적 인사 문구)

```typescript
interface GreetingHeaderProps {
  daysRemaining: number
}
```

| 조건            | 문구                           |
| --------------- | ------------------------------ |
| 30일+           | "여유 있게 준비해요"           |
| 14~29일         | "차근차근 챙겨봐요"            |
| 7~13일          | "중요한 것부터 챙겨요"         |
| 1~6일           | "필수만 챙기면 돼요"           |
| 0일 (D-Day)     | "오늘이 이사 날이에요"         |
| -1~-7일 (D+1~7) | "새 집 마무리, 거의 다 왔어요" |
| -8일 이하       | "이사 잘 마무리했어요!"        |

- 문구는 `packages/shared/src/constants/greetings.ts`에 상수로 관리
- 3단계에서는 여유 모드만 실제 동작, 나머지 모드 문구는 정의만 해두기
- 5단계 스마트 재배치에서 모드 판별 로직과 연결

서브텍스트: "새 집으로 이사까지" (고정)

### 7-2. DdayCard

```
┌─────────────────────────────────┐
│                         ╭─────╮ │
│  새 집으로 이사까지       ╭─────╮ │
│  D-14                   │ 12  │ │  ← D-Day 숫자 (5xl, bold, white)
│                         │ /22 │ │     원형 진행률 (CircularProgress)
│  2026년 4월 10일 (금)    │완료 │ │
│                         ╰─────╯ │
└─────────────────────────────────┘
```

- 배경: primary (Teal)
- 텍스트: white
- D-Day 숫자: "D-14" (text-5xl, bold) — `D-${daysRemaining}`, 당일이면 "D-Day", 지나면 "D+N"
- 원형 진행률: `CircularProgress` 컴포넌트 — 완료/전체 비율 (size=102, strokeWidth=9)
- 날짜: `format(movingDate, 'yyyy년 M월 d일 (E)', { locale: ko })`
- radius: 16px (rounded-2xl)
- ~~가로 프로그레스 바~~: **제거** — 원형 진행률만으로 충분, UI 심플화

### 7-3. ActionSection (오늘 할 일 + 밀린 할 일 통합)

> **변경**: 기존 TodaySection + OverdueSection을 하나로 합침. 밀린 할 일과 오늘 할 일을 분리하면 우선순위 파악이 어려워, guide_type 기반 정렬로 통합.

- 제목: "지금 해두면 편해요" (h3, bold) + 카운트 뱃지 (Badge variant="count")
- 우측: "전체 일정보기" 링크 → 타임라인 페이지
- 정렬: guide_type 우선순위 (critical=0, warning=1, tip=2), 같은 우선순위 내에서 assigned_date 오름차순
- 최대 3개 표시
- 각 아이템 레이아웃:

```
┌─────────────────────────────────────────┐
│ ○  이사업체 견적 비교      필수  업체  > │
└─────────────────────────────────────────┘
```

- 좌측: 체크박스 (20px, rounded-full, border-2 border-border)
- 중간: 제목 (body, font-medium, truncate)
- 우측: 인라인 뱃지 (critical="필수", warning="주의", category 뱃지) + ChevronRight
- 빈 상태: "모든 일정이 순조로워요" + 다음 할 일 날짜 안내
- 체크 토글: 클릭 시 즉시 완료 처리 (낙관적 업데이트)

### 7-4. MotivationCard (진행률 응원 메시지)

- DdayCard 바로 아래 위치
- 진행률 기반 동적 메시지 + 이모지

| 진행률 | 메시지                          | 이모지 |
| ------ | ------------------------------- | ------ |
| 0%     | 첫 번째 할 일을 완료해볼까요?   | 👋     |
| 1~30%  | 좋은 시작이에요! 계속 가볼까요? | 💪     |
| 31~50% | N개만 완료하면 절반 달성!       | 💪     |
| 51~80% | 절반 넘었어요! 거의 다 왔어요   | ✨     |
| 81~99% | 마지막 N개만 남았어요!          | 🔥     |
| 100%   | 모든 할 일을 완료했어요!        | 🎉     |

### 7-5. UpcomingSection (다가오는 일정)

- 제목: "미리 준비하면 좋아요" (h3, bold, text-secondary)
- 우측: "전체 보기" 링크 → 타임라인 페이지
- 최대 6개 미리보기
- 시간대별 그룹핑: 내일 / 이번 주 / 다음 주
- `differenceInCalendarDays`로 분류 (1일=내일, 2~7일=이번 주, 8일+=다음 주)
- 각 그룹: 카드 형태 (bg-tertiary/60, rounded-xl)
- 각 아이템: border-l-4 border-primary/30 + 제목만 표시
- 항목 없으면 섹션 숨김

### 7-6. PhotoPromptCard (집기록 유도)

- 배경: neutral 또는 연한 이미지
- 텍스트: "입주 사진을 찍어두면 나중에 보증금을 지켜줘요"
- 서브: "사소한 흠집도 꼼꼼하게 기록하세요."
- CTA: "📷 기록 시작하기 →" (6단계에서 실제 연결. 3단계에서는 `console.log('TODO: 집기록')`)
- D-Day 이전: "퇴실 전 구 집 상태를 기록하세요" (D-Day 전 문구)
- D-Day 이후: "입주 사진을 찍어두면~" (D-Day 후 문구)

---

## 8. 전체 리스트 페이지

### 설계 철학

> "전체 할 일은 예쁘게 만드는 게 아니라, 빠르게 읽히게 만드는 것이다"
> 홈 = 지금 해야 할 일 (행동 유도) / 전체 리스트 = 전체 일정 조망 (확인용)

### 레이아웃 구조

```
┌──────────────────────────────┐
│ 전체 할 일            12/25 ⇅│  ← 페이지 제목 + 진행률 + 정렬
│                              │
│ ━━━━━━━━━━━━━━━(48%)━━━━━━━ │  ← 프로그레스 바 (4px, primary)
│                              │
│ ── 이번 주 ──────── 7 ───── │  ← ChecklistGroup 헤더
│                              │
│ ○ 원상복구 범위 확인    주의  │  ← 제목 + 뱃지 (2줄 구조)
│   오늘                       │  ← 날짜 (tertiary 색)
│                              │
│ ○ 사전 실측            주의  │
│   오늘                       │
│                              │
│ ○ 귀중품 따로 보관           │
│   내일                       │
│                              │
│ ○ 안 쓰는 물건 정리          │
│   내일                       │
│                              │
│ ○ 가구 배치 계획             │
│   4월 10일 (목)              │
│                              │
│ ○ 이사 방식 결정하기         │
│   4월 11일 (금)              │
│                              │
│ ○ 구독 서비스 주소변경       │
│   4월 11일 (금)              │
│                              │
│ ════════════════════════════ │  ← 섹션 구분 (8px 회색 띠)
│                              │
│ ── 이사 주 ──────── 6 ───── │
│                              │
│ ○ 냉장고 비우기        주의  │
│   이사 전날                  │
│                              │
│ ○ 계량기 사진 촬영           │
│   이사 전날                  │
│                              │
│ ○ 짐 최종 확인              │
│   이사 당일                  │
│                              │
│ ○ 에어컨 이전 설치 확인      │
│   이사 당일                  │
│                              │
│ ════════════════════════════ │
│                              │
│ ── 이사 후 ──────── 5 ───── │
│                              │
│ ○ 전입신고                   │
│   이사 후 1일                │
│                              │
│ ○ 구 집 상태 촬영            │
│   이사 후 1일                │
│                              │
│ ○ 도어락 비밀번호 변경       │
│   이사 후 3일                │
│                              │
│ ════════════════════════════ │
│                              │
│ ┌──────────────────────────┐ │
│ │ ✓ 완료               7개 >│ │  ← CompletedSection (접힘)
│ └──────────────────────────┘ │
│                              │
│ ┌──────────────────────────┐ │
│ │  🏠      📋      📷     │ │  ← DevTabBar
│ │  홈     전체    집기록    │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### 8-1. 그룹핑 규칙

그룹은 **상대적 시간** 기준으로 오늘을 기점으로 매일 재계산:

| 그룹     | 조건                                            |
| -------- | ----------------------------------------------- |
| 이번 주  | 오늘 ~ 이번 주 일요일 (+ 과거 미완료 항목 합산) |
| 다음 주  | 다음 주 월~일                                   |
| (N주 후) | 이사 주 전까지 주 단위                          |
| 이사 주  | 이사일이 속한 주 (월~일)                        |
| 이사 후  | 이사일 이후 항목 (d_day_offset > 0)             |

- **이번 주 = 이사 주이면 → "이번 주 (이사 주)"로 합침**, 그룹 1개로 표시
- **빈 그룹은 렌더링하지 않음** (항목이 있는 그룹만 표시)
- **과거 assigned_date 미완료 항목 → "이번 주" 그룹에 합산** (별도 "밀린 할 일" 그룹 없음)
- 그룹 내 정렬: assigned_date 오름차순
- 완료 항목은 그룹에서 제외 → CompletedSection으로 이동

### 8-2. 날짜 표시 규칙

각 항목의 2번째 줄에 표시되는 날짜 텍스트:

| 조건                        | 표시                     |
| --------------------------- | ------------------------ |
| assigned_date < 오늘 (과거) | "오늘" (3단계 임시 처리) |
| assigned_date = 오늘        | "오늘"                   |
| assigned_date = 내일        | "내일"                   |
| 이번 주 나머지              | "4월 10일 (목)"          |
| 이사 주 항목 (이사일 -1)    | "이사 전날"              |
| 이사 주 항목 (이사일 당일)  | "이사 당일"              |
| 이사 후 항목                | "이사 후 N일"            |

- 날짜 텍스트 스타일: 13px, color-text-tertiary
- ⚠️ **5단계 스마트 재배치 적용 시, 과거 항목의 날짜가 재분배된 날짜로 자동 교체됨. 3단계에서는 과거 항목이 많으면 "오늘"이 여러 개 표시될 수 있으나, 이는 5단계에서 해결.**

### 8-3. ChecklistGroup 컴포넌트

```typescript
interface ChecklistGroupProps {
  label: string // "이번 주", "이사 주", "이사 후"
  count: number // 그룹 내 미완료 항목 수
  items: ChecklistItem[]
  isCurrentWeek?: boolean // 현재 구간 강조 여부
}
```

- 헤더: 그룹명 (15px, font-medium) + 카운트 pill (12px, 둥근 뱃지)
- 현재 구간 (isCurrentWeek=true): 카운트 pill에 teal 배경 (#E0F2F1) + primary 텍스트
- 나머지 구간: 카운트 pill에 background-tertiary + secondary 텍스트
- 그룹 사이 구분: **8px 높이 회색 띠** (bg-background-tertiary)
- 카드 없음, 플랫 리스트

### 8-4. 전체 리스트 전용 ChecklistItem 레이아웃

```
┌─────────────────────────────────┐
│ ○  원상복구 범위 확인      주의  │  ← 1줄: 체크박스 + 제목 + 뱃지
│    오늘                         │  ← 2줄: 날짜 (tertiary)
└─────────────────────────────────┘
```

대시보드용 ChecklistItem과 차이점:

- **카테고리 태그 없음** (대시보드에는 있음, 전체 리스트에서는 제거 — 시각적 노이즈 감소)
- **날짜 2줄째 추가** (대시보드에는 없음)
- **chevron (>) 없음** (4단계 항목 상세 연결 시 추가 가능)
- 뱃지: "주의"(warning), "필수"(critical)만 표시. 카테고리 뱃지는 미표시.
- **뱃지 사용 비율: 전체의 20~30% 이하** (is_skippable=false 항목에만, 남용 금지)
- 항목 간 구분: 0.5px border-bottom (border-tertiary)
- 체크박스 터치 영역: 최소 44x44px (a11y)

### 8-5. CompletedSection (완료 항목)

```typescript
interface CompletedSectionProps {
  items: ChecklistItem[]
  onToggle: (id: string, isCompleted: boolean) => void
}
```

- 항상 리스트 최하단에 위치
- **기본 접힘 상태** — "✓ 완료 · 7개 >" 형태의 바 클릭으로 펼침
- 펼치면: 완료된 항목을 플랫하게 나열 (line-through + muted 텍스트)
- 체크박스 클릭으로 미완료 복원 가능
- 배경: background-tertiary (둥근 카드 형태, radius-lg)

### 8-6. 정렬

- 상단 우측에 정렬 아이콘 (⇅, ArrowUpDown from lucide-react)
- 클릭 → SortSheet (바텀시트 또는 드롭다운):
  - **시간순** (기본) — 위 와이어프레임 그대로
  - **카테고리별** — 그룹 헤더가 "업체 / 정리 / 행정 / 공과금 / 통신..." 으로 변경
- 카테고리별 선택 시: 날짜 표시는 유지, 그룹만 카테고리로 변경
- 탭을 떠났다 돌아오면 **기본 (시간순)으로 리셋**
- 3단계에서는 간단한 드롭다운으로 구현 가능

### 8-7. 검색

- 검색 아이콘 (Search from lucide-react) — 페이지 제목 옆
- 클릭 시 검색바 펼침 (상단에 인라인 노출)
- 검색 대상: 항목 제목 (title)만 — 프론트에서 필터링
- 15~25개 항목이므로 서버 검색 불필요
- 9단계 네이티브에서는 pull-to-reveal 패턴으로 전환 가능

### 8-8. 프로그레스 바

- 페이지 제목 하단, 가로 전체 너비
- 높이: 4px, 둥글기: 9999px
- 트랙: border-tertiary
- 채움: primary
- 비율: 완료/전체 (calculateProgress 함수 재사용)

---

## 9. 공통 컴포넌트

### 9-1. ChecklistItem

```typescript
interface ChecklistItemProps {
  id: string
  title: string
  isCompleted: boolean
  guideType?: 'tip' | 'warning' | 'critical'
  onToggle: (id: string, isCompleted: boolean) => void
  onPress?: () => void // 항목 상세로 이동 (4단계)
  // 대시보드 전용
  category?: string // 카테고리 뱃지 표시 (전체 리스트에서는 미사용)
  showChevron?: boolean // > 아이콘 표시 (기본 false)
  // 전체 리스트 전용
  dateLabel?: string // "오늘", "내일", "4월 10일 (목)" 등
}
```

레이아웃:

```
┌─────────────────────────────────────────┐
│ ○  이사업체 견적 비교      필수  업체  > │
└─────────────────────────────────────────┘
```

레이아웃 (전체 리스트 variant):

┌─────────────────────────────────────┐
│ ○ 원상복구 범위 확인 주의 │
│ 오늘 │
└─────────────────────────────────────┘
좌측: 체크박스 (22px, 미완료=border 1.5px, 완료=primary 배경 + 체크마크)
중간: 제목 (15px, secondary) + 선택적 카테고리 뱃지 + 선택적 날짜
우측: guide_type 뱃지 (critical="필수" amber배경, warning="주의" amber배경)
완료 시: title에 line-through + 텍스트 muted 색상
최소 높이: 56px (날짜 2줄 포함 시 자동 확장)
클릭 영역: 체크박스 영역 = 토글, 나머지 영역 = 항목 상세 이동 (4단계)
체크박스 터치 영역: 최소 44x44px (a11y)

### 9-2. CircularProgress

```typescript
interface CircularProgressProps {
  completed: number
  total: number
  size?: number // 기본 64
  strokeWidth?: number // 기본 4
  className?: string
}
```

- SVG 기반 원형 프로그레스
- 트랙: white/30% (DdayCard 위에서 사용하므로)
- 채움: white
- 중앙 텍스트: "12/22" (bold) + "완료" (caption)
- `stroke-dasharray` + `stroke-dashoffset`로 비율 표현

### 9-3. Badge

```typescript
interface BadgeProps {
  variant: 'category' | 'critical' | 'warning' | 'count' | 'today'
  children: React.ReactNode
}
```

| variant  | 배경         | 텍스트   | 용도          |
| -------- | ------------ | -------- | ------------- |
| category | tertiary     | primary  | 카테고리 태그 |
| critical | critical/10% | critical | "필수" 뱃지   |
| warning  | warning/10%  | warning  | 주의 뱃지     |
| count    | tertiary     | primary  | 카운트 ("3")  |
| today    | primary      | white    | "오늘"        |

- 패딩: 4px 8px
- 둥글기: 8px
- 폰트: caption (12px) / 500

### 9-4. DevTabBar

```typescript
// 웹 개발용 하단 탭바
// 9단계에서 Expo 네이티브 탭바로 교체 → 이 컴포넌트 제거
```

- 3탭: 홈(House), 전체(ClipboardList), 집기록(Camera)
- lucide-react 아이콘 사용
- 선택된 탭: primary 색상
- 미선택: placeholder 색상
- 높이: 56px + safe-area-bottom
- fixed bottom (z-20)
- react-router-dom `NavLink`로 라우트 연결

> **왜 DevTabBar인가?**: 설계 결정에서 "하단 탭바는 Expo 네이티브"로 확정.
> 하지만 웹 단독 개발 중에는 탭 네비게이션이 필요하니 임시 웹 탭바를 만듦.
> 9단계에서 Expo 셸이 추가되면 이 컴포넌트를 제거하고 네이티브로 교체.

### 9-5. Skeleton

```typescript
interface SkeletonProps {
  className?: string // 높이, 너비, 둥글기를 외부에서 지정
}
```

- `animate-pulse` (Tailwind 기본)
- 배경: border 색상
- DdayCard, ChecklistItem, TodaySection 각각에 매칭되는 스켈레톤 변형

---

## 10. 설정 페이지

### 레이아웃

```
┌──────────────────────────────┐
│ ← 설정                       │  ← PageHeader (뒤로가기 + 제목)
│                              │
│ 이사 관리                    │  ← 섹션 제목 (body-sm, muted)
│ ┌──────────────────────────┐ │
│ │ 이사 정보 수정           > │ │  ← 클릭 → MoveEditSheet 열기
│ │ 원룸 · 월세 · 용달        │ │
│ │ 2026.4.10                 │ │
│ └──────────────────────────┘ │
│                              │
│ 계정                         │
│ ┌──────────────────────────┐ │
│ │ 로그인                   > │ │  ← 8단계에서 연동
│ └──────────────────────────┘ │
│                              │
│ 정보                         │
│ ┌──────────────────────────┐ │
│ │ 개인정보처리방침          > │ │
│ ├──────────────────────────┤ │
│ │ 이용약관                  > │ │
│ ├──────────────────────────┤ │
│ │ 문의하기                  > │ │
│ ├──────────────────────────┤ │
│ │ 앱 버전        v1.0.0     │ │
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

### MoveEditSheet (이사 정보 수정)

- 트리거: "이사 정보 수정" 클릭
- UI: 바텀시트 (또는 새 페이지 — 3단계에서는 새 페이지로 간소화)
- 폼: 온보딩 스텝 3개를 한 화면에 배치
  - 이사 예정일 (CalendarPicker 재사용)
  - 주거유형 (SelectionChip 재사용)
  - 계약유형 + 이사방법 (SelectionChip 재사용)
- 저장: `updateMoveWithReschedule` RPC 호출
- 성공 시: 대시보드/타임라인 데이터 자동 갱신 (invalidateQueries)
- 주의: 완료된 항목은 건드리지 않음 (RPC 내부에서 미완료만 재배치)

### 설정 메뉴 항목 (3단계에서 동작하는 것)

| 메뉴             | 동작                          | 단계     |
| ---------------- | ----------------------------- | -------- |
| 이사 정보 수정   | MoveEditSheet 열기            | 3단계 ✅ |
| 로그인           | `console.log('TODO: 로그인')` | 8단계    |
| 개인정보처리방침 | 외부 링크 (placeholder URL)   | 6단계    |
| 이용약관         | 외부 링크 (placeholder URL)   | 6단계    |
| 문의하기         | `mailto:` 링크                | 3단계 ✅ |
| 앱 버전          | 정적 텍스트 "v1.0.0"          | 3단계 ✅ |

---

## 11. 진행률 계산

### 3단계 (여유 모드만)

```typescript
// packages/shared/src/utils/progress.ts

/**
 * 전체 기준 진행률
 * 여유/빠듯 모드에서 사용 (급한/초급한은 5단계에서 필수 기준으로 전환)
 */
export function calculateProgress(items: { is_completed: boolean }[]) {
  const total = items.length
  const completed = items.filter((item) => item.is_completed).length
  return { completed, total, percentage: total > 0 ? Math.round((completed / total) * 100) : 0 }
}
```

- DdayCard에서 사용: `CircularProgress`에 completed/total 전달
- 5단계에서 모드별 분기 추가 (급한/초급한 → 필수 기준)

---

## 12. 엣지케이스 / 주의사항

### 이사 데이터 없음 (비정상 접근)

- `/dashboard` 직접 접근 + active 이사 없음 → 랜딩으로 리다이렉트
- `/timeline` 직접 접근 + active 이사 없음 → 랜딩으로 리다이렉트
- `/settings` 직접 접근 + active 이사 없음 → 랜딩으로 리다이렉트

### 체크리스트가 0개인 경우

- 이론적으로 불가능 (RPC에서 조건 필터링 결과 최소 15개+)
- 만약 발생하면: "체크리스트를 불러올 수 없어요" + 재시도 버튼

### 오늘 할 일 + 밀린 할 일 모두 0개

- 대시보드: "오늘은 할 일이 없어요 ✨" + 다음 할 일 날짜 안내
- 모든 항목 완료: "모든 할 일을 완료했어요! 🎉" (이사 완료 대시보드는 별도 — v2에서)

### 체크 토글 실패

- 낙관적 업데이트 후 서버 에러 → 자동 롤백 (이전 상태 복원)
- 유저에게 토스트: "저장에 실패했어요. 다시 시도해주세요" (토스트 컴포넌트는 4단계에서 추가, 3단계에서는 console.error)

### 이사 정보 수정 중 충돌

- 수정 RPC 호출 중 → "저장 중..." 로딩 + 버튼 disabled
- 실패 시: "저장에 실패했어요" 메시지 + 폼 데이터 유지 (다시 시도 가능)

### D-Day 계산

- `differenceInCalendarDays(movingDate, today)` 사용 (date-fns)
- 시간 무시, 날짜 단위로만 계산
- 타임존: 클라이언트 로컬 타임존 기준 (한국은 KST 고정)

### 새로고침 시 데이터 복구

- Zustand `moveStore`는 새로고침 시 초기화
- `useCurrentMove()`가 서버에서 active 이사를 다시 조회
- 조회 결과를 `moveStore`에 다시 저장

### 카테고리 필터 + 완료 필터 조합

- "미완료만" + "행정" → 미완료이면서 행정 카테고리인 항목만 표시
- 필터 결과 0건 → "해당하는 항목이 없어요" 빈 상태

### 접근성 (a11y)

- ChecklistItem 체크박스: `role="checkbox"` + `aria-checked` + `aria-label="항목명 완료 처리"`
- FilterTabs: `role="tablist"` + `role="tab"` + `aria-selected`
- CategoryChips: `role="radiogroup"` + `role="radio"` + `aria-checked`
- DevTabBar: `role="navigation"` + `aria-label="메인 네비게이션"` + 각 탭 `aria-current="page"`
- CircularProgress: `role="img"` + `aria-label="진행률 12/22 완료"`
- OverdueSection: `aria-label="밀린 할 일 1개"` (스크린 리더가 섹션 진입 시 안내)
- 스켈레톤: `aria-hidden="true"` (로딩 중 스크린 리더가 읽지 않도록)

### 로딩 상태

- 초기 로딩: DdayCard + TodaySection + OverdueSection 각각 스켈레톤
- 0.3초 이내 응답 → 스켈레톤 안 보여줌 (깜빡임 방지)
- 체크 토글: 낙관적 업데이트이므로 별도 로딩 없음

### 오프라인

- 2단계에서 만든 `useOnlineStatus` + `OfflineBanner` 재사용
- 오프라인 시: 체크 토글 비활성 + "인터넷 연결을 확인해주세요" 배너
- 데이터 조회는 TanStack Query 캐시로 이전에 로딩된 데이터 표시 가능

---

## 13. 다음 단계 연결

3단계 완료 후 → **4단계: 항목 상세 + 체크 토글 + 메모** (`docs/specs/04-detail.md`)

- 항목 상세 화면: 가이드 본문 + 관련 링크 + 메모
- ChecklistItem 클릭 → `/checklist/:itemId` 이동
- 메모 CRUD (updateItemMemo)
- 토스트 컴포넌트 (성공/에러 알림)
