import { describe, it, expect } from 'vitest'
import { calculateProgress } from './progress'

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
    const items = [
      { is_completed: true },
      { is_completed: false },
      { is_completed: false },
    ]
    expect(calculateProgress(items)).toEqual({ completed: 1, total: 3, percentage: 33 })
  })
})
