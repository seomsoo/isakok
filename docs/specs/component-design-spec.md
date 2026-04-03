# 공통 컴포넌트 디자인 스펙

> 기반: docs/design-style-guide.md
> 위치: apps/web/src/shared/components/
> cn 유틸리티: apps/web/src/lib/cn.ts (clsx + tailwind-merge)

---

## cn 유틸리티

모든 공통 컴포넌트는 `cn()`으로 클래스를 합성한다. 외부에서 `className` prop으로 오버라이드 가능.

```typescript
import { cn } from '@/lib/cn'

// 사용 예
<button className={cn('h-[52px] rounded-xl bg-primary', className)} />
```

---

## 1. Button

CTA, 폼 제출, 부가 액션에 사용.

### Props

```typescript
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}
```

### 스타일 상세

| variant   | 배경                  | 텍스트      | 보더   | pressed            |
| --------- | --------------------- | ----------- | ------ | ------------------ |
| primary   | primary               | white       | 없음   | primary L-0.10     |
| secondary | border                | secondary   | border | neutral            |
| ghost     | transparent           | primary     | 없음   | tertiary           |
| danger    | critical              | white       | 없음   | critical L-0.10    |

| size | 높이  | 패딩     | 폰트            | radius |
| ---- | ----- | -------- | --------------- | ------ |
| sm   | 40px  | 0 16px   | 14px / 500      | 8px    |
| md   | 48px  | 0 20px   | 15px / 600      | 12px   |
| lg   | 52px  | 0 24px   | 16px / 600      | 12px   |

### 상태

- **disabled**: opacity 0.4, cursor-not-allowed
- **loading**: children 대신 Loader2 스피너 (lucide-react), disabled 처리
- **그림자**: primary variant에만 미세한 그림자 (`shadow-sm`). 기존 `shadow-[0_2px_12px_...]` 제거 (토스 스타일)

### 하단 고정 CTA 패턴

온보딩에서는 `OnboardingFooter` 공통 컴포넌트 사용:

```tsx
<OnboardingFooter>
  <Button variant="primary" size="lg">다음</Button>
</OnboardingFooter>
```

`OnboardingFooter` 구조:
- fixed bottom-0 + max-w-[430px] + z-10
- 상단 블러 그라데이션: `bg-gradient-to-t from-neutral to-transparent` (콘텐츠가 자연스럽게 페이드)
- 하단 bg-neutral + px-5 pb-10
- 콘텐츠 영역은 `pb-28`로 버튼 영역 확보 + `overflow-y-auto`로 스크롤 허용

---

## 2. Card

정보 그룹핑 컨테이너.

### Props

```typescript
interface CardProps {
  children: React.ReactNode
  className?: string
  as?: 'div' | 'button' | 'a'
  onClick?: () => void
}
```

### 스타일

```
bg-surface rounded-2xl p-4 shadow-sm
```

