import { describe, it, expect } from 'vitest'
import { getUrgencyMode, rescheduleOverdueItems } from './urgencyMode'

describe('getUrgencyMode', () => {
  it('relaxed at 30+', () => {
    expect(getUrgencyMode(30)).toBe('relaxed')
    expect(getUrgencyMode(100)).toBe('relaxed')
  })
  it('tight at 14~29', () => {
    expect(getUrgencyMode(29)).toBe('tight')
    expect(getUrgencyMode(14)).toBe('tight')
  })
  it('urgent at 7~13', () => {
    expect(getUrgencyMode(13)).toBe('urgent')
    expect(getUrgencyMode(7)).toBe('urgent')
  })
  it('critical at 0~6 and negatives', () => {
    expect(getUrgencyMode(6)).toBe('critical')
    expect(getUrgencyMode(0)).toBe('critical')
    expect(getUrgencyMode(-1)).toBe('critical')
  })
})

describe('rescheduleOverdueItems', () => {
  const today = '2026-04-13'
  const movingDate = '2026-05-01'

  it('returns [] when no overdue', () => {
    expect(
      rescheduleOverdueItems(
        [{ id: '1', assigned_date: '2026-04-20', is_completed: false, guide_type: 'tip' }],
        today,
        movingDate,
      ),
    ).toEqual([])
  })

  it('skips completed items', () => {
    expect(
      rescheduleOverdueItems(
        [{ id: '1', assigned_date: '2026-04-01', is_completed: true, guide_type: 'critical' }],
        today,
        movingDate,
      ),
    ).toEqual([])
  })

  it('sorts by priority then date, distributes within 7 days', () => {
    const result = rescheduleOverdueItems(
      [
        { id: 'tip', assigned_date: '2026-04-01', is_completed: false, guide_type: 'tip' },
        { id: 'warn', assigned_date: '2026-04-05', is_completed: false, guide_type: 'warning' },
        { id: 'crit', assigned_date: '2026-04-10', is_completed: false, guide_type: 'critical' },
      ],
      today,
      movingDate,
    )
    expect(result[0]).toEqual({ id: 'crit', display_date: '2026-04-13' })
    expect(result[1]).toEqual({ id: 'warn', display_date: '2026-04-14' })
    expect(result[2]).toEqual({ id: 'tip', display_date: '2026-04-15' })
  })

  it('cycles back when more than spread days', () => {
    const items = Array.from({ length: 9 }, (_, i) => ({
      id: `${i}`,
      assigned_date: '2026-04-01',
      is_completed: false,
      guide_type: 'tip' as const,
    }))
    const result = rescheduleOverdueItems(items, today, movingDate)
    expect(result[0]?.display_date).toBe('2026-04-13')
    expect(result[7]?.display_date).toBe('2026-04-13')
    expect(result[8]?.display_date).toBe('2026-04-14')
  })

  it('이사가 7일 이내면 분배 범위를 남은 날로 줄인다 (min(diff, 7))', () => {
    const shortMoving = '2026-04-16' // today=04-13 → 3일 남음
    const items = Array.from({ length: 5 }, (_, i) => ({
      id: `${i}`,
      assigned_date: '2026-04-01',
      is_completed: false,
      guide_type: 'tip' as const,
    }))
    const result = rescheduleOverdueItems(items, today, shortMoving)
    // spreadDays=3 → 04-13, 04-14, 04-15 순환
    expect(result[0]?.display_date).toBe('2026-04-13')
    expect(result[2]?.display_date).toBe('2026-04-15')
    expect(result[3]?.display_date).toBe('2026-04-13') // 3 % 3 = 0 → 다시 오늘
  })

  it('이사일이 오늘이거나 지났으면 모두 오늘로 배치한다 (spreadDays 하한 1)', () => {
    const items = Array.from({ length: 3 }, (_, i) => ({
      id: `${i}`,
      assigned_date: '2026-04-01',
      is_completed: false,
      guide_type: 'tip' as const,
    }))
    // movingDate=today → diff 0 → spreadDays=max(0,1)=1 → 모두 오늘
    const result = rescheduleOverdueItems(items, today, today)
    expect(result.every((r) => r.display_date === '2026-04-13')).toBe(true)
  })
})
