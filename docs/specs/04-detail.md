# 4단계: 항목 상세 + 메모 + 토스트 스펙 (SDD)

> 목표: 체크리스트 항목을 탭하면 "뭘 해야 하는지" 바로 파악할 수 있는 상세 가이드 화면 제공
> 이 단계가 끝나면: 항목 상세에서 가이드 확인 + 메모 작성 + 체크 토글이 가능하고, 앱 전체에서 토스트 피드백이 동작하는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- 항목 상세 페이지 (`/checklist/:itemId`)
- 가이드 정보 구조화: "이렇게 하세요"(액션 단계) + "준비물" + "참고"(부가 설명) 3섹션 분리
- 마스터 데이터 구조 변경: `guide_content` → `guide_steps` + `guide_items` + `guide_note` 분리
- DB 마이그레이션 + 시드 데이터 업데이트 (46개 항목)
- 관련 링크 외부 열기 처리
- 메모 CRUD (인라인 textarea + 디바운스 자동 저장)
- 토스트 컴포넌트 (직접 구현)
- 서비스 함수: `getChecklistItemDetail`, `updateItemMemo`
- TanStack Query 훅: `useChecklistItemDetail`, `useUpdateMemo`
- 날짜 표시: 상대적 시간 표현 ("이사 다음 날 · 3월 26일 (수)")
- 3단계 `ChecklistItem`에 `onPress` 연결 (항목 클릭 → 상세 이동)

### 안 하는 것

- AI 맞춤 가이드 표시 (7단계 — `custom_guide` 컬럼은 이미 존재하지만 4단계에서 사용 안 함)
- 스마트 재배치 모드별 분기 (5단계)
- 집 상태 기록 (6단계)
- 이전/다음 항목 네비게이션 (P2 — 필요하면 추후 추가)
- 가이드 본문 마크다운 렌더링 (불필요 — 짧은 텍스트, 줄바꿈 처리면 충분)
- 메모 이미지 첨부 (텍스트만)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
apps/web/src/
├── App.tsx                                ← 수정 (라우트 추가)
│
├── pages/
│   └── ChecklistDetailPage.tsx            ← 생성
│
├── features/
│   └── checklist-detail/
│       ├── components/
│       │   ├── DetailHeader.tsx             ← 생성 (D-day 트럭 칩 + 뱃지 + 제목 + 상대일자)
│       │   ├── GuideStepsSection.tsx        ← 생성 (Toss Stepper "이렇게 하세요")
│       │   ├── GuideItemsSection.tsx        ← 생성 ("미리 준비할 것" 체크리스트)
│       │   ├── GuideNoteSection.tsx         ← 생성 (TipCard 래퍼, Steps 없을 때만 표시)
│       │   ├── RelatedLinkCard.tsx          ← 생성 ("바로가기" 외부 링크 카드)
│       │   ├── MemoSection.tsx              ← 생성 (인라인 textarea + 자동 저장)
│       │   ├── TipCard.tsx                  ← 생성 (민트 배경 Tip 블록, 재사용 공통)
│       │   ├── SectionTitle.tsx             ← 생성 (h3 섹션 제목 공통화)
│       │   ├── CompletionStamp.tsx          ← 생성 (완료 시 우측 원형 도장 오버레이)
│       │   └── CompletionToggleButton.tsx   ← 생성 (하단 sticky CTA)
│       └── hooks/
│           ├── useChecklistItemDetail.ts    ← 생성
│           ├── useUpdateMemo.ts             ← 생성
│           └── queryKeys.ts                 ← 생성
│
├── shared/
│   └── components/
│       ├── Toast.tsx                        ← 생성
│       ├── ToastProvider.tsx                ← 생성 (Context + Portal)
│       └── SectionDivider.tsx               ← 생성 (섹션 간 8px 구분띠)
│
├── services/
│   └── checklist.ts                       ← 수정 (getChecklistItemDetail, updateItemMemo 추가)
│
packages/shared/src/
├── utils/
│   └── dateLabel.ts                       ← 생성 (상대적 시간 표현 유틸)
├── constants/
│   └── linkMeta.ts                        ← 생성 (URL → 사이트명/설명 매핑)
│
supabase/migrations/
└── 00005_guide_structure.sql              ← 생성 (guide_steps, guide_items, guide_note 컬럼 추가)
```

---

## 2. DB 마이그레이션

### 00005_guide_structure.sql

```sql
-- master_checklist_items에 구조화된 가이드 컬럼 추가
ALTER TABLE public.master_checklist_items
  ADD COLUMN guide_steps text[],
  ADD COLUMN guide_items text[],
  ADD COLUMN guide_note text;

-- 기존 guide_content는 유지 (AI 가이드 7단계에서 폴백용으로 사용)
-- guide_content를 삭제하지 않음 — 하위 호환성 유지
```

> **왜 guide_content를 삭제 안 하나?**: 7단계 AI 맞춤 가이드에서 프롬프트 입력으로 기존 guide_content를 사용함.
> 또한 guide_steps가 비어있는 항목이 있을 수 있고 (모든 항목에 단계가 있는 건 아님), 그때 guide_content를 폴백으로 표시.
> **왜 text[]?**: guide_steps는 "1. 정부24 접속", "2. 전입신고 신청" 같은 단계별 문자열 배열.
> guide_items도 "신분증", "임대차계약서 원본" 같은 준비물 배열.
> JSONB 대신 text[]를 쓰는 이유는 1단계와 동일 — 단순 목록에는 배열이 더 간단.

### 시드 데이터 업데이트

기존 46개 항목의 `guide_steps`, `guide_items`, `guide_note`를 채워야 함.
Claude Code가 `master-checklist-data.md`의 `guide_content`를 분석해서 UPDATE문을 생성.

**변환 규칙:**

| guide_content 내용                       | 변환 대상     |
| ---------------------------------------- | ------------- |
| 행동 지시 ("~하세요", "~신청", "~확인")  | `guide_steps` |
| 필요한 물건 ("신분증", "계약서", "도장") | `guide_items` |
| 배경 설명, 주의사항, 법적 근거           | `guide_note`  |

**예시 — #41 전입신고 + 확정일자 받기:**

```sql
UPDATE public.master_checklist_items
SET
  guide_steps = ARRAY[
    '정부24 온라인 또는 관할 주민센터 방문',
    '전입신고 + 확정일자 동시 신청',
    '수수료 없음 (온라인 기준)'
  ],
  guide_items = ARRAY[
    '본인 신분증',
    '임대차계약서 원본'
  ],
  guide_note = '전입신고는 이사 후 14일 이내 의무. 이사 당일~다음날에 해야 대항력 확보. 확정일자는 전세/월세 모두 받아두기 — 보증금 보호의 핵심.'
