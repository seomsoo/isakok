import { describe, it, expect } from 'vitest'
import { assertEnvRefPairing } from './envFingerprint'

const PROD_URL = 'https://ybcqinanfcarhqkclvue.supabase.co'
const DEV_URL = 'https://yiffgoxnyyngkbasyfaw.supabase.co'
const LOCAL_STACK_URL = 'http://127.0.0.1:54321'

describe('assertEnvRefPairing (스펙 14 §5-6)', () => {
  it('production × prod ref는 통과한다', () => {
    expect(() => assertEnvRefPairing(PROD_URL, 'production')).not.toThrow()
  })

  it('development × dev ref는 통과한다', () => {
    expect(() => assertEnvRefPairing(DEV_URL, 'development')).not.toThrow()
  })

  it('production × dev ref는 throw한다 (production 빌드가 dev 데이터에 쓰는 조합 차단)', () => {
    expect(() => assertEnvRefPairing(DEV_URL, 'production')).toThrow(
      'production 빌드가 prod가 아닌',
    )
  })

  it('development × prod ref는 throw한다 (dev/preview가 prod를 조용히 바라보는 최악 조합 차단)', () => {
    expect(() => assertEnvRefPairing(PROD_URL, 'development')).toThrow('prod Supabase를 바라본다')
  })

  it('로컬 스택 URL은 환경과 무관하게 검증 제외한다 (E2E·로컬 Docker 무영향)', () => {
    expect(() => assertEnvRefPairing(LOCAL_STACK_URL, 'development')).not.toThrow()
    expect(() => assertEnvRefPairing(LOCAL_STACK_URL, 'production')).not.toThrow()
  })

  it('URL 누락은 검증 제외한다 (누락 실패는 lib/supabase.ts 소관)', () => {
    expect(() => assertEnvRefPairing(undefined, 'production')).not.toThrow()
    expect(() => assertEnvRefPairing('', 'development')).not.toThrow()
  })
})