| 속성    | 값                                     |
| ------- | -------------------------------------- |
| 배경    | surface (#FFFFFF)                      |
| radius  | 16px (rounded-2xl)                     |
| 패딩    | 16px (p-4)                             |
| 그림자  | `0 1px 2px rgba(0,0,0,0.04)`          |
| 카드 간 | 12px (gap-3 또는 space-y-3)            |

- 보더는 선택적: 그림자와 보더 중 하나만 사용
- 클릭 가능한 카드: `as="button"`, pressed 시 `bg-neutral` 전환

---

## 3. Chip (SelectionChip)

단일/다중 선택지. 온보딩 주거유형, 계약유형, 이사방법 등에 사용.

### Props

```typescript
interface ChipProps {
  label: string
  isSelected: boolean
  onSelect: () => void
  icon?: React.ReactNode
  className?: string
}
```

### 스타일

| 상태   | 배경      | 보더                      | 텍스트                |
| ------ | --------- | ------------------------- | --------------------- |
| 기본   | surface   | 1px solid border-input    | secondary, 14px / 400 |
| 선택   | tertiary  | 1.5px solid primary       | primary, 14px / 600   |

| 속성   | 값        |
| ------ | --------- |
| 높이   | 40px      |
| 패딩   | 0 16px    |
| radius | 8px       |
| 전환   | 150ms     |

- 아이콘 포함 시: 아이콘 20px + gap 8px + 라벨
- 그리드 배치: 2열 (`grid grid-cols-2 gap-2`)
- 접근성: `role="radio"` (단일) 또는 `role="checkbox"` (다중), `aria-checked`

---

## 4. ProgressBar

온보딩 단계 표시.

### Props

```typescript
interface ProgressBarProps {
  currentStep: number
  totalSteps: number
}
```

### 스타일

| 속성         | 값                   |
| ------------ | -------------------- |
| 바 높이      | 4px                  |
| radius       | 9999px (full)        |
| 트랙         | border 색상          |
| 채움         | primary              |
| 세그먼트 간격 | 8px                 |
| 채움 전환    | width 300ms ease-out |

- 세그먼트 방식 (step별 개별 바) 유지
- 완료된 세그먼트: primary, 미완료: `bg-border`

---

## 5. Input

텍스트 입력.

### Props

```typescript
interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  helperText?: string
}
```

### 스타일

| 속성           | 값                              |
| -------------- | ------------------------------- |
| 높이           | 48px                            |
| 패딩           | 0 16px                          |
| radius         | 8px                             |
| 배경           | surface                         |
| 보더 (기본)    | 1px solid border-input          |
| 보더 (포커스)  | 1.5px solid primary             |
| 보더 (에러)    | 1.5px solid critical            |
| placeholder    | placeholder 색상, 14px          |
| 텍스트         | secondary, 16px                 |
| 전환           | border-color 150ms              |

- label: 인풋 위, 14px / 500 / secondary
- error: 인풋 아래, 12px / 400 / critical
- helperText: 인풋 아래, 12px / 400 / muted

---

## 6. Badge

상태 표시 (필수, 완료, 밀림 등).

### Props

```typescript
interface BadgeProps {
  variant: 'default' | 'warning' | 'critical' | 'success'
  children: React.ReactNode
  className?: string
}
```

### 스타일

| variant  | 배경                              | 텍스트    |
| -------- | --------------------------------- | --------- |
| default  | tertiary                          | primary   |
| warning  | `oklch(0.70 0.187 48 / 0.1)`     | warning   |
| critical | `oklch(0.64 0.208 25 / 0.1)`     | critical  |
| success  | `oklch(0.70 0.149 163 / 0.1)`    | success   |

| 속성   | 값              |
| ------ | --------------- |
| 패딩   | 4px 8px         |
| radius | 8px             |
| 폰트   | 12px / 500      |

- 배경은 해당 컬러의 10% 불투명도 (OKLCH에서 / 0.1로 표현)

---

## 7. Toast

성공/에러 피드백. 화면 상단에서 슬라이드 인.

### Props

```typescript
interface ToastProps {
  variant: 'success' | 'error' | 'info'
  message: string
}
```

### 스타일

| 속성      | 값                                       |
| --------- | ---------------------------------------- |
| 위치      | 상단 중앙, 페이지 max-width 내           |
| 패딩      | 12px 16px                                |
| radius    | 12px                                     |
| 배경      | secondary (어두운 토스트)                |
| 텍스트    | white, 14px / 500                        |
| 아이콘    | 좌측 16px, 해당 variant 색상             |
| 그림자    | shadow-md                                |
| 진입      | transform Y(-100%) → Y(0), 250ms        |
| 퇴장      | opacity 1 → 0, 150ms                    |
| 자동 닫힘 | 3초                                      |

---

## 8. OfflineBanner

네트워크 끊김 안내.

### Props

없음 (내부에서 `useOnlineStatus` 훅 사용).

### 스타일

| 속성   | 값                                  |
| ------ | ----------------------------------- |
| 배경   | `oklch(0.70 0.187 48 / 0.08)`      |
| 텍스트 | warning, 13px                       |
| 아이콘 | WifiOff 16px, warning               |
| 패딩   | 14px 16px                           |
| radius | 16px                                |
| gap    | 10px (아이콘-텍스트)                |

---

## 9. Spinner

전체 페이지 로딩, 버튼 내 로딩.

### Props

```typescript
interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
  className?: string
}
```

### 스타일

| size | 값    | 용도             |
| ---- | ----- | ---------------- |
| sm   | 16px  | 버튼 내부        |
| md   | 24px  | 인라인 로딩      |
| lg   | 32px  | 전체 페이지 로딩 |

- 색상: 기본 primary, className으로 오버라이드 가능
- 애니메이션: `animate-spin`
- lucide-react `Loader2` 아이콘 사용

---

## 10. Divider

섹션 구분선. 여백으로 구분이 안 될 때만 사용.

### Props

```typescript
interface DividerProps {
  className?: string
}
```

### 스타일

```
h-px bg-border
```

- 좌우 여백 없이 풀 너비가 기본
- 필요 시 className으로 좌우 마진 추가

---

## 11. PageHeader

페이지 상단 헤더 (뒤로가기 + 제목 + 우측 액션).

### Props

```typescript
interface PageHeaderProps {
  title?: string
  onBack?: () => void
  rightAction?: React.ReactNode
}
```

### 스타일

| 속성      | 값                          |
| --------- | --------------------------- |
| 높이      | 56px                        |
| 패딩      | 0 20px                      |
| 배경      | neutral (페이지와 동일)     |
| 제목      | 16px / 600 / secondary      |
| 뒤로가기  | ChevronLeft 24px            |
| 레이아웃  | flex, 제목 중앙 정렬        |

- 제목 없으면 뒤로가기만 표시
- sticky top-0 + z-10

---

## 컴포넌트 미구현 목록 (필요 시 추가)

다음 컴포넌트는 해당 단계에서 스펙 추가 후 구현:

| 컴포넌트        | 예정 단계 | 설명                        |
| --------------- | --------- | --------------------------- |
| ChecklistItem   | 3단계     | 체크박스 + 제목 + 메타정보  |
| BottomSheet     | 4단계     | 하단 모달                   |
| Accordion       | 4단계     | AI 가이드 접힘/펼침         |
| Skeleton        | 3단계     | 스켈레톤 로딩 UI            |
| EmptyState      | 3단계     | 데이터 없을 때 안내         |
| Modal           | 6단계     | 확인/취소 다이얼로그        |
