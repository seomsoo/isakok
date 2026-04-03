# 2단계: 온보딩 → 체크리스트 생성 스펙 (SDD)

> 목표: 랜딩 → 온보딩 3스텝 폼 → createMoveWithChecklist RPC 호출 → 대시보드 이동
> 이 단계가 끝나면: 유저가 이사 정보를 입력하고, 맞춤 체크리스트가 생성되어 대시보드(빈 화면)로 이동하는 상태

---

## 0. 이 단계에서 하는 것 / 안 하는 것

### 하는 것

- react-router-dom 설치 + 라우팅 설정 (5개 라우트)
- @tanstack/react-query 설치 + QueryClientProvider
- 랜딩 페이지 (CTA → 온보딩 진입)
- 온보딩 3스텝 폼 (이사일 → 주거유형 → 계약유형+이사방법)
- createMoveWithChecklist RPC 호출 서비스 함수
- 온보딩 완료 → 대시보드 라우트로 이동 (대시보드 UI는 3단계)
- 공통 컴포넌트: Button, ProgressBar
- Zustand 설치 + 온보딩 폼 상태 관리

### 안 하는 것

- 대시보드/타임라인/설정 UI (3단계)
- 항목 상세 (4단계)
- 비회원 로컬 저장 IndexedDB (8단계)
- 소셜 로그인 UI (8단계)
- 애니메이션/트랜지션 (기능 완성 후 폴리싱)
- 하단 탭바 (3단계 — 대시보드와 함께)

---

## 1. 폴더 구조 (이 단계에서 생성/수정하는 파일)

```
apps/web/src/
├── App.tsx                              ← 수정 (라우터 설정)
├── main.tsx                             ← 수정 (QueryClientProvider 추가)
│
├── pages/
│   ├── LandingPage.tsx                  ← 생성
│   ├── OnboardingPage.tsx               ← 생성
│   └── DashboardPage.tsx                ← 생성 (플레이스홀더 — 3단계에서 구현)
│
├── features/
│   └── onboarding/
│       ├── components/
│       │   ├── StepMovingDate.tsx        ← 생성 (1/3 이사일 선택)
│       │   ├── StepHousingType.tsx       ← 생성 (2/3 주거유형 선택)
│       │   ├── StepContractAndMove.tsx   ← 생성 (3/3 계약유형 + 이사방법)
│       │   ├── CalendarPicker.tsx        ← 생성 (캘린더 컴포넌트)
│       │   ├── HousingTypeGrid.tsx       ← 생성 (5개 카드 그리드)
│       │   ├── SelectionChip.tsx         ← 생성 (필/칩 선택 UI)
│       │   └── CheckTip.tsx             ← 생성 (하단 팁 카드)
│       └── hooks/
│           └── useCreateMove.ts          ← 생성 (RPC mutation 훅)
│
├── shared/
│   └── components/
│       ├── Button.tsx                    ← 생성 (공통 버튼)
│       ├── ProgressBar.tsx              ← 생성 (3단계 프로그레스)
│       └── OfflineBanner.tsx            ← 생성 (오프라인 안내 배너)
│
├── shared/
│   └── hooks/
│       └── useOnlineStatus.ts           ← 생성 (navigator.onLine 감지)
│
├── services/
│   └── move.ts                          ← 생성 (createMoveWithChecklist)
│
├── stores/
│   └── onboardingStore.ts               ← 생성 (Zustand — 폼 상태)
│
└── lib/
    └── queryClient.ts                   ← 생성 (TanStack Query 설정)
```

---

## 2. 패키지 설치

```bash
cd apps/web
pnpm add react-router-dom @tanstack/react-query zustand react-day-picker date-fns
```

