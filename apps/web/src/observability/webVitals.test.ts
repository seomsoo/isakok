import { describe, it, expect, vi, afterEach } from 'vitest'
import type { Metric } from 'web-vitals'

// vi.mock 팩토리는 파일 상단으로 hoist되므로, 거기서 참조할 스파이는 vi.hoisted로 함께 끌어올린다.
const { onLCP, onCLS, onINP, onFCP, onTTFB, captureEvent } = vi.hoisted(() => ({
  onLCP: vi.fn(),
  onCLS: vi.fn(),
  onINP: vi.fn(),
  onFCP: vi.fn(),
  onTTFB: vi.fn(),
  captureEvent: vi.fn(),
}))

// web-vitals 등록 함수를 스파이로 — 등록 여부 확인 + 등록된 report 콜백을 추출해 직접 호출.
vi.mock('web-vitals', () => ({ onLCP, onCLS, onINP, onFCP, onTTFB }))

// captureEvent 스파이 — report가 화이트리스트 이벤트(web_vitals)로 전송하는지 검사.
vi.mock('./events', () => ({
  captureEvent,
  ANALYTICS_EVENTS: { WEB_VITALS: 'web_vitals' },
}))

// 기본 모듈은 production으로 로드(ENABLED=true) — 등록·report 경로를 검사한다.
vi.mock('./env', () => ({ isProduction: () => true }))

import { initWebVitals, toRoutePattern } from './webVitals'

const fakeMetric = (name: string, value: number, rating: string) =>
  ({ name, value, rating }) as unknown as Metric

describe('toRoutePattern', () => {
  it('정적 경로는 그대로 둔다', () => {
    expect(toRoutePattern('/dashboard')).toBe('/dashboard')
  })
  it('UUID 세그먼트를 :id로 정규화한다(원경로/식별자 미전송)', () => {
    expect(toRoutePattern('/checklist/3f9a1b2c-4d5e-6f70-8a90-1b2c3d4e5f60')).toBe('/checklist/:id')
  })
  it('숫자 id 세그먼트를 :id로 정규화한다', () => {
    expect(toRoutePattern('/move/12345')).toBe('/move/:id')
  })
  it('루트 경로(/)를 그대로 반환한다', () => {
    expect(toRoutePattern('/')).toBe('/')
  })
  it('여러 동적 세그먼트를 모두 정규화한다', () => {
    expect(toRoutePattern('/a/1/b/9c8d7e6f-0000-1111-2222-333344445555')).toBe('/a/:id/b/:id')
  })
})

describe('initWebVitals (production)', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('5개 Core Web Vitals를 등록하고 report는 정규화 route로 화이트리스트 전송 + 중복 가드', () => {
    vi.stubGlobal('window', {
      location: { pathname: '/checklist/3f9a1b2c-4d5e-6f70-8a90-1b2c3d4e5f60' },
    })

    initWebVitals()
    expect(onLCP).toHaveBeenCalledOnce()
    expect(onCLS).toHaveBeenCalledOnce()
    expect(onINP).toHaveBeenCalledOnce()
    expect(onFCP).toHaveBeenCalledOnce()
    expect(onTTFB).toHaveBeenCalledOnce()

    const report = onLCP.mock.calls[0]?.[0] as (m: Metric) => void
    expect(report).toBeTypeOf('function')

    // (a) window 경로를 :id로 정규화 + release_channel 미설정 시 'unknown' fallback
    captureEvent.mockClear()
    report(fakeMetric('LCP', 2500, 'good'))
    expect(captureEvent).toHaveBeenCalledWith('web_vitals', {
      metric: 'LCP',
      value: 2500,
      rating: 'good',
      route: '/checklist/:id',
      release_channel: 'unknown',
    })

    // (b) VITE_RELEASE_CHANNEL이 있으면 그 값을 release_channel로 전송(internal/production 구분)
    vi.stubEnv('VITE_RELEASE_CHANNEL', 'production')
    captureEvent.mockClear()
    report(fakeMetric('CLS', 0.01, 'good'))
    expect(captureEvent.mock.calls[0]?.[1]).toMatchObject({ release_channel: 'production' })

    // (c) 중복 호출은 재등록하지 않는다(initialized 가드 — HMR·remount·WebView reload 대비)
    onLCP.mockClear()
    initWebVitals()
    expect(onLCP).not.toHaveBeenCalled()
  })
})

describe('initWebVitals (production 아님)', () => {
  it('ENABLED=false면 아무 metric도 등록하지 않는다', async () => {
    vi.resetModules()
    vi.doMock('./env', () => ({ isProduction: () => false }))
    vi.doMock('web-vitals', () => ({ onLCP, onCLS, onINP, onFCP, onTTFB }))
    vi.doMock('./events', () => ({ captureEvent, ANALYTICS_EVENTS: { WEB_VITALS: 'web_vitals' } }))
    const mod = await import('./webVitals')
    onLCP.mockClear()
    mod.initWebVitals()
    expect(onLCP).not.toHaveBeenCalled()
    vi.doUnmock('./env')
  })
})
