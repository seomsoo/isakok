import { describe, it, expect, vi } from 'vitest'
import { filterProps, ANALYTICS_EVENTS } from './events'

// posthog-js는 브라우저 전용 — 순수 filterProps만 테스트하므로 import 부수효과를 차단(vitest가 hoist).
vi.mock('posthog-js', () => ({ default: {} }))

describe('filterProps', () => {
  it('keeps only allowlisted keys for a registered event', () => {
    const result = filterProps(ANALYTICS_EVENTS.PHOTO_UPLOADED, {
      count: 3,
      room_type: 'kitchen',
      storage_path: 'u1/x.jpg', // 비허용 — 제거돼야 함
    })
    expect(result).toEqual({ count: 3, room_type: 'kitchen' })
  })

  it('returns undefined for an unregistered event (no props leak)', () => {
    expect(filterProps(ANALYTICS_EVENTS.ONBOARDING_STARTED, { foo: 'bar' })).toBeUndefined()
  })

  it('returns undefined when no allowlisted key is present', () => {
    expect(
      filterProps(ANALYTICS_EVENTS.RESCHEDULE_MODE_CHANGED, { notallowed: 'x' }),
    ).toBeUndefined()
  })

  it('returns undefined when props are omitted', () => {
    expect(filterProps(ANALYTICS_EVENTS.PHOTO_UPLOADED)).toBeUndefined()
  })
})
