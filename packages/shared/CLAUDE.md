# packages/shared — 앱 간 공유 코드

apps/web과 apps/mobile이 공유하는 코드. React/Supabase 의존 없는 순수 로직만.

> ⚠️ services/(Supabase API 호출)는 여기에 두지 않음 → apps/web/src/services/에 위치.
> 근거: shared가 apps/web/lib/supabase.ts에 의존하면 레이어 역전 (ADR-006).

## 폴더 구조

```
src/
├── utils/             ← 순수 계산 함수 (의존성 0, side-effect 금지)
│   ├── date.ts        ← D-Day 계산, 날짜 포맷
│   ├── filter.ts      ← 체크리스트 조건 필터링
│   ├── group.ts       ← 날짜별/방별 그룹핑
│   ├── smartReplace.ts ← 모드 판별 + 재배치 계산
│   ├── progress.ts    ← 진행률 계산
│   └── image.ts       ← 리사이징, EXIF 추출, SHA-256 해시
├── types/             ← 2개+ 파일에서 쓰는 공유 타입
│   ├── database.ts    ← Supabase gen types 자동 생성
│   ├── move.ts
│   ├── checklist.ts
│   ├── photo.ts
│   └── bridge.ts      ← 네이티브 브릿지 타입 (9단계)
└── constants/         ← 상수
    ├── colors.ts
    ├── routes.ts
    └── smartReplace.ts ← 모드별 UI 텍스트
```

## 유틸 함수 규칙

- 의존성 0 (외부 라이브러리, supabase, React 전부 import 금지)
- 순수 함수만 (같은 입력 → 항상 같은 출력, side-effect 없음)
- 모든 함수에 JSDoc 필수
- "왜"를 설명하는 주석 (무엇을은 코드가 표현)

```typescript
/**
 * 남은 기간으로 스마트 재배치 모드를 판별
 * D-Day 이후에도 사용 가능해야 함 (이사 후 모드)
 * @param daysRemaining - 이사일까지 남은 일수 (음수면 이미 지남)
 */
export function determineReplaceMode(daysRemaining: number): ReplaceMode {
  if (daysRemaining < 0) return 'POST_MOVE'
  if (daysRemaining <= 6) return 'URGENT'
  // ...
}
```

## 타입 규칙

- 1개 파일에서만 쓰는 타입 → 해당 파일 상단에 정의
- 2개+ 파일에서 쓰는 타입 → types/ 폴더
- 인자 3개 이상이면 Input 타입 분리
- interface 사용 (type alias 아님, Props도 동일)
- enum 금지 → as const 객체 + 유니온 타입

```typescript
const HOUSING_TYPES = {
  원룸: '원룸',
  오피스텔: '오피스텔',
  빌라: '빌라',
  아파트: '아파트',
  '투룸+': '투룸+',
} as const
type HousingType = (typeof HOUSING_TYPES)[keyof typeof HOUSING_TYPES]
```

## 테스트 규칙

- **TDD**: utils/ — 테스트 먼저 작성 → 구현
- **co-location**: 테스트 파일은 소스 옆에 (date.test.ts)
- **도구**: Vitest
- **대상**: utils 전체
- **미루기**: hooks, components 테스트는 MVP 이후
