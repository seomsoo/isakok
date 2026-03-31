# apps/web — React Vite 웹앱

## 폴더 구조

```
src/
├── features/           ← 기능별 작업 단위 (AI에게 범위 지정 용이)
│   ├── onboarding/
│   │   ├── components/
│   │   └── hooks/
│   ├── dashboard/
│   │   ├── components/
│   │   └── hooks/
│   ├── timeline/
│   ├── checklist/
│   ├── photos/
│   └── settings/
├── services/           ← Supabase API 호출 (순수 async 함수, React import 금지)
│   ├── moves.ts
│   ├── checklist.ts
│   ├── photos.ts
│   └── aiGuide.ts
├── shared/components/  ← 웹앱 전용 공통 UI (DevTabBar, Spinner, ErrorMessage)
├── pages/              ← 라우트 진입점 (조합만, 로직 없음)
├── stores/             ← Zustand (UI 상태만: 모달, 현재 탭 등)
├── lib/supabase.ts     ← Supabase 클라이언트 초기화
├── App.tsx
└── main.tsx
```

### services/ 위치 결정 근거

packages/shared/에 services/를 두면 shared가 apps/web/lib/supabase.ts에 의존하게 되어 레이어가 역전됨.
DI(의존성 주입)로 해결 가능하지만, 구현체가 Supabase 하나뿐이라 불필요한 추상화 (ADR-006).
→ services/는 apps/web/src/ 안에 두고, packages/shared/에는 순수한 것만 둠 (types, utils, constants).
→ mobile 앱 추가 시 services/ 공유가 필요해지면 그때 DI 패턴으로 전환.
승격 트리거: Expo가 WebView 없이 직접 checklist/photo/move 데이터를 읽거나 쓰는 화면이 생기면 packages/shared/로 이동 + DI 패턴 전환.

### 서비스 함수 규칙

- React import 금지. 순수 async 함수만.
- lib/supabase.ts에서 클라이언트 import
- 모든 함수에 JSDoc 필수

```typescript
/**
 * 현재 진행 중인 이사 조회 (active 상태 1건)
 * @param userId - 유저 ID
 * @returns 현재 active 이사. 없으면 null
 * @throws 쿼리 에러 시 [getCurrentMove] 접두사와 함께 throw
 */
export async function getCurrentMove(userId: string): Promise<Move | null> {
  const { data, error } = await supabase
    .from('moves')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .is('deleted_at', null)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw new Error(`[getCurrentMove] ${error.message}`)
  }
  return data
}
```

### 에러 처리 패턴

- 서비스에서 throw (에러를 삼키지 않음)
- 에러 메시지: [함수명] 설명 형식
- Supabase 응답: { data, error } → error 체크 → throw → return data
- 호출하는 쪽(hooks)에서 TanStack Query가 에러를 캐치

### API 함수 목록

| 함수                     | 타입    | 설명                              | 단계 |
| ------------------------ | ------- | --------------------------------- | ---- |
| createMoveWithChecklist  | RPC     | 이사+체크리스트 생성 (트랜잭션)   | 2    |
| getCurrentMove           | READ    | active 이사 1건 조회              | 3    |
| getTodayItems            | READ    | 오늘 할 일 + 과거 미완료          | 3    |
| getTimelineItems         | READ    | 전체 체크리스트 (그룹핑은 프론트) | 3    |
| toggleChecklistItem      | WRITE   | 체크 토글 (낙관적 업데이트)       | 4    |
| updateItemMemo           | WRITE   | 메모 추가                         | 4    |
| updateMoveWithReschedule | RPC     | 이사 수정+재배치 (트랜잭션)       | 4    |
| softDeleteMove           | WRITE   | 이사 soft delete                  | 3    |
| uploadPhoto              | WRITE   | Storage+DB 2단계                  | 6    |
| getPhotosByMove          | READ    | 이사별 사진 (그룹핑은 프론트)     | 6    |
| softDeletePhoto          | WRITE   | 사진 soft delete                  | 6    |
| generateAiGuide          | EDGE FN | AI 가이드 생성 (캐시)             | 7    |

