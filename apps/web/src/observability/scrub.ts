import type { Event, Breadcrumb } from '@sentry/react'

/**
 * Sentry PII 스크럽 (스펙 11 §5-2, ADR-089 — 스펙 본문 표기 ADR-088)
 *
 * 이 앱의 PII = 주소·연락처·메모·사진(파일/경로)·이메일. 이 다섯은 어떤 이벤트
 * payload에도 나가면 안 된다. `beforeSend`에서 denylist로 삭제/마스킹하고, URL은
 * query string을 제거한다. extra/context는 allowlist 기반으로만 추가하므로(호출부 규율)
 * 여기서는 들어올 수 있는 표준 필드 + 자유 텍스트(메시지·스택)를 마지막 그물로 방어한다.
 */

/** breadcrumb.data / context에서 통째로 제거할 키 (PII 또는 자격증명). */
const DENY_DATA_KEYS = new Set([
  'storage_path',
  'storagePath',
  'file_name',
  'fileName',
  'filename',
  'address',
  'from_address',
  'to_address',
  'memo',
  'phone',
  'email',
  'access_token',
  'refresh_token',
  'authorization',
  'cookie',
])

/** 요청 헤더에서 제거할 키 (소문자 비교). */
const DENY_HEADER_KEYS = new Set(['authorization', 'cookie', 'x-supabase-auth', 'apikey'])

/** 중첩 객체 스크럽 깊이 상한 (순환·과대 객체 방어). */
const MAX_SCRUB_DEPTH = 5

/** 자유 텍스트에서 마스킹할 이메일 패턴. 한글 주소·메모는 패턴화 불가라 호출부 규율이 1차 방어. */
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g
/** 자유 텍스트에 박힌 URL의 query string 제거 (토큰·주소·검색어가 쿼리로 새는 것 차단). */
const URL_QUERY_RE = /(https?:\/\/[^\s)]+?)\?[^\s)]*/g

/**
 * URL에서 query string을 제거 (origin + pathname만 남김).
 * 주소/토큰/검색어가 쿼리로 새는 것을 막는다. 파싱 실패 시 `?` 앞부분만 사용.
 */
export function stripUrl(url?: string): string | undefined {
  if (!url) return url
  try {
    const u = new URL(url)
    return `${u.origin}${u.pathname}`
  } catch {
    return url.split('?')[0]
  }
}

/**
 * 자유 텍스트(에러 메시지·breadcrumb message·예외 value) PII 마스킹.
 * URL query 제거 + 이메일 마스킹. 입력이 비면 그대로 반환.
 */
export function redactText(text?: string): string | undefined {
  if (!text) return text
  return text.replace(URL_QUERY_RE, '$1').replace(EMAIL_RE, '[email]')
}

/**
 * 객체에서 denylist 키를 깊이 우선으로 in-place 삭제 (중첩 PII 차단 — H-2).
 * 배열·중첩 객체를 MAX_SCRUB_DEPTH까지 순회. denylist 키는 통째로 제거.
 */
function stripDenyKeys(value: unknown, depth = 0): void {
  if (depth > MAX_SCRUB_DEPTH || !value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) stripDenyKeys(item, depth + 1)
    return
  }
  const obj = value as Record<string, unknown>
  for (const key of Object.keys(obj)) {
    if (DENY_DATA_KEYS.has(key)) {
      delete obj[key]
      continue
    }
    stripDenyKeys(obj[key], depth + 1)
  }
}

/** breadcrumb 1건 스크럽: message 마스킹 + PII 데이터 키 삭제 + url query 제거. */
function scrubBreadcrumb(crumb: Breadcrumb): Breadcrumb {
  if (typeof crumb.message === 'string') crumb.message = redactText(crumb.message)
  if (crumb.data) {
    stripDenyKeys(crumb.data)
    if (typeof crumb.data.url === 'string') crumb.data.url = stripUrl(crumb.data.url)
    if (typeof crumb.data.from === 'string') crumb.data.from = stripUrl(crumb.data.from)
    if (typeof crumb.data.to === 'string') crumb.data.to = stripUrl(crumb.data.to)
  }
  return crumb
}

/**
 * Sentry `beforeSend` 훅 — 전송 직전 모든 PII/자격증명 제거.
 * 전송 자체는 막지 않는다(에러 가시성 유지). null 반환으로 드롭하지 않음.
 * 제네릭으로 받은 이벤트 타입(ErrorEvent 등)을 그대로 반환 — beforeSend 시그니처와 정합.
 */
export function scrubEvent<T extends Event>(event: T): T {
  // user: id만 유지 (email/ip 제거). setUser({ id })만 호출하지만 방어적으로 한 번 더.
  if (event.user) {
    delete event.user.email
    delete event.user.ip_address
    delete event.user.username
  }

  // request: 헤더/쿠키/쿼리/바디 제거 + url query strip
  if (event.request) {
    if (event.request.headers) {
      for (const key of Object.keys(event.request.headers)) {
        if (DENY_HEADER_KEYS.has(key.toLowerCase())) delete event.request.headers[key]
      }
    }
    delete event.request.cookies
    delete event.request.query_string
    delete event.request.data
    event.request.url = stripUrl(event.request.url)
  }

  // message: captureMessage 경로 — url query/email 마스킹
  if (typeof event.message === 'string') {
    event.message = redactText(event.message)
  }

  // exception: 에러 메시지 본문 + stack frame filename. 실무 최대 PII 누수원이라
  // (메시지에 박힌 주소/이메일/토큰, 스택 frame URL의 쿼리) 호출부 규율의 마지막 그물로 막는다.
  if (event.exception?.values) {
    for (const value of event.exception.values) {
      if (typeof value.value === 'string') value.value = redactText(value.value)
      if (value.stacktrace?.frames) {
        for (const frame of value.stacktrace.frames) {
          if (typeof frame.filename === 'string') frame.filename = stripUrl(frame.filename)
        }
      }
    }
  }

  // breadcrumbs: 각 항목 message/데이터 스크럽
  if (event.breadcrumbs) {
    event.breadcrumbs = event.breadcrumbs.map(scrubBreadcrumb)
  }

  // contexts/extra: 표준 위치에 섞여 들어온 PII 키 방어 (호출부 allowlist가 1차 방어, 중첩까지 재귀)
  if (event.extra) stripDenyKeys(event.extra)
  if (event.contexts) {
    for (const ctx of Object.values(event.contexts)) {
      if (ctx && typeof ctx === 'object') stripDenyKeys(ctx as Record<string, unknown>)
    }
  }

  return event
}
