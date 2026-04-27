const VALID_HOUSING = ['원룸', '오피스텔', '빌라', '아파트', '투룸+']
const VALID_CONTRACT = ['월세', '전세']
const VALID_MOVE = ['용달', '반포장', '포장', '자가용']

export function isValidConditions(c: Record<string, unknown>): boolean {
  return (
    VALID_HOUSING.includes(c?.housing_type as string) &&
    VALID_CONTRACT.includes(c?.contract_type as string) &&
    VALID_MOVE.includes(c?.move_type as string)
  )
}

export function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
}