WHERE sort_order = 42;
```

**예시 — #09 대형폐기물 배출 신청 (준비물 없는 경우):**

```sql
UPDATE public.master_checklist_items
SET
  guide_steps = ARRAY[
    '동주민센터 방문 또는 구청 홈페이지에서 온라인 신청',
    '품목별 대형폐기물 스티커 구매',
    '배출일 지정 후 해당 날짜에 배출'
  ],
  guide_items = NULL,
  guide_note = '스티커 가격은 품목별 상이 (소파 5,000~15,000원). 배출일 지정이 필요하니 미리 신청.'
WHERE sort_order = 9;
```

> **모든 항목에 guide_steps가 있는 건 아님**: "냉장고 식재료 소진 시작(#15)" 같은 항목은 명확한 단계가 없고 팁에 가까움.
> 이 경우 guide_steps = NULL, guide_note에 내용을 넣음 → 프론트에서 폴백 처리.

---

## 3. 서비스 함수

### services/checklist.ts (수정 — 함수 추가)

```typescript
/**
 * 체크리스트 항목 상세 조회
 * user_checklist_items + master_checklist_items JOIN
 * @returns 유저 항목 데이터 + 마스터 가이드 데이터 통합
 */
export async function getChecklistItemDetail(itemId: string) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select(
      `
      *,
      master_checklist_items (
        title,
        description,
        guide_content,
        guide_steps,
        guide_items,
        guide_note,
        guide_url,
        guide_type,
        category,
        d_day_offset
      )
    `,
    )
    .eq('id', itemId)
    .single()

  if (error) throw new Error(`[getChecklistItemDetail] ${error.message}`)
  return data
}
```

> **왜 .single()?**: itemId는 UUID PK이므로 결과가 정확히 1건.
> 없으면 에러를 던져야 함 (유효하지 않은 ID로 접근한 경우).

```typescript
/**
 * 메모 업데이트
 * 디바운스 자동 저장에서 호출
 */
export async function updateItemMemo(itemId: string, memo: string) {
  const { error } = await supabase
    .from('user_checklist_items')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', itemId)

  if (error) throw new Error(`[updateItemMemo] ${error.message}`)
}
```

> **왜 RPC가 아니라 직접 UPDATE?**: 단일 필드 업데이트이고 트랜잭션이 필요 없음.
> 2단계 batchCompleteItems와 동일한 판단.

---

## 4. TanStack Query 훅

### queryKeys.ts

```typescript
export const detailKeys = {
  item: (itemId: string) => ['checklist', 'detail', itemId] as const,
}
```

### useChecklistItemDetail

```typescript
export function useChecklistItemDetail(itemId: string) {
  return useQuery({
    queryKey: detailKeys.item(itemId),
    queryFn: () => getChecklistItemDetail(itemId),
    staleTime: 5 * 60 * 1000, // 5분 — 가이드 내용은 자주 안 바뀜
  })
}
```

### useUpdateMemo

```typescript
export function useUpdateMemo(itemId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (memo: string) => updateItemMemo(itemId, memo),

    // 낙관적 업데이트: 메모 내용을 캐시에 즉시 반영
    onMutate: async (newMemo) => {
      await queryClient.cancelQueries({ queryKey: detailKeys.item(itemId) })

      const previous = queryClient.getQueryData(detailKeys.item(itemId))

      queryClient.setQueryData(detailKeys.item(itemId), (old: any) => {
        if (!old) return old
        return { ...old, memo: newMemo }
      })

      return { previous }
    },

    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(detailKeys.item(itemId), context.previous)
      }
      // 토스트는 MemoSection에서 처리
    },

    // 성공 시 조용히 — 자동 저장이므로 성공 토스트 불필요
    // 에러 시에만 "저장에 실패했어요" 토스트
  })
}
```

> **왜 성공 토스트를 안 띄우나?**: 메모 자동 저장은 키 입력마다 발생할 수 있음.
> 매번 "저장됨" 토스트가 뜨면 오히려 방해. 인라인 상태 텍스트("저장 중..." / "저장됨")로 충분.

---

## 5. 라우트

### App.tsx 수정

```typescript
import { ChecklistDetailPage } from './pages/ChecklistDetailPage'

// 기존 라우트에 추가
<Route path={ROUTES.CHECKLIST_DETAIL} element={<ChecklistDetailPage />} />
```

> `ROUTES.CHECKLIST_DETAIL`은 0단계에서 이미 정의됨: `/checklist/:itemId`

### 3단계 ChecklistItem 수정

3단계에서 만든 `ChecklistItem` 컴포넌트의 `onPress` prop을 실제로 연결:

```typescript
// 대시보드, 전체 리스트에서 ChecklistItem 사용 시
<ChecklistItem
  // ... 기존 props
  onPress={() => navigate(`/checklist/${item.id}`)}