## 레이어 규칙 (엄격)

의존 방향은 한쪽으로만:

```
pages/ → features/ → services/, @shared/utils
                    → shared/components/
```

1. **pages/**: 라우트 진입점. 훅으로 데이터 가져와서 feature 컴포넌트에 props 전달. 라우트 파라미터/검색 파라미터 파싱은 여기서 허용, 비즈니스 로직은 hook으로 위임.
2. **features/components/**: props만 받는 순수 UI. supabase, services 직접 import 금지
3. **features/hooks/**: 해당 기능 전용 훅. services/ 호출 + TanStack Query 조합
4. **services/**: Supabase API 호출. lib/supabase.ts import 허용. React import 금지
5. **shared/components/**: 웹앱 전용 공통 UI (Button, Modal, Spinner, ErrorMessage, DevTabBar)
6. **stores/**: Zustand. UI 상태만. 서버 데이터 넣지 않음
7. **lib/**: supabase 클라이언트만. 다른 로직 넣지 않음

packages/shared/에 위치하는 것: types/, utils/, constants/ (Supabase 의존 없는 순수 코드)

## TanStack Query 규칙

### Query Key

기능별 파일에 상수로 정의. 매직 문자열 금지.

```typescript
// features/dashboard/hooks/queryKeys.ts
export const dashboardKeys = {
  currentMove: ['move', 'current'] as const,
  todayItems: (moveId: string) => ['checklist', 'today', moveId] as const,
}
```

### Mutation 후 Invalidation

mutation 성공 시 어떤 query를 invalidate할지 명시적으로 작성.

```typescript
// 예: 체크 토글 → 오늘 할 일 + 타임라인 둘 다 갱신
onSuccess: () => {
  queryClient.invalidateQueries({ queryKey: dashboardKeys.todayItems(moveId) })
  queryClient.invalidateQueries({ queryKey: timelineKeys.all(moveId) })
}
```

### Optimistic Update

toggleChecklistItem처럼 즉각 피드백이 필요한 곳에만 명시적으로 사용. 기본은 invalidation.

### 데이터 변환

hook에서 데이터 shape 변환을 완료하고, page/component에는 UI에 바로 쓸 수 있는 형태로 내려줌.

```typescript
// ✅ hook에서 변환 완료
const { data: groupedItems } = useTimelineItems(moveId)
// groupedItems는 이미 날짜별 그룹핑된 상태

// ❌ component에서 변환
const { data: rawItems } = useTimelineItems(moveId)
const grouped = groupByDate(rawItems) // 여기서 하면 안 됨
```

### 에러 처리

services에서 throw한 에러를 hook이 그대로 노출하지 않음. 필요 시 normalize.

```typescript
// services/checklist.ts — 원본 에러 throw
throw new Error(`[toggleChecklistItem] ${error.message}`)

// features/checklist/hooks/useToggle.ts — UI용 에러로 변환
onError: (error) => {
  toast.error('체크 상태 변경에 실패했어요. 다시 시도해주세요.')
  // 원본 에러는 로깅용으로 보존
  console.error(error)
}
```

## 경로 별칭

- `@shared/` → packages/shared/src/
- `@/` → apps/web/src/

## 코드 컨벤션

### 네이밍

- 축약 금지 (chk → checklist, mv → move)
- 도메인 단어 통일: move, checklist/item, photo, guide (task 사용 안 함)
- 함수: 동사+대상 (createMove, filterItemsByCondition)
- boolean: is/has/can (isCompleted, isSkippable, hasPhotos)
- 이벤트 핸들러: props는 on 접두사, 내부는 handle 접두사
- 컴포넌트 파일: PascalCase (TodayTasks.tsx)
- 훅 파일: camelCase (useDashboard.ts)
- 상수: UPPER_SNAKE_CASE (SMART_REPLACE_MODES)
- 타입/인터페이스: PascalCase (Move, ChecklistItem)

### TypeScript

- strict mode
- any 금지
- as 타입 단언 최소화 (타입 가드 또는 제네릭 우선)
- ! non-null assertion 금지 (early return 또는 optional chaining)
- enum 금지 → as const 객체 + 유니온 타입
- 함수 입출력 타입 명시
- 인자 3개 이상이면 Input 타입 분리, 2개 이하면 인라인

### React

- 함수형 컴포넌트만
- Props는 interface로 정의
- named export만 (default export 금지)
- 컴포넌트 150줄 넘으면 분리 신호
- 조건부 렌더링: early return 패턴

```typescript
if (isLoading) return <Spinner />
if (error) return <ErrorMessage error={error} />
return <Dashboard items={items} />
```

### 함수

- 유틸/서비스 함수: export function (hoisting + 스택트레이스)
- 콜백/인라인: arrow function

### import 순서

```typescript
// 1. 외부 라이브러리
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'

// 2. 공유 패키지
import { ChecklistItem } from '@shared/types/checklist'
import { calculateAssignedDate } from '@shared/utils/date'

// 3. 같은 앱 내부
import { TodayTasks } from '@/features/dashboard/components/TodayTasks'
```

### 기타

- barrel export(index.ts) 금지. 직접 import
- 매직 값 금지 (상수 분리)
- async/await만 (.then 체이닝 금지)
- 파일당 하나의 책임

## Tailwind / 스타일

- 인라인 style={{}} 금지, Tailwind 클래스만
- 같은 클래스 조합 3번+ 반복 시 공통 컴포넌트로 추출
- 디자인 토큰:
  - Primary: #0D9488 (Teal)
  - Secondary: #333344 (Dark Navy)
  - Tertiary: #E0F2F1 (Light Mint)
  - Neutral: #F8F7F5 (Warm Gray)
  - Warning: #F97316 (Amber)
  - Critical: #EF4444 (Red)
  - Success: #10B981 (Green)

## 반응형

- 모바일 퍼스트 (375px 기준)
- max-width: 430px + margin: 0 auto (iPad에서 가운데 정렬)
- 데스크톱 레이아웃 불필요 (WebView 앱)
- Tailwind 브레이크포인트: sm(640px)만 가끔 사용

## UI 패턴

- Error Boundary: 최상위에 배치 ("문제가 발생했어요" 폴백)
- 로딩: shared/components/Spinner 공통 사용
- 에러: shared/components/ErrorMessage 공통 사용
- 접근성 최소 기준: 시맨틱 HTML, 이미지 alt, 색상 대비, 키보드 내비게이션

## 개발 중 임시 처리

| 임시 처리                             | 교체 시점 | 교체 대상                       |
| ------------------------------------- | --------- | ------------------------------- |
| DevTabBar (웹 임시 탭바)              | 9단계     | Expo 네이티브 탭바              |
| 파일 선택 input                       | 9단계     | Expo 네이티브 카메라            |
| anon key + RLS 끔 (모든 행 접근 가능) | 8단계     | anon key + RLS 켜기 + 유저 인증 |
| 하드코딩 user_id                      | 8단계     | auth.uid()                      |
| guide_content 직접 표시               | 7단계     | AI custom_guide 우선            |

> ⚠️ service_role key는 임시 개발 중에도 클라이언트(Vite 번들)에 절대 넣지 않음.
> RLS를 끄면 anon key만으로 모든 데이터에 접근 가능하므로 service_role key가 불필요.

## ESLint / Prettier

### ESLint

- @typescript-eslint/recommended
- no-explicit-any: error
- no-non-null-assertion: error
- prefer-const: error
- eslint-plugin-react-hooks
- eslint-plugin-import (import 순서)
- **아키텍처 보호 (no-restricted-imports)**:
  - `features/**/components/`에서 `@supabase/supabase-js`, `@/services/*`, `@/lib/*` import 금지
  - `stores/`에서 `@supabase/supabase-js`, `@/services/*` import 금지

### Prettier

- 세미콜론: 없음
- 따옴표: 작은따옴표
- 탭 너비: 2
- 트레일링 콤마: all
- 프린트 너비: 100
