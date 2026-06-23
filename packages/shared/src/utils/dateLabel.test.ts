import { describe, it, expect } from 'vitest'
import { getRelativeDateLabel, parseLocalDate, formatDateKorean } from './dateLabel'

describe('getRelativeDateLabel', () => {
  it('이사 전 구간을 경계값으로 라벨링한다', () => {
    expect(getRelativeDateLabel(-30)).toBe('이사 4주 전')
    expect(getRelativeDateLabel(-21)).toBe('이사 4주 전')
    expect(getRelativeDateLabel(-20)).toBe('이사 2~3주 전')
    expect(getRelativeDateLabel(-14)).toBe('이사 2~3주 전')
    expect(getRelativeDateLabel(-13)).toBe('이사 1~2주 전')
    expect(getRelativeDateLabel(-7)).toBe('이사 1~2주 전')
    expect(getRelativeDateLabel(-6)).toBe('이사 1주 전')
    expect(getRelativeDateLabel(-3)).toBe('이사 1주 전')
  })

  it('이사 임박/당일/직후를 정확한 문구로 구분한다', () => {
    expect(getRelativeDateLabel(-2)).toBe('이사 이틀 전')
    expect(getRelativeDateLabel(-1)).toBe('이사 전날')
    expect(getRelativeDateLabel(0)).toBe('이사 당일')
    expect(getRelativeDateLabel(1)).toBe('이사 다음 날')
  })

  it('이사 후 첫 주는 입주 첫 주, 그 이후는 D+N', () => {
    expect(getRelativeDateLabel(2)).toBe('입주 첫 주')
    expect(getRelativeDateLabel(7)).toBe('입주 첫 주')
    expect(getRelativeDateLabel(8)).toBe('D+8')
    expect(getRelativeDateLabel(30)).toBe('D+30')
  })
})

describe('parseLocalDate', () => {
  it('YYYY-MM-DD를 로컬 시간대로 파싱한다 (UTC 하루 밀림 방지)', () => {
    const d = parseLocalDate('2026-03-26')
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(2) // 0-based → 3월
    expect(d.getDate()).toBe(26)
    expect(d.getHours()).toBe(0) // 로컬 자정, UTC 변환으로 인한 밀림 없음
  })

  it('연/월 경계(1월 1일)도 밀리지 않는다', () => {
    const d = parseLocalDate('2026-01-01')
    expect(d.getMonth()).toBe(0)
    expect(d.getDate()).toBe(1)
  })
})

describe('formatDateKorean', () => {
  it('한국어 날짜 + 요일로 포맷한다', () => {
    // 2026-01-01은 목요일
    expect(formatDateKorean('2026-01-01')).toBe('1월 1일 (목)')
  })

  it('한 자리 월/일은 0 패딩 없이 표기한다', () => {
    expect(formatDateKorean('2026-03-05')).toMatch(/^3월 5일 \([일월화수목금토]\)$/)
  })
})