> **왜 react-day-picker?**: 캘린더는 엣지케이스가 많음 (윤년, 로케일, 키보드 접근성 등).
> 직접 구현하면 버그 잡는 데 시간을 뺏기고, 면접관도 "왜 바퀴를 다시 만들었지?"라고 볼 수 있음.
> react-day-picker는 가볍고(~10KB), Tailwind 커스텀 쉽고, a11y 기본 내장.
> date-fns는 날짜 유틸용 (react-day-picker 의존성이기도 함).
>
> **왜 Zustand을 여기서?**: 온보딩 3스텝 간에 폼 데이터를 공유해야 함.
> 스텝 1에서 선택한 이사일이 스텝 3 완료 시 RPC 호출에 포함되어야 하니까.
> URL 파라미터나 props drilling보다 스토어가 깔끔함.
> TanStack Query는 서버 데이터용, Zustand은 UI/폼 상태용 — 역할이 다름.

---

## 3. 라우팅 설정

### App.tsx

```typescript
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ROUTES } from '@shared/constants/routes'
import { LandingPage } from '@/pages/LandingPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route path={ROUTES.LANDING} element={<LandingPage />} />
          <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />
          <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
          {/* 3단계에서 추가: TIMELINE, CHECKLIST_DETAIL, PHOTOS, SETTINGS */}
          <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
```

> **왜 BrowserRouter?**: WebView 앱이라 hash 라우팅 불필요.
> Vercel 배포 시 `rewrites` 설정으로 SPA 라우팅 처리하면 됨.

### lib/queryClient.ts

```typescript
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5, // 5분
      refetchOnWindowFocus: false, // WebView에서는 불필요
    },
  },
})
```

> **왜 refetchOnWindowFocus: false?**: WebView 앱이라 탭 전환 개념이 없음.
> 브라우저 개발 시에도 탭 전환마다 refetch 되면 불필요한 네트워크 요청 발생.

---

## 4. Zustand 온보딩 스토어

### stores/onboardingStore.ts

```typescript
import { create } from 'zustand'
import type { HousingType, ContractType, MoveType } from '@shared/types/move'

interface OnboardingState {
  /** 현재 스텝 (1, 2, 3) */
  step: number
  /** 이사 예정일 (YYYY-MM-DD) */
  movingDate: string | null
  /** 주거 유형 */
  housingType: HousingType | null
  /** 계약 유형 */
  contractType: ContractType | null
  /** 이사 방법 */
  moveType: MoveType | null

  // 액션
  setStep: (step: number) => void
  setMovingDate: (date: string) => void
  setHousingType: (type: HousingType) => void
  setContractType: (type: ContractType) => void
  setMoveType: (type: MoveType) => void
  reset: () => void
}

const initialState = {
  step: 1,
  movingDate: null,
  housingType: null,
  contractType: null,
  moveType: null,
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setMovingDate: (date) => set({ movingDate: date }),
  setHousingType: (type) => set({ housingType: type }),
  setContractType: (type) => set({ contractType: type }),
  setMoveType: (type) => set({ moveType: type }),
  reset: () => set(initialState),
}))
```

> **왜 Zustand이 적합?**: 3스텝 폼에서 스텝 간 데이터 공유가 필요.
> useState를 OnboardingPage에 두고 props drilling → 스텝 컴포넌트가 많아지면 번거로움.
> Context API → 불필요한 리렌더링 (selector 없음).
> Zustand → selector로 필요한 값만 구독, 보일러플레이트 최소.

---

## 5. 랜딩 페이지

### pages/LandingPage.tsx

Stitch 디자인 기반. 구조:

```
┌─────────────────────────────┐
│    🏠 이사콕 (로고+텍스트)    │  ← 상단 헤더
├─────────────────────────────┤
│                             │
│     [일러스트 이미지 영역]     │  ← 이사 준비하는 사람 일러스트
│                             │
├─────────────────────────────┤
│   이사일만 입력하면           │  ← 메인 카피 (bold, 큰 텍스트)
│   할 일이 알아서 정리돼요     │
│                             │
│   D-30부터 입주 후까지,      │  ← 서브 카피 (secondary 색상)
│   빠뜨리는 것 없이           │
├─────────────────────────────┤
│  ┌─────────────────────┐    │
│  │   이사 시작하기       │    │  ← CTA 버튼 (primary, 큰 사이즈)
│  │   가입 없이 바로 시작  │    │     → /onboarding 으로 이동
│  └─────────────────────┘    │
│                             │
│  이미 시작한 이사가 있나요?   │  ← 로그인 링크 (8단계에서 연동)
│  로그인                      │
└─────────────────────────────┘
```

