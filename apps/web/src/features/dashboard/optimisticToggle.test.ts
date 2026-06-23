import { describe, it, expect } from 'vitest'
import { applyCompletionToggle, toggleItemsCompletion } from './optimisticToggle'

const NOW = '2026-06-21T00:00:00.000Z'

describe('applyCompletionToggle', () => {
  it('대상 항목을 완료로 바꾸고 completed_at에 now를 넣는다', () => {
    const item = { id: 'a', is_completed: false, completed_at: null, title: 'x' }
    expect(applyCompletionToggle(item, 'a', true, NOW)).toEqual({
      id: 'a',
      is_completed: true,
      completed_at: NOW,
      title: 'x',
    })
  })

  it('완료 해제 시 completed_at을 null로 되돌린다', () => {
    const item = { id: 'a', is_completed: true, completed_at: NOW }
    expect(applyCompletionToggle(item, 'a', false, NOW)).toEqual({
      id: 'a',
      is_completed: false,
      completed_at: null,
    })
  })

  it('대상이 아닌 항목은 동일 참조로 그대로 반환한다', () => {
    const item = { id: 'b', is_completed: false, completed_at: null }
    expect(applyCompletionToggle(item, 'a', true, NOW)).toBe(item)
  })
})

describe('toggleItemsCompletion', () => {
  it('리스트에서 해당 id만 토글하고 나머지는 참조를 보존한다', () => {
    const items = [
      { id: 'a', is_completed: false, completed_at: null },
      { id: 'b', is_completed: false, completed_at: null },
    ]
    const result = toggleItemsCompletion(items, 'b', true, NOW)
    expect(result[0]).toBe(items[0]) // 미변경 항목은 동일 참조
    expect(result[1]).toEqual({ id: 'b', is_completed: true, completed_at: NOW })
  })

  it('빈 리스트는 빈 리스트', () => {
    expect(toggleItemsCompletion([], 'a', true, NOW)).toEqual([])
  })
})