/>
```

> 3단계 스펙에서 `onPress?: () => void` prop은 이미 정의돼있음.
> 4단계에서는 이 prop에 navigate를 연결만 하면 됨.

---

## 6. 항목 상세 페이지

### 페이지 목적

**"읽기 가이드"** — 유저가 이 항목을 어떻게 처리해야 하는지 한눈에 파악하는 페이지.

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 체크 토글을 상단 체크박스 → **하단 sticky CompletionToggleButton**으로 이동. 이유: 상세페이지는 "읽기"가 주목적이고, CTA를 하단에 고정해야 긴 가이드를 다 읽은 뒤 자연스럽게 완료 동작으로 이어짐.
> - 완료 시 우측 상단에 **CompletionStamp**(도장 오버레이) 표시. 체크리스트/이사앱 아이덴티티 강화.

### 화면 구조

```
┌──────────────────────────────────┐
│ ←  항목 상세                      │  ← PageHeader (뒤로가기 + 제목)
├──────────────────────────────────┤
│                                  │
│ [🚚 D-1] [행정] [필수]            │  ← DetailHeader (카드 없음, 순수 섹션)
│ 전입신고 + 확정일자 받기          │     D-day 트럭 칩 + 카테고리/중요도 배지
│ 내일 · 3월 26일 (수)              │     h1 제목 + 상대일자 + 실제 날짜
│                                  │     (완료 시 우측에 CompletionStamp 오버레이)
│                                  │
│ ── 이렇게 하세요 ────────────── │  ← GuideStepsSection
│                                  │
│  1. 정부24 온라인 또는            │     번호 매김 리스트
│     관할 주민센터 방문            │
│  2. 전입신고 + 확정일자 동시 신청 │
│  3. 수수료 없음 (온라인 기준)     │
│                                  │
│ ── 준비물 ───────────────────── │  ← GuideItemsSection
│                                  │
│ ┌──────────────────────────────┐ │     배경 카드 안에 불릿 리스트
│ │ · 본인 신분증                 │ │
│ │ · 임대차계약서 원본           │ │
│ └──────────────────────────────┘ │
│                                  │
│ ── 참고 ─────────────────── ∨  │  ← GuideNoteSection (접힘/펼침)
│                                  │
│  전입신고는 이사 후 14일 이내     │     기본 접힘. 탭하면 펼침.
│  해야 하며, 확정일자는 보증금     │
│  보호를 위한 법적 절차예요.       │
│                                  │
│ ── 바로가기 ────────────────── │  ← RelatedLinkCard
│                                  │
│ ┌──────────────────────────────┐ │     guide_url이 있는 항목만 표시
│ │ 🌐 정부24 (gov.kr)       ↗  │ │     (46개 중 4~5개)
│ │    민원 신청 및 결과 확인     │ │
│ └──────────────────────────────┘ │
│                                  │
│ ── 내 메모 ────────────── ⟳   │  ← MemoSection (우측에 저장 스피너/저장됨)
│                                  │
│ ┌──────────────────────────────┐ │     인라인 textarea + 디바운스 자동 저장
│ │ 이 할 일에 관련된 메모를...   │ │     상태: Loader2 스피너 / "저장됨"
│ └──────────────────────────────┘ │
│                                  │
├──────────────────────────────────┤
│ [ ✓ 완료로 표시 ]                 │  ← CompletionToggleButton (하단 sticky CTA)
└──────────────────────────────────┘
```

### 폴백 규칙 (guide_steps가 없는 항목)

46개 항목 중 명확한 액션 단계가 없는 항목이 있음 (예: "냉장고 식재료 소진 시작").
이 경우:

```
guide_steps가 있으면 → "이렇게 하세요" 섹션 표시
guide_steps가 없으면 → "이렇게 하세요" 섹션 숨김, guide_note 또는 guide_content를 "가이드" 섹션으로 표시
```

**렌더링 우선순위:**

1. `guide_steps` 있으면 → GuideStepsSection 표시
2. `guide_items` 있으면 → GuideItemsSection 표시
3. `guide_note` 있으면 → GuideNoteSection 표시 (steps가 있으면 접힘, 없으면 펼침)
4. 위 3개 모두 없으면 → `guide_content`를 일반 텍스트로 표시 (폴백)
5. `guide_url` 있으면 → RelatedLinkCard 표시
6. 메모 섹션은 항상 표시

---

## 7. 컴포넌트 상세

### 7-1. ChecklistDetailPage

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - DetailHeader에서 `isCompleted`/`onToggle` 제거 → 페이지 하단 `CompletionToggleButton`으로 이동.
> - 완료 시 `CompletionStamp`를 페이지 우측 상단에 오버레이.
> - 섹션 사이에 `SectionDivider`(8px bg-border/50 띠) 삽입 (DetailHeader와 Steps 사이는 제외).
> - 이유: "읽기 → CTA" 흐름으로 상세페이지 정체성 강화, 섹션 리듬 통일(TimelinePage 패턴과 일치).

```typescript
// pages/ChecklistDetailPage.tsx (요지)
export function ChecklistDetailPage() {
  const { itemId } = useParams<{ itemId: string }>()
  const navigate = useNavigate()
  const { data: item, isLoading, isError } = useChecklistItemDetail(itemId!)
  const { data: move } = useCurrentMove()
  const toggleItem = useToggleItem(item?.move_id ?? '')

  if (isLoading) return <DetailSkeleton />
  if (isError || !item) return <ErrorWithRetry message="항목을 불러올 수 없어요" />

  const master = item.master_checklist_items
  const hasSteps = !!master.guide_steps?.length

  return (
    <div className="relative min-h-dvh bg-neutral">
      <PageHeader title="항목 상세" onBack={() => navigate(-1)} />
      {item.is_completed && <CompletionStamp />}
      <div className="px-5 pb-28">
        <DetailHeader
          title={master.title}
          category={master.category}
          guideType={master.guide_type}
          assignedDate={item.assigned_date}
          dDayOffset={master.d_day_offset}
        />
        {hasSteps && <GuideStepsSection steps={master.guide_steps} tip={master.guide_note} />}
        {master.guide_items && (<><SectionDivider /><GuideItemsSection items={master.guide_items} /></>)}
        {!hasSteps && master.guide_note && (<><SectionDivider /><GuideNoteSection note={master.guide_note} /></>)}
        {master.guide_url && (<><SectionDivider /><RelatedLinkCard url={master.guide_url} /></>)}
        <SectionDivider />
        <MemoSection itemId={item.id} initialMemo={item.memo} />
      </div>
      <CompletionToggleButton
        isCompleted={item.is_completed}
        onToggle={() => toggleItem.mutate({ itemId: item.id, isCompleted: !item.is_completed })}
      />
    </div>
  )
}
```

### 7-2. DetailHeader

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 체크박스/onToggle 제거 (CompletionToggleButton으로 이전).
> - 카드 박스(`bg-surface p-4 radius-lg`) 제거 → 배경 없는 순수 섹션. 이유: 본문 카드들과 시각적 중첩 해소, 토스 스타일 미니멀.
> - **D-day 트럭 칩** 추가 (`bg-primary + white` + Truck 아이콘). 이유: 이사앱 아이덴티티 + 카테고리 배지와 시각 위계 분리.
> - 제목: `text-h3` → `text-h1 font-bold` (상세 진입 화면이라 위계 강화).
> - 날짜: `text-caption` → `text-body-sm` (가독성).
> - **과거 항목 임시 처리**: `diffDays < 0`일 때 D-day 칩 숨기고 "지금 해도 괜찮아요"로 날짜 텍스트 대체. TODO — 5단계 스마트 재배치에서 모드별 표시로 교체.

```typescript
interface DetailHeaderProps {
  title: string
  category: string
  guideType: 'tip' | 'warning' | 'critical'
  assignedDate: string // "2026-03-26"
  dDayOffset: number // 1 (D+1)
}
```

**레이아웃:**

```
[🚚 D-1] [행정] [필수]             ← D-day 트럭 칩 + 카테고리 Badge + guide_type Badge
전입신고 + 확정일자 받기            ← h1 제목
내일 · 3월 26일 (수)                ← 상대 날짜 · 실제 날짜
```

**스타일:**

- 배경 없음 (카드 제거)
- D-day 칩: `inline-flex items-center gap-1 rounded-lg bg-primary px-2 py-0.5 text-caption font-bold text-white` + `<Truck size={12} />`
- 제목: `text-h1 font-bold text-secondary break-keep` (mt-3)
- 카테고리 뱃지: `variant="category"` (tertiary 배경, primary 텍스트)
- guide_type 뱃지: critical → `variant="critical"`, warning → `variant="warning"`, tip → 미표시
- 날짜: `text-body-sm text-muted` (mt-2)

**D-day 칩 분기 (과거 항목 임시):**

```typescript
function getDDayTag(diffDays: number, dDayOffset: number): string | null {
  if (diffDays < 0) return null // 과거 → 칩 숨김
  if (diffDays === 0) return 'D-Day'
  if (diffDays === 1) return 'D-1'
  if (dDayOffset === 0) return 'D-DAY'
  if (dDayOffset < 0) return `D${dDayOffset}`
  return `D+${dDayOffset}`
}