**구현 노트:**

- 일러스트: 2단계에서는 플레이스홀더 (Teal 배경 + 아이콘). 실제 일러스트는 디자인 폴리싱 단계에서 교체
- "이사 시작하기" 클릭 → `navigate(ROUTES.ONBOARDING)`
- "로그인" 링크 → 8단계에서 로그인 모달로 연결. 2단계에서는 `console.log('TODO: 로그인')` + 비활성 스타일
- 앱 이름: "이사콕" (Stitch에 "이사체크"로 되어있으나 변경 확정)

---

## 6. 온보딩 페이지 + 3스텝 폼

### pages/OnboardingPage.tsx

스텝 전환 로직을 관리하는 페이지 컴포넌트.

```typescript
// 의사코드
export function OnboardingPage() {
  const { step } = useOnboardingStore()

  return (
    <div>
      <OnboardingHeader />    {/* 뒤로가기 + "진행 단계 (N/3)" + ProgressBar */}
      {step === 1 && <StepMovingDate />}
      {step === 2 && <StepHousingType />}
      {step === 3 && <StepContractAndMove />}
    </div>
  )
}
```

**온보딩 헤더 구조:**

```
┌──────────────────────────────┐
│ ← (뒤로)   진행 단계 (1/3)    │
├──────────────────────────────┤
│ ████████░░░░░░░░░░░░░░░░░░░  │  ← ProgressBar (1/3 채워짐)
└──────────────────────────────┘
```

- 뒤로가기: 스텝 1이면 랜딩으로, 스텝 2/3이면 이전 스텝으로
- ProgressBar: 3칸 중 현재 스텝까지 Teal로 채움

---

### 6-1. 스텝 1/3: 이사일 선택 (StepMovingDate)

```
┌──────────────────────────────┐
│ 이사 예정일이                  │  ← 질문 (bold, 큰 텍스트)
│ 언제예요?                     │
│                              │
│ 날짜 기준으로 할 일을          │  ← 설명 (secondary)
│ 자동 배치해드려요              │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │  2026년 4월          < > │ │  ← 월 네비게이션
│ │  일 월 화 수 목 금 토     │ │
│ │        1  2  3  4        │ │
│ │  5  ⚫ 7  8  9  ● 11    │ │  ← 오늘(6일)=점 표시, 선택(10일)=Teal 원
│ │  12 13 14 15 16 17 18    │ │
│ │  19 20 21 22 23 24 25    │ │
│ │  26 27 28 29 30          │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │      다음 →             │  │  ← 날짜 미선택 시 비활성 (opacity + disabled)
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**CalendarPicker 스펙 (react-day-picker 기반):**

- `react-day-picker` 사용 (a11y 내장 + 키보드 네비게이션 기본 지원)
- Tailwind로 커스텀 스타일링 (Stitch 디자인에 맞게)
- 선택 가능 범위: 과거 14일 ~ 미래 90일 (`rangeStart = addDays(today, -14)`, `rangeEnd = addDays(today, 90)`)
  - 과거 14일 허용: 이사 당일/직후 앱 설치 사용자도 D+7 항목(전입신고 등) 활용 가능
  - 미래 90일 제한: 체크리스트 D-30~D+7 범위에서 90일이면 충분. 그 이상은 계획 미확정
- 범위 밖 날짜: `disabled` (회색 + 클릭 불가)
- 오늘: 날짜 아래 작은 점 (Teal) — CSS `::after` pseudo-element
- 선택된 날짜: Teal 배경 원 + 흰색 텍스트
- 월 이동: < > 화살표 (범위 내에서만 이동 가능)
- 한국어 로케일: `date-fns/locale/ko` 적용 (요일 한글 표시)
- 반환값: `YYYY-MM-DD` 문자열 (`format(date, 'yyyy-MM-dd')`)

> **왜 직접 구현 안 하나?**: 캘린더는 엣지케이스 덩어리 (윤년, 월 경계, 키보드 접근성, 터치 등).
> 직접 만들면 버그 잡는 데 하루 이상 소모. 그 시간에 스마트 재배치/AI 가이드 같은
> 도메인 로직을 구현하는 게 포트폴리오에 훨씬 인상적.
> 면접에서도 "왜 라이브러리 썼나?" → "핵심 기능에 시간 투자하려고" = 좋은 판단력.

**다음 버튼:**

- 날짜 선택 전: 비활성 (bg-primary/50, cursor-not-allowed)
- 날짜 선택 후: 활성 (bg-primary, hover 효과)
- 클릭 시: `setMovingDate(date)` → `setStep(2)`

---

### 6-2. 스텝 2/3: 주거유형 선택 (StepHousingType)

```
┌──────────────────────────────┐
│ 어떤 집에서 이사하세요?        │  ← 질문
│                              │
│ 주거 유형에 맞는              │  ← 설명
│ 체크리스트를 만들어드려요      │
├──────────────────────────────┤
│ ┌──────────┐ ┌─────────┐    │
│ │    🏠    │ │ 오피스텔  │    │  ← 왼쪽 큰 카드(원룸) + 오른쪽 위
│ │          │ ├─────────┤    │
│ │   원룸   │ │  빌라    │    │  ← 오른쪽 중간
│ │          │ ├─────────┤    │
│ ├──────────┤ │  아파트   │    │  ← 오른쪽 아래
│ │  투룸+   │ └─────────┘    │  ← 왼쪽 아래 작은 카드
│ └──────────┘                │
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ 💡 Check Tip             │ │  ← 팁 카드 (연한 배경)
│ │ 가구 수와 면적에 따라     │ │
│ │ 이사 비용이 달라질 수     │ │
│ │ 있어요.                  │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │      다음 →             │  │
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**HousingTypeGrid 레이아웃 (CSS Grid):**

