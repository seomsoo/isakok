/**
 * 주거 유형 (온보딩 Step 2)
 * DB: moves.housing_type CHECK 제약조건
 */
export const HOUSING_TYPES = {
  원룸: '원룸',
  오피스텔: '오피스텔',
  빌라: '빌라',
  아파트: '아파트',
  '투룸+': '투룸+',
} as const

export type HousingType = (typeof HOUSING_TYPES)[keyof typeof HOUSING_TYPES]

/**
 * 계약 유형 (온보딩 Step 3)
 * DB: moves.contract_type CHECK 제약조건
 */
export const CONTRACT_TYPES = {
  월세: '월세',
  전세: '전세',
} as const

export type ContractType = (typeof CONTRACT_TYPES)[keyof typeof CONTRACT_TYPES]

/**
 * 이사 방식 (온보딩 Step 4에서 선택 or 체크리스트 필터용)
 * DB: moves.move_type CHECK 제약조건
 */
export const MOVE_TYPES = {
  용달: '용달',
  반포장: '반포장',
  포장: '포장',
  자가용: '자가용',
} as const

export type MoveType = (typeof MOVE_TYPES)[keyof typeof MOVE_TYPES]

/**
 * 이사 상태
 * DB: moves.status CHECK 제약조건
 */
export const MOVE_STATUSES = {
  ACTIVE: 'active',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
} as const

export type MoveStatus = (typeof MOVE_STATUSES)[keyof typeof MOVE_STATUSES]