function getDateText(diffDays: number, assignedDate: string, dDayOffset: number): string {
  if (diffDays < 0) return '지금 해도 괜찮아요' // 과거 임시
  if (diffDays === 0) return `오늘 · ${formatDateKorean(assignedDate)}`
  if (diffDays === 1) return `내일 · ${formatDateKorean(assignedDate)}`
  return `${getRelativeDateLabel(dDayOffset)} · ${formatDateKorean(assignedDate)}`
}
```

**날짜 표시 규칙:**

```typescript
// packages/shared/src/utils/dateLabel.ts

/**
 * D-Day offset을 상대적 시간 표현으로 변환
 * 3단계 전체 리스트의 그룹핑과 일관된 언어 사용
 */
export function getRelativeDateLabel(dDayOffset: number): string {
  if (dDayOffset <= -21) return '이사 4주 전'
  if (dDayOffset <= -14) return '이사 2~3주 전'
  if (dDayOffset <= -7) return '이사 1~2주 전'
  if (dDayOffset <= -3) return '이사 1주 전'
  if (dDayOffset === -1) return '이사 전날'
  if (dDayOffset === 0) return '이사 당일'
  if (dDayOffset === 1) return '이사 다음 날'
  if (dDayOffset <= 7) return '입주 첫 주'
  return `D${dDayOffset > 0 ? '+' : ''}${dDayOffset}`
}

/**
 * assigned_date를 한국어 날짜 포맷으로 변환
 * @returns "3월 26일 (수)"
 */
