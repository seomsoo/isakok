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

  it('keeps WEB_VITALS metric fields and drops un-normalized path (PII 차단)', () => {
    // RUM은 route(정규화된 패턴)만 보내야 하고, 원경로(path)·임의 키는 화이트리스트에서 탈락해야 한다.
    const result = filterProps(ANALYTICS_EVENTS.WEB_VITALS, {
      metric: 'LCP',
      value: 1234,
      rating: 'good',
      route: '/checklist/:id',
      release_channel: 'production',
      path: '/checklist/3f9a1b2c-uuid', // 비허용(원경로/PII) — 제거돼야 함
    })
    expect(result).toEqual({
      metric: 'LCP',
      value: 1234,
      rating: 'good',
      route: '/checklist/:id',
      release_channel: 'production',
    })
  })
})