```css
/* 전체 그리드: 2열 */
.housing-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

/* 원룸 카드: 왼쪽 열, 2행 차지 */
.housing-card-primary {
  grid-row: span 2;
}

/* 나머지 4개: 각각 1칸 */
```

실제 구조:

```
┌─ grid-template-columns: 1fr 1fr ──┐
│ row 1: [원룸 (span 2)] [오피스텔]   │
│ row 2: [원룸 계속    ] [빌라]       │
│ row 3: [투룸+       ] [아파트]      │
└────────────────────────────────────┘
```

- 왼쪽 2개 (원룸+투룸+) 합친 높이 = 오른쪽 3개 (오피스텔+빌라+아파트) 합친 높이
- 이를 위해 원룸 카드가 `grid-row: span 2`
- gap까지 고려해서 높이가 맞아야 함

**카드 상태:**

- 기본: 흰색 배경 + 연한 테두리 + 아이콘(회색) + 텍스트
- 선택: 연한 Teal 배경(#E0F2F1) + Teal 테두리(#0D9488) + 아이콘(Teal) + 텍스트(Teal) + 우측 상단 체크 아이콘
- 호버: 연한 회색 배경

**카드별 아이콘:**

- 원룸: 침대 아이콘
- 오피스텔: 빌딩 아이콘
- 빌라: 연립주택 아이콘
- 아파트: 아파트 아이콘
- 투룸+: 방 2개 아이콘

> 아이콘은 lucide-react 사용 (이미 Tailwind와 호환 좋음, 번들 트리셰이킹 지원).
> 정확한 아이콘 매핑은 구현 시 가장 적절한 것으로 선택.

**Check Tip 카드:**

- 연한 Teal/핑크 배경 (Stitch 디자인 참고)
- 주거유형에 따라 팁 내용이 바뀌면 좋지만, MVP에서는 고정 텍스트
- "가구 수와 면적에 따라 이사 비용이 달라질 수 있어요."

---

### 6-3. 스텝 3/3: 계약유형 + 이사방법 (StepContractAndMove)

```
┌──────────────────────────────┐
│      [체크리스트 아이콘]       │  ← 상단 아이콘 (Stitch 디자인)
│                              │
│ 계약 유형은?                  │  ← 질문 1
│ ┌────────┐ ┌────────┐       │
│ │  월세   │ │ ✅ 전세 │       │  ← 필/칩 선택 (2개)
│ └────────┘ └────────┘       │
│                              │
│ 이사 방법은?                  │  ← 질문 2
│ ┌────────┐ ┌────────┐       │
│ │  용달   │ │ 반포장  │       │
│ ├────────┤ ├────────┤       │  ← 필/칩 선택 (4개, 2×2)
│ │ ✅ 포장 │ │ 자가용  │       │
│ └────────┘ └────────┘       │
│                              │
│ ┌──────────────────────────┐ │
│ │ 💡 PRO TIP              │ │  ← 팁 카드
│ │ (이사 방법에 따른 팁)     │ │
│ └──────────────────────────┘ │
├──────────────────────────────┤
│  ┌────────────────────────┐  │
│  │  맞춤 체크리스트 만들기 →│  │  ← 최종 제출 버튼
│  └────────────────────────┘  │
└──────────────────────────────┘
```

**SelectionChip 스펙:**

- 기본: 흰색 배경 + 회색 테두리 + 둥근 모서리 (pill 형태)
- 선택: Teal 테두리 + 체크 아이콘 + Teal 텍스트
- 계약유형: 단일 선택 (월세/전세)
- 이사방법: 단일 선택 (용달/반포장/포장/자가용)

**PRO TIP 카드:**

- 이사 방법 선택에 따라 팁 내용 변경:
  - 용달: "짐이 적으면 가장 경제적이에요. 직접 짐을 옮겨야 해요."
  - 반포장: "가전/가구는 업체가, 잔짐은 직접 포장해요."
  - 포장: "모든 짐 포장을 업체가 해줘요. 편하지만 비용이 높아요."
  - 자가용: "정말 짐이 몇 박스일 때만 추천해요."
  - 미선택: 기본 텍스트 또는 숨김

**"맞춤 체크리스트 만들기" 버튼:**

- 계약유형 + 이사방법 **둘 다** 선택 시에만 활성화
- 클릭 시: createMoveWithChecklist RPC 호출 → 성공 시 대시보드로 이동
- 로딩 중: 버튼에 스피너 + 텍스트 변경 ("체크리스트 만드는 중...")

---

## 7. 서비스 함수

### services/move.ts

```typescript
import { supabase } from '@/lib/supabase'

interface CreateMoveInput {
  movingDate: string
  housingType: string
  contractType: string
  moveType: string
}

/**
 * 이사 생성 + 맞춤 체크리스트 자동 생성 (트랜잭션)
 * @param input - 온보딩 폼 데이터
 * @returns 생성된 이사 ID (uuid)
 * @throws RPC 실패 시 [createMoveWithChecklist] 접두사와 함께 throw
 */
export async function createMoveWithChecklist(input: CreateMoveInput): Promise<string> {
  // 방어적 검증 — UI에서 disabled로 막지만, 코드 레벨에서도 보장
  if (!input.movingDate || !input.housingType || !input.contractType || !input.moveType) {
    throw new Error('[createMoveWithChecklist] 필수 입력값이 누락되었습니다')
  }

  const { data, error } = await supabase.rpc('create_move_with_checklist', {
    p_moving_date: input.movingDate,
    p_housing_type: input.housingType,
    p_contract_type: input.contractType,
    p_move_type: input.moveType,
    p_is_first_move: false, // 첫 이사 여부 제거 → 기본값 false
    p_from_address: null,
    p_to_address: null,
  })

  if (error) {
    throw new Error(`[createMoveWithChecklist] ${error.message}`)
  }

  return data as string
}
```

> **왜 p_is_first_move를 false로 고정?**: 온보딩에서 첫 이사 질문을 빼기로 했으므로.
> RPC 시그니처에는 파라미터가 있지만 (이미 1단계에서 만듦), 프론트에서 false를 보냄.
> 나중에 설정에서 추가하거나, AI 가이드에서 활용할 수 있으니 DB 컬럼은 유지.

---

## 8. TanStack Query Mutation 훅

### features/onboarding/hooks/useCreateMove.ts

```typescript
import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createMoveWithChecklist } from '@/services/move'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { ROUTES } from '@shared/constants/routes'

export function useCreateMove() {
  const navigate = useNavigate()
  const reset = useOnboardingStore((s) => s.reset)

  return useMutation({
    mutationFn: createMoveWithChecklist,
    onSuccess: () => {
      reset() // 온보딩 스토어 초기화
      navigate(ROUTES.DASHBOARD, { replace: true }) // 뒤로가기 시 온보딩 안 나오게
    },
    onError: (error) => {
      console.error('체크리스트 생성 실패:', error)
      // mutation.isError를 컴포넌트에서 참조해서 인라인 에러 메시지 표시
    },
  })
}
```

> **왜 `replace: true`?**: 온보딩 완료 후 뒤로가기 누르면 온보딩이 다시 나오면 안 됨.
> replace로 히스토리를 덮어쓰면 뒤로가기 시 랜딩으로 감.

> **에러 표시 방식**: StepContractAndMove 컴포넌트에서 `mutation.isError`로 인라인 에러 메시지 표시.
> `alert()`는 사용하지 않음 — 모바일 WebView에서 네이티브 alert이 UX를 깨뜨림.
> 3단계에서 토스트 컴포넌트 추가 시 토스트로 전환.
>
> ```typescript
> {mutation.isError && (
>   <p className="text-sm text-critical" role="alert">
>     체크리스트 생성에 실패했어요. 다시 시도해주세요.
>   </p>
> )}
> ```

---

## 9. 대시보드 플레이스홀더

### pages/DashboardPage.tsx

```typescript
export function DashboardPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-secondary">이사콕</h1>
      <p className="mt-2 text-secondary/60">체크리스트 생성 완료! (3단계에서 대시보드 구현)</p>
    </div>
  )
}
```

> 이 화면은 3단계에서 실제 대시보드 UI로 교체됨.
> 2단계에서는 온보딩 → RPC 호출 → 여기까지 오는 게 목표.

---

## 10. 공통 컴포넌트

### shared/components/Button.tsx

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}
```

**variant 스타일:**

- primary: bg-primary + text-white + hover:bg-primary/90 (큰 CTA에 사용)
- secondary: bg-white + border + text-secondary + hover:bg-neutral
- ghost: bg-transparent + text-primary + hover:bg-tertiary

**size:**

- sm: h-9 px-3 text-sm
- md: h-11 px-4 text-base
- lg: h-14 px-6 text-lg (CTA 버튼용)

**isLoading:**

- true일 때 children 대신 스피너 아이콘 표시 + disabled

### shared/components/ProgressBar.tsx

```typescript
interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}
```

- 3개 바가 가로로 나란히 (gap 포함)
- 현재 스텝까지: bg-primary
- 이후 스텝: bg-gray-200
- 애니메이션: 너비 변화에 transition

---

## 11. 디자인 스펙 (Stitch 기반 + 수정사항)

### 색상 규칙

| 용도               | 색상                 | CSS               |
| ------------------ | -------------------- | ----------------- |
| CTA 버튼 배경      | #0D9488              | bg-primary        |
| 카드 선택 배경     | #E0F2F1              | bg-tertiary       |
| 카드 선택 테두리   | #0D9488              | border-primary    |
| 미선택 카드 배경   | #FFFFFF              | bg-white          |
| 미선택 카드 테두리 | #E5E7EB              | border-gray-200   |
| 비활성 버튼        | #0D9488/50           | bg-primary/50     |
| 텍스트 (메인)      | #333344              | text-secondary    |
| 텍스트 (설명)      | #333344/60           | text-secondary/60 |
| 페이지 배경        | #F8F7F5              | bg-neutral        |
| 팁 카드 배경       | #FEE2E2 또는 #E0F2F1 | 컨텍스트에 따라   |

### 타이포그래피

| 용도        | 크기             | 굵기          |
| ----------- | ---------------- | ------------- |
| 메인 질문   | text-2xl (24px)  | font-bold     |
| 서브 설명   | text-base (16px) | font-normal   |
| 카드 텍스트 | text-sm (14px)   | font-medium   |
| 팁 텍스트   | text-sm (14px)   | font-normal   |
| 버튼 텍스트 | text-lg (18px)   | font-semibold |

### 간격

| 용도             | 값                           |
| ---------------- | ---------------------------- |
| 페이지 좌우 패딩 | px-5 (20px)                  |
| 섹션 간 간격     | mt-8 (32px)                  |
| 카드 간 간격     | gap-3 (12px)                 |
| 버튼 하단 여백   | pb-8 (32px) — safe area 고려 |

### Stitch 대비 변경사항

1. **앱 이름**: "이사체크" → **"이사콕"**
2. **주거유형 레이아웃**: 2×2 → **왼쪽2+오른쪽3 비대칭 그리드** (아파트 추가)
3. **선택 스타일**: 보라색 배경 → **Teal(#E0F2F1) 배경 + Teal 테두리**
4. **온보딩 스텝**: 헤더 "진행 단계 (1/3)" 유지 (Stitch에는 "1/3"으로 표시)
5. **아이콘**: Stitch 아이콘 → lucide-react 아이콘으로 교체 (일관성)

---

## 12. 완료 확인 기준 (체크리스트)

- [ ] `pnpm dev` → 브라우저에서 랜딩 페이지 표시
- [ ] 랜딩에서 "이사 시작하기" 클릭 → /onboarding 으로 이동
- [ ] 온보딩 스텝 1: 캘린더에서 날짜 선택 가능, 과거 14일~미래 90일 범위
- [ ] 온보딩 스텝 1: 날짜 미선택 시 "다음" 버튼 비활성
- [ ] 온보딩 스텝 2: 5개 주거유형 카드 표시, 클릭 시 Teal 선택 스타일
- [ ] 온보딩 스텝 2: 왼쪽 2개 + 오른쪽 3개 높이 일치
- [ ] 온보딩 스텝 3: 계약유형(2개) + 이사방법(4개) 선택 가능
- [ ] 온보딩 스텝 3: 둘 다 선택 시에만 "맞춤 체크리스트 만들기" 활성
- [ ] "맞춤 체크리스트 만들기" 클릭 → RPC 호출 성공 → /dashboard 이동
- [ ] 대시보드에 플레이스홀더 텍스트 표시
- [ ] 뒤로가기 동작: 스텝 3→2→1→랜딩, 대시보드에서 뒤로가기→온보딩 안 나옴
- [ ] ProgressBar: 스텝에 따라 1/3, 2/3, 3/3 채움
- [ ] `pnpm build` → 에러 없음
- [ ] `pnpm lint` → 에러 없음
- [ ] 존재하지 않는 라우트 → 랜딩으로 리다이렉트
- [ ] 접근성: 주거유형 카드에 role="radiogroup" + role="radio" 적용
- [ ] 접근성: 캘린더 키보드 네비게이션 동작 (화살표 키 + Enter)
- [ ] 오프라인: 네트워크 끊기면 제출 버튼 비활성 + 안내 배너 표시
- [ ] 오프라인: 네트워크 복귀 시 자동 활성화

---

## 13. 엣지케이스 / 주의사항

### 캘린더

- 오늘 선택 가능 (당일 이사도 가능해야 함 — "초급한 모드"로 연결)
- 너무 먼 미래 (1년 이상) → 제한 없음. 제한하면 유저가 불편. 스마트 재배치가 처리
- 월 이동 시 선택된 날짜 유지 (다른 월로 갔다 와도 선택 상태 유지)
- 한국어 로케일: 요일이 "일 월 화 수 목 금 토"로 표시되어야 함

### RPC 호출 실패

- 네트워크 에러 → "연결을 확인해주세요" 메시지 + 재시도 가능하게
- 이미 active 이사가 있는 경우 → 2단계에서는 무시 (RLS 꺼져있고 user_id 없음). 3단계에서 대시보드 진입 시 active 이사 있으면 바로 대시보드로 리다이렉트하는 가드 추가
- 500 에러 → "잠시 후 다시 시도해주세요"

### 비회원 상태에서 RPC 호출

- 현재 (2단계): 인증 없이 RPC 호출 → RLS가 꺼져 있으므로 동작함
- 8단계에서 RLS 켜면: 비회원은 IndexedDB 로컬 동작으로 전환
- **이 단계에서는 Supabase에 직접 데이터가 들어가는 상태** (인증/비회원 분기 없음)

### 중복 제출 방지

- "맞춤 체크리스트 만들기" 버튼: mutation.isPending 동안 disabled
- 빠른 더블클릭 시 2번 호출 방지

### 뒤로가기 시 폼 데이터

- Zustand 스토어에 저장되어 있으므로, 뒤로가기 시 이전 선택값 유지됨
- 랜딩까지 돌아갔다가 다시 온보딩 진입 시에는 `reset()` 호출 (새로 시작)

### 브라우저 새로고침

- Zustand은 기본적으로 메모리 스토어 → 새로고침 시 상태 사라짐
- 온보딩 중 새로고침 → 스텝 1로 돌아감 (의도된 동작 — 3스텝이라 금방 다시 진행)
- persist 미들웨어는 사용하지 않음 (오버엔지니어링)

### 오프라인 감지

- `navigator.onLine` + `online`/`offline` 이벤트로 네트워크 상태 감지
- 오프라인 시: "맞춤 체크리스트 만들기" 버튼 비활성 + "인터넷 연결을 확인해주세요" 안내 배너
- 구현 위치: 공통 훅 `useOnlineStatus()` → shared/hooks/ (다른 화면에서도 재사용)
- 온라인 복귀 시 자동으로 버튼 활성화 (수동 새로고침 불필요)

### URL 직접 접근

- `/onboarding` 직접 접근 → Zustand 비어있어서 스텝 1부터 시작 (정상)
- `/dashboard` 직접 접근 → 2단계에서는 플레이스홀더 표시. 3단계에서 가드 추가

### 접근성 (a11y)

- 캘린더: react-day-picker가 키보드 네비게이션 기본 지원 (화살표 키, Enter 선택)
- 주거유형 카드: `role="radiogroup"` + 각 카드 `role="radio"` + `aria-checked`
- 칩 선택 (계약유형/이사방법): `role="radiogroup"` + `role="radio"` + `aria-checked`
- 버튼 비활성: `aria-disabled="true"` + `disabled` 속성 둘 다 설정
- 프로그레스 바: `role="progressbar"` + `aria-valuenow` + `aria-valuemin` + `aria-valuemax`
- 뒤로가기 버튼: `aria-label="이전 단계로 돌아가기"`
- 페이지 전환 시: 제목 요소에 포커스 이동 (스크린 리더 사용자가 새 화면임을 인지)

> **왜 접근성을 2단계부터?**: 나중에 한꺼번에 추가하면 기존 컴포넌트를 전부 수정해야 함.
> 처음부터 넣으면 추가 비용이 거의 없고, 포트폴리오에서 "접근성까지 신경 썼다"는
> 신입치고 강한 인상을 줌. 면접에서도 좋은 어필 포인트.

### 이사일이 오늘인 경우

- RPC 정상 동작하지만, d_day_offset=-30인 항목의 assigned_date가 한 달 전이 됨
- 대부분 항목이 "밀린 할 일"로 들어감 → 5단계 "초급한 모드"에서 UX 처리
- 2단계에서는 별도 처리 없음 (RPC 결과 자체는 정상)

---

## 14. 다음 단계 연결

2단계 완료 후 → **3단계: 대시보드 + 타임라인 + 설정** (`docs/specs/03-dashboard.md`)

- 대시보드: 오늘 할 일 + D-day + 진행률
- 타임라인: 전체 체크리스트 날짜별 그룹핑
- 하단 탭바 (홈/타임라인/집기록)
- 설정 화면 (이사 정보 수정 → updateMoveWithReschedule)
- getCurrentMove, getTodayItems, getTimelineItems 서비스 함수
