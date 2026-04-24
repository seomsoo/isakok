import { describe, it, expect } from 'vitest'
import { generateFileHash } from './photoHash'

describe('generateFileHash', () => {
  it('returns 64-char hex SHA-256 for a blob', async () => {
    const blob = new Blob(['hello world'], { type: 'text/plain' })
    const hash = await generateFileHash(blob)
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
    // 알려진 sha256("hello world")
    expect(hash).toBe('b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9')
  })

  it('returns same hash for same bytes', async () => {
    const a = new Blob(['same'])
    const b = new Blob(['same'])
    expect(await generateFileHash(a)).toBe(await generateFileHash(b))
  })

  it('returns different hash for different bytes', async () => {
    const a = new Blob(['a'])
    const b = new Blob(['b'])
    expect(await generateFileHash(a)).not.toBe(await generateFileHash(b))
  })
})
