import { describe, it, expect } from 'vitest'
import { getConditionTags } from './conditionTags'
import type { AiGuideConditions } from '../types/aiGuide'

const user: AiGuideConditions = {
  housing_type: '원룸',
  contract_type: '월세',
  move_type: '용달',
}

describe('getConditionTags', () => {
  it('유저 조건과 일치하는 항목 차원만 태그로 만든다', () => {
    const tags = getConditionTags({
      userConditions: user,
      itemConditions: {
        housing_types: ['원룸', '오피스텔'],
        contract_types: ['월세'],
        move_types: ['용달', '반포장'],
      },
    })
    expect(tags).toEqual(['원룸', '월세', '용달'])
  })

  it('항목이 모든 값을 포함하는 차원("전체")은 강조 가치가 없어 태그에서 제외한다', () => {
    const tags = getConditionTags({
      userConditions: user,
      itemConditions: {
        housing_types: ['원룸', '오피스텔', '빌라', '아파트', '투룸+'], // 전체 → 제외
        contract_types: ['월세'], // 특정 → 포함
        move_types: ['용달', '반포장', '포장', '자가용'], // 전체 → 제외
      },
    })
    expect(tags).toEqual(['월세'])
  })

  it('유저 조건이 항목 조건에 없으면 그 차원은 태그하지 않는다', () => {
    const tags = getConditionTags({
      userConditions: user,
      itemConditions: {
        housing_types: ['아파트'], // 원룸 유저와 불일치
        contract_types: ['전세'], // 월세 유저와 불일치
        move_types: ['포장'], // 용달 유저와 불일치
      },
    })
    expect(tags).toEqual([])
  })

  it('전 차원이 전체(조건 무관 공통 항목)이면 태그 0개', () => {
    const tags = getConditionTags({
      userConditions: user,
      itemConditions: {
        housing_types: ['원룸', '오피스텔', '빌라', '아파트', '투룸+'],
        contract_types: ['월세', '전세'],
        move_types: ['용달', '반포장', '포장', '자가용'],
      },
    })
    expect(tags).toEqual([])
  })
})