export function formatDateKorean(dateStr: string): string {
  const date = new Date(dateStr)
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = ['일', '월', '화', '수', '목', '금', '토'][date.getDay()]
  return `${month}월 ${day}일 (${weekday})`
}
```

> **왜 d_day_offset 기반?**: assigned_date와 moving_date의 차이를 매번 계산하는 것보다,
> 마스터 데이터에 이미 있는 d_day_offset을 사용하는 게 정확하고 심플함.
> 늦게 설치해서 assigned_date가 과거가 되더라도 "이사 다음 날"이라는 맥락은 유효.

### 7-3. GuideStepsSection

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 번호 매김 리스트 → **Toss Stepper 스타일**(원형 번호 배지 + 세로 연결선).
> - 섹션 제목 아이콘(`ClipboardCheck`) 제거 → 텍스트만 `text-h3 font-semibold`.
> - `tip` prop 추가 → Steps가 있을 때는 `guide_note`를 하단 `TipCard`로 병합 표시(별도 섹션 안 만듦).
> - 이유: AI 느낌 제거, 토스 가이드 톤, 섹션 분절 최소화.

```typescript
interface GuideStepsSectionProps {
  steps: string[]
  tip?: string | null // guide_note, 있으면 하단 TipCard로 표시
}
```

**스타일:**

- 섹션 제목: `SectionTitle`로 "이렇게 하세요" (h3 semibold)
- 번호 배지: `h-7 w-7 rounded-full bg-tertiary text-primary font-bold text-body-sm`
- 연결선: `w-0.5 flex-1 bg-border`, `my-1.5` (원과 떨어뜨림)
- 본문 텍스트: `text-body leading-relaxed text-secondary break-keep`, 마지막 아닌 항목은 `pb-5`
- 하단 Tip: `<TipCard body={tip} className="mt-7" />`

### 7-4. GuideItemsSection

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 제목 "준비물" → **"미리 준비할 것"** (이사/짐 챙기기 UX 톤).
> - 불릿 리스트(`bg-tertiary/30` 배경 카드) → **체크 가능한 로컬 체크리스트** (짐 챙기듯 하나씩 체크).
> - 컨테이너 배경 제거 (카드 없음).
> - 이유: 읽기만 하는 정적 목록보다 "준비하면서 체크" UX가 이사앱 아이덴티티에 맞음. 로컬 상태(서버 저장 X).

```typescript
interface GuideItemsSectionProps {
  items: string[]
}
```

**동작:**

- `packed: Set<number>` 로컬 상태로 체크 토글.
- 서버 저장 안 함 (세션 내 일시적 표시).

**스타일:**

- 섹션 제목: `SectionTitle`로 "미리 준비할 것" (카운터 없음)
- 체크박스: `h-6 w-6 rounded-md border-[1.5px]`, 체크 시 `border-primary bg-primary` + 흰색 Check 아이콘
- 텍스트: `text-body text-secondary`, 체크 시 `text-placeholder line-through`

### 7-5. GuideNoteSection

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 접힘/펼침 아코디언 제거 → **항상 펼침**.
> - 내부 구현 → `TipCard` 래퍼로 단순화.
> - 렌더링 조건 변경: **Steps가 없을 때만** 독립 섹션으로 표시. Steps가 있으면 `GuideStepsSection`의 `tip` prop으로 병합.
> - `fallbackContent`(guide_content) 폴백 제거 — 시드 데이터에서 guide_note 채워졌음.
> - 이유: 접힘 UX는 "숨기고 싶은 정보" 뉘앙스를 주는데, 팁은 오히려 바로 보이는 편이 유용.

```typescript
interface GuideNoteSectionProps {
  note: string
}
```

**스타일:**

- `TipCard` 단일 래핑 (섹션 제목 없음 — TipCard 자체에 Tip 라벨이 있음)

### 7-6. RelatedLinkCard

```typescript
interface RelatedLinkCardProps {
  url: string // "https://www.gov.kr"
}
```

**레이아웃:**

```
┌──────────────────────────────────┐
│ 🌐  정부24 (gov.kr)          ↗  │
│     민원 신청 및 결과 확인       │
└──────────────────────────────────┘
```

**동작:**

- 클릭 시 `window.open(url, '_blank')` — 외부 브라우저에서 열기
- 9단계 Expo에서는 `Linking.openURL(url)` 또는 네이티브 브릿지로 전환

**사이트 정보 매핑:**
guide_url이 있는 항목이 4~5개뿐이므로 하드코딩 매핑:

```typescript
// packages/shared/src/constants/linkMeta.ts
export const LINK_META: Record<string, { name: string; description: string }> = {
  'gov.kr': { name: '정부24', description: '민원 신청 및 결과 확인' },
  '15990903.or.kr': { name: '폐가전 무상수거', description: '전자제품 무상 방문 수거 예약' },
  // ... 나머지 링크들
}

/**
 * URL에서 도메인을 추출하고 매핑된 정보 반환
 * 매핑 없으면 도메인명을 그대로 사용
 */
