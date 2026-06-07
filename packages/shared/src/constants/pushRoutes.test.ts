import { describe, it, expect } from 'vitest'
import { normalizePushRoute } from './pushRoutes'

// 푸시 페이로드는 신뢰 경계 밖이라 allowlist 정규화가 보안 방어선(ADR-095). 우회 케이스를 고정한다.
describe('normalizePushRoute', () => {
  it('허용된 정확한 라우트는 그대로 통과', () => {
    for (const r of ['/dashboard', '/timeline', '/photos', '/settings']) {
      expect(normalizePushRoute(r)).toBe(r)
    }
  })

  it('허용 라우트의 하위 경로도 통과', () => {
    expect(normalizePushRoute('/photos/record')).toBe('/photos/record')
    expect(normalizePushRoute('/settings/notifications')).toBe('/settings/notifications')
  })

  it('string이 아니면 대시보드로 폴백', () => {
    for (const v of [null, undefined, 42, {}, ['/dashboard']]) {
      expect(normalizePushRoute(v)).toBe('/dashboard')
    }
  })

  it('외부 URL·스킴·protocol-relative는 폴백', () => {
    expect(normalizePushRoute('https://evil.com')).toBe('/dashboard')
    expect(normalizePushRoute('javascript:alert(1)')).toBe('/dashboard')
    expect(normalizePushRoute('//evil.com')).toBe('/dashboard')
    expect(normalizePushRoute('dashboard')).toBe('/dashboard') // 선행 슬래시 없음
  })

  it('미허용·경계 불일치 라우트는 폴백', () => {
    expect(normalizePushRoute('/unknown')).toBe('/dashboard')
    expect(normalizePushRoute('/checklist/123')).toBe('/dashboard') // v1.1 전까지 미허용
    expect(normalizePushRoute('/dashboardx')).toBe('/dashboard') // prefix지만 경계(/) 아님
  })
})
