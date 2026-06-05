import { describe, it, expect } from 'vitest'
import type { Event } from '@sentry/react'
import { scrubEvent, stripUrl, redactText } from './scrub'

describe('stripUrl', () => {
  it('removes query string, keeps origin+pathname', () => {
    expect(stripUrl('https://app.com/path?token=abc&addr=seoul')).toBe('https://app.com/path')
  })
  it('falls back to pre-? slice for non-URL', () => {
    expect(stripUrl('weird?x=1')).toBe('weird')
  })
  it('passes through empty', () => {
    expect(stripUrl(undefined)).toBeUndefined()
  })
})

describe('redactText', () => {
  it('masks email', () => {
    expect(redactText('failed for user@example.com')).toBe('failed for [email]')
  })
  it('strips query from embedded url', () => {
    expect(redactText('GET https://api.co/v1/move?to_address=x failed')).toBe(
      'GET https://api.co/v1/move failed',
    )
  })
})

describe('scrubEvent', () => {
  it('keeps user.id, removes email/ip/username', () => {
    const event = {
      user: { id: 'u1', email: 'a@b.com', ip_address: '1.2.3.4', username: 'kim' },
    } as Event
    scrubEvent(event)
    expect(event.user).toEqual({ id: 'u1' })
  })

  it('removes denylisted request headers (case-insensitive) + cookies/query/data + strips url', () => {
    const event = {
      request: {
        url: 'https://app.com/p?token=x',
        headers: { Authorization: 'Bearer x', apikey: 'k', 'X-Other': 'ok' },
        cookies: { sb: '1' },
        query_string: 'token=x',
        data: { memo: 'secret' },
      },
    } as unknown as Event
    scrubEvent(event)
    expect(event.request?.headers).toEqual({ 'X-Other': 'ok' })
    expect(event.request?.cookies).toBeUndefined()
    expect(event.request?.query_string).toBeUndefined()
    expect(event.request?.data).toBeUndefined()
    expect(event.request?.url).toBe('https://app.com/p')
  })

  it('redacts email in event.message', () => {
    const event = { message: 'login failed for a@b.com' } as Event
    scrubEvent(event)
    expect(event.message).toBe('login failed for [email]')
  })

  it('redacts exception value + strips stack frame filename query (H-1)', () => {
    const event = {
      exception: {
        values: [
          {
            value: 'insert failed for a@b.com',
            stacktrace: { frames: [{ filename: 'https://app.com/assets/x.js?v=123' }] },
          },
        ],
      },
    } as unknown as Event
    scrubEvent(event)
    expect(event.exception?.values?.[0]?.value).toBe('insert failed for [email]')
    expect(event.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(
      'https://app.com/assets/x.js',
    )
  })

  it('removes nested denylisted keys in extra (recursive H-2)', () => {
    const event = {
      extra: { response: { data: { to_address: 'seoul', ok: 1 } } },
    } as unknown as Event
    scrubEvent(event)
    const data = (event.extra as { response: { data: Record<string, unknown> } }).response.data
    expect(data.to_address).toBeUndefined()
    expect(data.ok).toBe(1)
  })

  it('scrubs breadcrumb message + data denylist + url', () => {
    const event = {
      breadcrumbs: [
        {
          message: 'navigated to a@b.com',
          data: { storage_path: 'u1/x.jpg', url: 'https://app.com/p?q=1' },
        },
      ],
    } as unknown as Event
    scrubEvent(event)
    const crumb = event.breadcrumbs?.[0]
    expect(crumb?.message).toBe('navigated to [email]')
    expect(crumb?.data?.storage_path).toBeUndefined()
    expect(crumb?.data?.url).toBe('https://app.com/p')
  })
})
