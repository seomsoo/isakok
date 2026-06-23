import { describe, it, expect } from 'vitest'
import { calculateProgress, calculateEssentialProgress } from './progress'

describe('calculateProgress', () => {
  it('returns 0 for empty array', () => {
    expect(calculateProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 })
  })

  it('calculates correct progress', () => {
    const items = [
      { is_completed: true },
      { is_completed: false },
      { is_completed: true },
      { is_completed: false },
    ]
    expect(calculateProgress(items)).toEqual({ completed: 2, total: 4, percentage: 50 })
  })

  it('returns 100 when all completed', () => {
    const items = [{ is_completed: true }, { is_completed: true }]
    expect(calculateProgress(items)).toEqual({ completed: 2, total: 2, percentage: 100 })
  })

  it('returns 0 when none completed', () => {
    const items = [{ is_completed: false }, { is_completed: false }]
    expect(calculateProgress(items)).toEqual({ completed: 0, total: 2, percentage: 0 })
  })

  it('rounds percentage correctly', () => {
    const items = [{ is_completed: true }, { is_completed: false }, { is_completed: false }]
    expect(calculateProgress(items)).toEqual({ completed: 1, total: 3, percentage: 33 })
  })
})

describe('calculateEssentialProgress', () => {
  it('is_skippable=true 항목은 분모/분자에서 제외한다 (필수만 카운트)', () => {
    const items = [
      { is_completed: true, is_skippable: false },
      { is_completed: false, is_skippable: false },
      { is_completed: true, is_skippable: true }, // skippable → 제외
    ]
    expect(calculateEssentialProgress(items)).toEqual({ completed: 1, total: 2, percentage: 50 })
  })

  it('전부 skippable이면 분모 0이어도 NaN/Infinity 없이 0%', () => {
    const items = [{ is_completed: false, is_skippable: true }]
    expect(calculateEssentialProgress(items)).toEqual({ completed: 0, total: 0, percentage: 0 })
  })

  it('빈 배열은 0%', () => {
    expect(calculateEssentialProgress([])).toEqual({ completed: 0, total: 0, percentage: 0 })
  })

  it('필수 항목이 전부 완료면 100%', () => {
    const items = [
      { is_completed: true, is_skippable: false },
      { is_completed: true, is_skippable: false },
    ]
    expect(calculateEssentialProgress(items)).toEqual({ completed: 2, total: 2, percentage: 100 })
  })
})
