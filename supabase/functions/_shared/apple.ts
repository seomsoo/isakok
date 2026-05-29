// Apple Sign in 토큰 교환/철회 공용 (ADR-077)
// client_secret JWT(ES256, .p8)를 생성해 Apple /auth/token(code 교환) · /auth/revoke 를 호출.
// .p8 서명 키 등은 Edge Function secret(APPLE_TEAM_ID/KEY_ID/CLIENT_ID/PRIVATE_KEY).

interface AppleTokenResponse {
  access_token?: string
  refresh_token?: string
  id_token?: string
  error?: string
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input
  let bin = ''
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i])
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function base64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/')
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return bytes
}

function pemToDer(pem: string): Uint8Array {
  const normalized = pem.includes('\\n') ? pem.replace(/\\n/g, '\n') : pem
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  return base64urlToBytes(body.replace(/\+/g, '-').replace(/\//g, '_'))
}

// client_secret JWT는 만료가 짧아 매 호출 생성하되 단기 캐시(5분).
let cachedSecret: { jwt: string; exp: number } | null = null

export async function createAppleClientSecret(): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  if (cachedSecret && cachedSecret.exp - now > 30) return cachedSecret.jwt

  const teamId = Deno.env.get('APPLE_TEAM_ID')
  const keyId = Deno.env.get('APPLE_KEY_ID')
  const clientId = Deno.env.get('APPLE_CLIENT_ID')
  const p8 = Deno.env.get('APPLE_PRIVATE_KEY')
  if (!teamId || !keyId || !clientId || !p8) {
    throw new Error(
      'Apple env missing (APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_CLIENT_ID/APPLE_PRIVATE_KEY)',
    )
  }

  const exp = now + 300
  const header = base64url(JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }))
  const payload = base64url(
    JSON.stringify({ iss: teamId, iat: now, exp, aud: 'https://appleid.apple.com', sub: clientId }),
  )
  const signingInput = `${header}.${payload}`

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(p8),
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  // Web Crypto ECDSA는 raw r||s(64바이트) 서명을 반환 — JWS ES256 규격과 동일(DER 변환 불요).
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    new TextEncoder().encode(signingInput),
  )
  const jwt = `${signingInput}.${base64url(new Uint8Array(sig))}`
  cachedSecret = { jwt, exp }
  return jwt
}

function appleClientId(): string {
  const clientId = Deno.env.get('APPLE_CLIENT_ID')
  if (!clientId) throw new Error('APPLE_CLIENT_ID missing')
  return clientId
}

/** id_token payload의 sub(Apple 사용자 식별자) 추출. */
export function decodeJwtSub(idToken: string): string | null {
  const parts = idToken.split('.')
  if (parts.length < 2) return null
  try {
    const json = JSON.parse(new TextDecoder().decode(base64urlToBytes(parts[1]))) as {
      sub?: string
    }
    return typeof json.sub === 'string' ? json.sub : null
  } catch {
    return null
  }
}

/** authorization code → refresh_token + sub 교환. */
export async function exchangeAppleAuthCode(
  code: string,
): Promise<{ refreshToken: string | null; sub: string | null; error?: string }> {
  const clientSecret = await createAppleClientSecret()
  const body = new URLSearchParams({
    client_id: appleClientId(),
    client_secret: clientSecret,
    code,
    grant_type: 'authorization_code',
  })
  const res = await fetch('https://appleid.apple.com/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })
  const json = (await res.json().catch(() => ({}))) as AppleTokenResponse
  if (!res.ok) return { refreshToken: null, sub: null, error: json.error ?? `token_${res.status}` }
  return {
    refreshToken: json.refresh_token ?? null,
    sub: json.id_token ? decodeJwtSub(json.id_token) : null,
  }
}

/**
 * refresh_token 철회 (best-effort, 기본 5s timeout). invalid_grant(이미 해제)는 성공 취급.
 * 어떤 예외(secret 누락·네트워크·timeout abort)도 밖으로 던지지 않는다 — revoke 실패가 계정 삭제를
 * 막으면 안 되기 때문(ADR-067/077). 호출자는 반환된 { ok } 만 보고 판단한다.
 */
export async function revokeAppleToken(
  refreshToken: string,
  timeoutMs = 5000,
): Promise<{ ok: boolean; error?: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const clientSecret = await createAppleClientSecret()
    const body = new URLSearchParams({
      client_id: appleClientId(),
      client_secret: clientSecret,
      token: refreshToken,
      token_type_hint: 'refresh_token',
    })
    const res = await fetch('https://appleid.apple.com/auth/revoke', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: controller.signal,
    })
    if (res.ok) return { ok: true }
    const json = (await res.json().catch(() => ({}))) as { error?: string }
    if (json.error === 'invalid_grant') return { ok: true }
    return { ok: false, error: json.error ?? `revoke_${res.status}` }
  } catch (err) {
    // createAppleClientSecret throw(secret 누락) / fetch 네트워크 실패 / timeout abort 모두 흡수.
    return { ok: false, error: err instanceof Error ? err.message.slice(0, 80) : 'revoke_threw' }
  } finally {
    clearTimeout(timer)
  }
}
