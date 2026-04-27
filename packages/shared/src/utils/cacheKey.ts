/**
 * AI 가이드 캐시 키 생성 (조건 조합 단위)
 * Edge Function과 동일 로직
 */
export function buildCacheKey(conditions: {
  housing_type: string
  contract_type: string
  move_type: string
}): string {
  return `${conditions.housing_type}_${conditions.contract_type}_${conditions.move_type}`
}
