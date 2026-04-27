import type { AiGuideConditions } from '../types/aiGuide'

const ALL_HOUSING = ['원룸', '오피스텔', '빌라', '아파트', '투룸+'] as const
const ALL_CONTRACT = ['월세', '전세'] as const
const ALL_MOVE = ['용달', '반포장', '포장', '자가용'] as const

function isAllSet(values: string[], allValues: readonly string[]): boolean {
  if (values.length < allValues.length) return false
  const set = new Set(values)
  return allValues.every((v) => set.has(v))
}

/**
 * 유저 조건과 항목 조건의 교집합에서 태그를 생성
 * 항목 조건이 "전체"면 해당 차원은 강조 가치 없으므로 태그 제외
 * @returns 0~3개 태그 배열
 */
export function getConditionTags({
  userConditions,
  itemConditions,
}: {
  userConditions: AiGuideConditions
  itemConditions: {
    housing_types: string[]
    contract_types: string[]
    move_types: string[]
  }
}): string[] {
  const tags: string[] = []

  if (
    !isAllSet(itemConditions.housing_types, ALL_HOUSING) &&
    itemConditions.housing_types.includes(userConditions.housing_type)
  ) {
    tags.push(userConditions.housing_type)
  }
  if (
    !isAllSet(itemConditions.contract_types, ALL_CONTRACT) &&
    itemConditions.contract_types.includes(userConditions.contract_type)
  ) {
    tags.push(userConditions.contract_type)
  }
  if (
    !isAllSet(itemConditions.move_types, ALL_MOVE) &&
    itemConditions.move_types.includes(userConditions.move_type)
  ) {
    tags.push(userConditions.move_type)
  }

  return tags
}