export function getLinkMeta(url: string): { name: string; description: string } {
  const domain = new URL(url).hostname.replace('www.', '')
  return LINK_META[domain] ?? { name: domain, description: url }
}
```

> **왜 Open Graph를 안 가져오나?**: OG 메타를 가져오려면 서버사이드 프록시가 필요 (CORS).
> 4~5개 링크에 서버 프록시를 만드는 건 오버엔지니어링. 하드코딩이 더 빠르고 안정적.

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 섹션 제목 "관련 링크" → **"바로가기"** (짧고 직관적).
> - 좌측 `Globe` 아이콘을 `bg-tertiary` 정사각 뱃지 안에 배치 (시각 강조).
> - 섹션 제목 좌측 `Link` 아이콘 제거 (SectionTitle 통일).

**스타일:**

- 섹션 제목: `SectionTitle`로 "바로가기" (h3 semibold)
- 컨테이너: `bg-surface`, `ring-1 ring-border`, `rounded-xl`, `p-4`
- 좌측 아이콘 박스: `bg-tertiary rounded-lg` 안에 `Globe` (primary)
- 사이트명: `text-body font-semibold text-secondary`
- 설명: `text-body-sm text-muted`
- 우측: `ExternalLink` (16px, muted)

### 7-7. MemoSection

```typescript
interface MemoSectionProps {
  itemId: string
  initialMemo: string | null
}
```

**동작 — 3중 저장 트리거:**

```
1. 입력 중 → debounce 1초 후 자동 저장 (핵심 트리거)
2. textarea blur → 즉시 저장 (핵심 트리거)
3. 페이지 이탈 → 마지막 값 저장 (best-effort)
```

**구현 의사코드:**

```typescript
export function MemoSection({ itemId, initialMemo }: MemoSectionProps) {
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const updateMemo = useUpdateMemo(itemId)
  const lastSavedRef = useRef(initialMemo ?? '')

  // 디바운스 저장 (1초)
  const debouncedSave = useDebouncedCallback((value: string) => {
    if (value === lastSavedRef.current) return // 변경 없으면 스킵
    setSaveStatus('saving')
    updateMemo.mutate(value, {
      onSuccess: () => {
        lastSavedRef.current = value
        setSaveStatus('saved')
      },
      onError: () => {
        toast.error('메모 저장에 실패했어요')
        setSaveStatus('idle')
      },
    })
  }, 1000)

  // blur 시 즉시 저장
  function handleBlur() {
    debouncedSave.flush() // 대기 중인 디바운스 즉시 실행
  }

  // 페이지 이탈 시 저장 (best-effort)
  useEffect(() => {
    return () => {
      if (memo !== lastSavedRef.current) {
        updateItemMemo(itemId, memo) // fire-and-forget
      }
    }
  }, [memo])

  return (/* ... */)
}
```

> **왜 useDebouncedCallback?**: `lodash.debounce` 또는 직접 구현 대신
> `use-debounce` 패키지의 `useDebouncedCallback`이 React 라이프사이클과 잘 맞음.
> flush(), cancel() 메서드를 제공해서 blur/unmount 시 즉시 실행 가능.

**추가 패키지:**

```bash
cd apps/web
pnpm add use-debounce
```

> ⚠️ 4단계 폴리싱에서 변경됨 (원본 설계와 차이)
>
> - 섹션 제목 "메모" → **"내 메모"** + `Pencil` 아이콘 제거 (SectionTitle 통일).
> - 저장 상태 위치: textarea 하단 → **SectionTitle 우측 슬롯**.
> - `saving` 표시: "저장 중..." 텍스트 → **Loader2 스피너** (토스 스타일).
> - `saved`: "저장됨" (success 색), 2초 후 idle.
> - placeholder 변경: "이 할 일에 관련된 메모를 남겨보세요".

**저장 상태 표시 (SectionTitle 우측 슬롯):**

- `idle`: 표시 없음
- `saving`: `<Loader2 size={16} className="animate-spin text-muted" />`
- `saved`: `<span className="text-success">저장됨</span>` — 2초 후 idle

**스타일:**

- 섹션 제목: `<SectionTitle right={statusIndicator}>내 메모</SectionTitle>`
- textarea: `bg-surface ring-1 ring-border rounded-xl px-4 py-3.5`, 포커스 시 `ring-[1.5px] ring-primary`
- placeholder: "이 할 일에 관련된 메모를 남겨보세요"
- 폰트: `text-body leading-relaxed text-secondary`
- 최소 높이: `min-h-24`
- auto-resize: scrollHeight 기반 자동 확장

**auto-resize 구현:**

```typescript
function handleInput(e: React.FormEvent<HTMLTextAreaElement>) {
  const target = e.currentTarget
  target.style.height = 'auto'
  target.style.height = `${target.scrollHeight}px`
}
```

### 7-8. TipCard (신규 — 폴리싱에서 추가)

> ⚠️ 4단계 폴리싱에서 추가됨. GuideStepsSection과 GuideNoteSection에서 중복되던 팁 블록을 공통화.

```typescript
interface TipCardProps {
  body: string
  className?: string
}
```

**스타일:**

- 컨테이너: `rounded-xl bg-tertiary/50 px-4 py-3.5`
- 상단 라벨: `Lightbulb`(13px, primary, `fill="currentColor"`) + `Tip` (`text-caption font-bold uppercase tracking-wider text-primary`)
- 본문: `whitespace-pre-line text-body-sm leading-relaxed text-secondary`

### 7-9. SectionTitle (신규 — 폴리싱에서 추가)

> ⚠️ 4단계 폴리싱에서 추가됨. 섹션 제목 타이포/여백 통일 + 우측 슬롯 지원(MemoSection 저장 상태 등).
> 원본 스펙의 `text-body` 제목 → 전체 페이지가 왜소해 보여 `text-h3`로 상향.

```typescript
interface SectionTitleProps {
  children: React.ReactNode
  right?: React.ReactNode
}
```

**스타일:**

- 기본: `<h2 className="mb-4 text-h3 font-semibold text-secondary">`
- `right` 있을 때: `<div className="mb-3 flex items-center justify-between">` + h3 + right

### 7-10. CompletionStamp (신규 — 폴리싱에서 추가)

> ⚠️ 4단계 폴리싱에서 추가됨. 완료된 항목임을 시각적으로 강하게 표시(도장 메타포 → 이사앱/체크리스트 아이덴티티).

**스타일:**

- `pointer-events-none absolute right-6 top-20 z-10`
- `h-[92px] w-[92px] rotate-[-14deg] rounded-full border-[3px] border-success text-success opacity-80`
- 내용: `<Check size={22} strokeWidth={3.5} />` + `완료` (`text-[22px] font-black`)
- a11y: `aria-label="완료된 할 일"`

### 7-11. CompletionToggleButton (신규 — 폴리싱에서 추가)

> ⚠️ 4단계 폴리싱에서 추가됨. 원본 스펙의 상단 체크박스 토글을 하단 sticky CTA로 대체.

```typescript
interface CompletionToggleButtonProps {
  isCompleted: boolean
  onToggle: () => void
}
```

**스타일:**

- 위치: 하단 sticky (페이지 max-width 내, 좌우 패딩 맞춤)
- 미완료: `bg-primary text-white` + `Check` 아이콘 + "완료로 표시"
- 완료: `bg-surface ring-1 ring-border text-secondary` + `RotateCcw` 아이콘 + "다시 할 일로 되돌리기"
- 높이: `h-[52px] rounded-xl text-body font-semibold`

### 7-12. SectionDivider (신규 — 폴리싱에서 추가)

> ⚠️ 4단계 폴리싱에서 추가됨. 섹션 간 리듬 통일 (TimelinePage와 동일 패턴).

**스타일:**

- `aria-hidden`, `-mx-5 my-7 h-3 bg-border/50`

---

## 8. 토스트 컴포넌트 (직접 구현)

### 설계 방향

- 포트폴리오 어필: "커스텀 토스트 구현" (portal + 애니메이션 + 자동 닫힘)
- component-design-spec.md의 Toast 스펙 준수
- 사용 범위가 단순 (성공/에러 2종류, 동시 1개)하므로 라이브러리 불필요

### Toast.tsx

```typescript
interface ToastData {
  id: string
  variant: 'success' | 'error' | 'info'
  message: string
}
```

**스타일 (component-design-spec.md 기준):**

- 위치: 상단 중앙, 페이지 max-width 내
- 패딩: 12px 16px
- radius: 12px
- 배경: secondary (어두운 토스트 — 토스 스타일)
- 텍스트: white, 14px/500
- 아이콘: 좌측 16px — success=`Check` (success 색), error=`X` (critical 색), info=`Info` (white)
- 그림자: shadow-md
- 진입: transform Y(-100%) → Y(0), 250ms, ease-out
- 퇴장: opacity 1 → 0, 150ms, ease-in
- 자동 닫힘: 3초
- z-index: 9999 (모든 UI 위에)

### ToastProvider.tsx

```typescript
// Context + Portal 기반
interface ToastContextType {
  toast: {
    success: (message: string) => void
    error: (message: string) => void
    info: (message: string) => void
  }
}
```

**구현 포인트:**

- `createPortal`로 `document.body`에 렌더링
- 토스트 큐는 최대 1개 (새 토스트 뜨면 이전 것 즉시 제거 — 스태킹 불필요)
- `setTimeout` 3초 후 자동 제거
- CSS transition으로 진입/퇴장 애니메이션
- `prefers-reduced-motion: reduce` 시 애니메이션 비활성화

**race condition 방지 (필수):**

빠르게 여러 번 호출 시 `setTimeout`이 중첩되면 토스트가 깜빡이거나 타이밍이 꼬임.
새 토스트를 띄우기 전 기존 타이머를 반드시 정리:

```typescript
// ToastProvider 내부
const timeoutRef = useRef<number>()

