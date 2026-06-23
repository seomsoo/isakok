import { describe, it, expect } from 'vitest'
import { decideMemoSave, decideAfterSave } from './memoSaveMachine'

describe('decideMemoSave', () => {
  it('마지막 저장값과 같으면 저장을 생략한다', () => {
    expect(decideMemoSave('hello', { lastSaved: 'hello', inFlight: false })).toEqual({
      type: 'skip',
    })
  })

  it('저장 중이면 즉시 저장하지 않고 최신값을 버퍼링한다', () => {
    expect(decideMemoSave('world', { lastSaved: 'hello', inFlight: true })).toEqual({
      type: 'queue',
      pending: 'world',
    })
  })

  it('변경됐고 저장 중이 아니면 저장을 시작한다', () => {
    expect(decideMemoSave('world', { lastSaved: 'hello', inFlight: false })).toEqual({
      type: 'start',
      value: 'world',
    })
  })

  it('내용을 비운 것도(빈 문자열) 변경이면 저장한다', () => {
    expect(decideMemoSave('', { lastSaved: 'hello', inFlight: false })).toEqual({
      type: 'start',
      value: '',
    })
  })
})

describe('decideAfterSave', () => {
  it('버퍼된 값이 방금 저장한 값과 다르면 재저장한다 (coalesce)', () => {
    expect(decideAfterSave('v1', 'v2')).toEqual({ type: 'resave', value: 'v2' })
  })

  it('버퍼가 없으면 idle로 정착한다', () => {
    expect(decideAfterSave('v1', null)).toEqual({ type: 'settle' })
  })

  it('버퍼가 방금 저장한 값과 같으면 중복 저장하지 않는다', () => {
    expect(decideAfterSave('v1', 'v1')).toEqual({ type: 'settle' })
  })
})