function showToast(data: Omit<ToastData, 'id'>) {
  // 기존 타이머 정리 (race condition 방지)
  if (timeoutRef.current) {
    clearTimeout(timeoutRef.current)
  }

  const id = crypto.randomUUID()
  setToast({ ...data, id })

  timeoutRef.current = window.setTimeout(() => {
    setToast(null)
  }, 3000)
}

// 컴포넌트 unmount 시 타이머 정리 (메모리 누수 방지)
useEffect(() => {
  return () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
  }
}, [])
```

> **왜 이게 필요?**: 체크 토글을 빠르게 연타하면 success → error → success 토스트가
> 연속 호출됨. `clearTimeout` 없으면 이전 3초 타이머가 살아있어서
> 새 토스트가 뜬 지 1초 만에 사라지는 버그 발생.

**사용법:**

```typescript
// App.tsx에 Provider 추가
<ToastProvider>
  <RouterProvider />
</ToastProvider>

// 컴포넌트에서 사용
const { toast } = useToast()
toast.success('체크 완료!')
toast.error('저장에 실패했어요')
```

### 3단계 코드 토스트 전환

3단계에서 `console.error`로 처리했던 곳을 토스트로 교체:

- `useToggleItem` onError → `toast.error('체크 상태 변경에 실패했어요')`
- `useUpdateMove` onError → `toast.error('이사 정보 수정에 실패했어요')`
- `useUpdateMove` onSuccess → `toast.success('이사 정보가 수정되었어요')`

---

## 9. 접근성 (a11y)

> ⚠️ 4단계 폴리싱에서 변경됨: DetailHeader 체크박스 제거 → CompletionToggleButton/CompletionStamp로 분리.

- CompletionToggleButton: `<button aria-pressed={isCompleted}>` + 라벨 텍스트 자체가 동작 설명
- CompletionStamp: `aria-label="완료된 할 일"` (pointer-events-none)
- GuideStepsSection: `<ol role="list">` + `<li>` (시맨틱 번호 리스트)
- GuideItemsSection: `<ul role="list">` + 각 항목 `<button aria-pressed={isPacked}>` (체크 가능)
- GuideNoteSection: TipCard 래퍼, 정적 표시 (접힘 UI 없음)
- RelatedLinkCard: `<a href={url} target="_blank" rel="noopener noreferrer" aria-label="{siteName} 열기">`
- MemoSection textarea: `<textarea aria-label="메모 입력">`
- 저장 상태: `<span role="status" aria-live="polite" aria-label="저장 중 | 저장됨">` (SectionTitle 우측 슬롯)
- Toast: `role="alert"` + `aria-live="assertive"`
- PageHeader 뒤로가기: `aria-label="뒤로 가기"`

---

## 10. 스켈레톤 / 로딩 / 에러

### DetailSkeleton

```
┌──────────────────────────────────┐
│ ←  항목 상세                      │
├──────────────────────────────────┤
│ ┌──────────────────────────────┐ │
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓        │ │  ← 제목 스켈레톤
│ │ ▓▓▓▓▓   ▓▓▓                  │ │  ← 뱃지 스켈레톤
│ │ ▓▓▓▓▓▓▓▓▓▓▓                  │ │  ← 날짜 스켈레톤
│ └──────────────────────────────┘ │
│                                  │
│ ▓▓▓▓▓▓▓▓▓▓▓▓                    │  ← 섹션 제목 스켈레톤
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓      │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓            │
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓          │
└──────────────────────────────────┘
```

- 3단계 Skeleton 컴포넌트 재사용
- 0.3초 이내 응답 시 스켈레톤 미표시 (깜빡임 방지)

### 에러 상태

- 데이터 조회 실패: "항목을 불러올 수 없어요" + 재시도 버튼
- 존재하지 않는 itemId: 동일한 에러 UI → 뒤로가기 유도
- 메모 저장 실패: `toast.error('메모 저장에 실패했어요')` + 캐시 롤백

---

## 11. 엣지케이스 / 주의사항

### 유효하지 않은 itemId

- URL에 잘못된 UUID → `getChecklistItemDetail`이 에러 throw → 에러 UI 표시
- UUID 형식이지만 존재하지 않는 ID → `.single()`이 에러 → 동일하게 처리

### 이사 데이터 없음 (비정상 접근)

- `/checklist/:itemId` 직접 접근 + active 이사 없음 → 랜딩으로 리다이렉트
- 3단계 대시보드 진입 가드와 동일한 패턴

### 메모 동시 편집 (같은 항목을 여러 탭에서)

- 현실적으로 발생하지 않음 (1인 사용)
- 만약 발생하면: last-write-wins (마지막 저장이 우선)

### 메모 빈 문자열

- 유저가 메모를 지우면 → `memo = ''`으로 저장 (null이 아님)
- 표시 시: 빈 문자열이면 placeholder 표시

### guide_steps / guide_items / guide_note 모두 null

- `guide_content`가 있으면 → 일반 텍스트로 표시 ("가이드" 섹션 제목)
- `guide_content`도 null이면 → 가이드 섹션 전체 숨김 (이론적으로 불가능)

### 관련 링크 접근 불가

- 외부 URL이 깨져있는 경우 → 앱에서 제어 불가 (브라우저에서 에러 표시)
- 링크 카드에 "외부 사이트로 이동해요" 안내 불필요 (↗ 아이콘으로 충분)

### 오프라인

- 2단계 `useOnlineStatus` + `OfflineBanner` 재사용
- 오프라인 시: 메모 저장 비활성 + textarea readonly + "인터넷 연결 시 저장돼요" 안내
- 데이터 조회: TanStack Query 캐시에서 표시 가능 (이전에 방문한 항목)

### 체크 토글과 메모 동시 요청

- 체크 토글 (useToggleItem)과 메모 저장 (useUpdateMemo)은 독립적인 mutation
- 동시에 호출돼도 각각 다른 필드를 업데이트하므로 충돌 없음

### 뒤로가기 시 캐시 무효화

- 상세에서 체크를 토글하고 뒤로가면 → 대시보드/전체 리스트의 캐시가 stale
- `useToggleItem`의 `onSettled`에서 이미 `todayItems` + `timelineItems` invalidate 처리됨 (3단계)
- `detailKeys.item(itemId)`도 invalidate 필요 → `onSettled`에 추가

---

## 12. 완료 확인 기준 (체크리스트)

> ⚠️ 4단계 폴리싱 반영: 체크박스 토글 → CompletionToggleButton, 접힘 Note → TipCard 래퍼, "준비물" → "미리 준비할 것" 체크리스트, Toss Stepper 등.

### 빌드/DB

- [ ] `npx supabase db push` → 마이그레이션 적용 성공 (guide_steps, guide_items, guide_note, guide_url 컬럼)
- [ ] 시드 데이터 업데이트 → 46개 항목 guide_steps/items/note 채워짐
- [ ] `pnpm build` — 성공
- [ ] `pnpm lint` — 에러 0
- [ ] `use-debounce` 패키지 설치 확인

### 라우팅/진입

- [ ] ChecklistDetailPage 파일 존재 + `/checklist/:itemId` 라우트 등록
- [ ] 대시보드/타임라인에서 항목 클릭 → 상세 이동

### DetailHeader (상단)

- [ ] 카드 박스 없음 (배경 없는 순수 섹션)
- [ ] D-day 트럭 칩 (`bg-primary` + white + Truck 아이콘) + 카테고리/중요도 Badge
- [ ] 제목 `text-h1 font-bold`
- [ ] 날짜 `text-body-sm text-muted`, "내일 · 3월 26일 (수)" 형식
- [ ] 과거 항목(diffDays < 0): D-day 칩 숨김 + "지금 해도 괜찮아요" 표시

### 가이드 섹션

- [ ] GuideStepsSection: Toss Stepper (원형 번호 `bg-tertiary` + `w-0.5 bg-border` 세로선 `my-1.5` 간격)
- [ ] Steps 있을 때 guide_note는 Steps 하단 TipCard로 병합 표시 (별도 섹션 X)
- [ ] GuideItemsSection: 제목 "미리 준비할 것", 로컬 체크 토글 동작, 체크 시 line-through
- [ ] GuideNoteSection: Steps 없을 때만 독립 TipCard로 표시 (접힘/펼침 UI 없음)
- [ ] RelatedLinkCard: 제목 "바로가기", 좌측 Globe 아이콘 박스, 클릭 시 새 탭 열기

### 메모

- [ ] 섹션 제목 "내 메모"
- [ ] 인라인 textarea 렌더링, placeholder "이 할 일에 관련된 메모를 남겨보세요"
- [ ] 입력 1초 후 자동 저장 (디바운스)
- [ ] blur 시 즉시 저장
- [ ] 저장 중: `Loader2` 스피너 (SectionTitle 우측), 저장 후: "저장됨" (success 색), 2초 뒤 사라짐
- [ ] textarea auto-resize

### 완료 CTA / 스탬프

- [ ] CompletionToggleButton 하단 sticky 표시
- [ ] 미완료: primary CTA "완료로 표시", 완료: surface + ring "다시 할 일로 되돌리기"
- [ ] 완료 시 우측 상단에 CompletionStamp(원형 도장, -14deg 회전) 오버레이

### 레이아웃

- [ ] 섹션 간 SectionDivider(8px bg-border/50) 적용 (DetailHeader↔Steps 사이는 제외)
- [ ] 페이지 하단에 CTA 높이만큼 padding (`pb-28`)

### 토스트

- [ ] success / error / info 3종 동작, 3초 자동 닫힘, 진입/퇴장 애니메이션
- [ ] 3단계 console.error → toast.error 전환 (useToggleItem, useUpdateMove)

### 스켈레톤/에러

- [ ] 로딩 시 DetailSkeleton 표시
- [ ] 에러 상태 UI (재시도 버튼)

### 접근성

- [ ] CompletionToggleButton `aria-pressed`
- [ ] CompletionStamp `aria-label="완료된 할 일"`
- [ ] 리스트 시맨틱 (`role="list"`), 메모 `role="status" aria-live="polite"`
- [ ] Toast `role="alert" aria-live="assertive"`

---

## 13. 다음 단계 연결

4단계 완료 후 → **5단계: 스마트 재배치 (4모드)** (`docs/specs/05-smart-replace.md`)

- 빠듯/급한/초급한 모드 UI 분기
- 모드별 텍스트/진행률 변경
- DB 변경 없음 — 프론트 표시 레이어에서 처리
