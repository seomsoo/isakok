import {
  isAuthApiError,
  isAuthRefreshDiscardedError,
  isAuthRetryableFetchError,
} from '@supabase/supabase-js'
import type { Session } from '@supabase/supabase-js'
import type { WebToNativeMessage } from '@moving/shared/types/bridge'
import { supabaseNative as supabase } from './supabaseNative'
import * as sessionStore from './session'
import { getCurrentSession, setCurrentSession, clearCurrentSession } from './sessionState'
import { broadcastSession } from './broadcast'

// 세션 수명 관리 (ADR-110). 원칙:
//  1. 토큰 정본은 네이티브(SecureStore + sessionState). 웹은 AUTH_SESSION으로 받아 쓰기만 한다.
//  2. 일시적 오류(네트워크 단절·5xx)로는 절대 세션을 지우지 않는다 — 서버가 토큰을 명시적으로 거부(4xx)했을 때만.
//     지하철에서 앱을 열었다가 refresh 한 번 실패로 로그인이 풀리면 사용자에겐 "내 데이터가 사라짐"으로 보인다.
//     supabase-js가 자체 합성하는 AuthRefreshDiscardedError(409)도 서버 거부가 아니다 — refresh 도중 클라이언트
//     세션이 교체/삭제됐다는 뜻이므로 교체된 쪽을 그대로 쓴다(runRefresh).
//  3. 네이티브가 토큰을 웹에 건네거나(WEB_READY) 직접 쓰기(업로드·푸시) 전에는 만료 임박 여부를 보고 먼저 갱신한다.
//     웹 supabase-js는 autoRefreshToken=false여도 만료 90초 전이면 쿼리 경로(getSession)에서 스스로 refresh하므로,
//     네이티브 여유(120초)를 그보다 크게 둬 회전 주체가 원칙적으로 네이티브가 되게 한다.
//  4. 그래도 웹이 먼저 회전시킨 경우(백그라운드 복귀 직후 쿼리 등)는 SESSION_ROTATED로 되돌려 받아 저장한다.
//     안 그러면 네이티브가 이미 소모된 refresh_token을 들고 있다가 다음 콜드스타트에서 invalid_grant → 로그아웃.

const REFRESH_MARGIN_MS = 120_000
const RESTORE_RETRY_BASE_MS = 10_000
const RESTORE_RETRY_MAX_MS = 60_000

export type EnsureSessionResult = 'restored' | 'anonymous' | 'deferred'

export type RotatedSessionPayload = Extract<
  WebToNativeMessage,
  { type: 'SESSION_ROTATED' }
>['payload']

type RefreshResult =
  | { status: 'refreshed'; session: Session }
  /** refresh 도중 다른 경로(웹 회전 반영·재로그인)가 세션을 교체 — 그 세션이 이미 정본이며 broadcast는 출처가 담당. */
  | { status: 'superseded'; session: Session }
  | { status: 'transient' }
  | { status: 'invalid' }

function describeError(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 120) : 'unknown'
}

/** 일시적 오류(네트워크 단절·5xx·429): 토큰은 여전히 유효할 수 있으므로 세션을 지우면 안 된다. */
export function isTransientAuthError(error: unknown): boolean {
  if (isAuthRetryableFetchError(error)) return true
  if (isAuthApiError(error)) return error.status >= 500 || error.status === 429
  return false
}

function isExpiringSoon(session: Session): boolean {
  if (!session.expires_at) return true
  return session.expires_at * 1000 - Date.now() < REFRESH_MARGIN_MS
}

/** 여유 없이 실제 만료 여부. 만료된 JWT로 서버를 부르면 401이 "만료"인지 "권한 없음"인지 구분되지 않는다. */
export function isSessionExpired(session: Session): boolean {
  if (!session.expires_at) return true
  return session.expires_at * 1000 <= Date.now()
}

/** 세션을 정본(SecureStore + 메모리)에 저장하고, 필요 시 열려 있는 모든 WebView에 전달. */
export async function persistSession(
  session: Session,
  options: { broadcast: boolean },
): Promise<void> {
  await sessionStore.save(session)
  setCurrentSession(session)
  if (options.broadcast) broadcastSession(session)
}

async function discardSession(): Promise<void> {
  await sessionStore.clear()
  clearCurrentSession()
}

// ── 복원 / 익명 로그인 ────────────────────────────────────────────────────────────

let ensureInFlight: Promise<EnsureSessionResult> | null = null
let restoreRetryTimer: ReturnType<typeof setTimeout> | null = null
let restoreRetryAttempt = 0

function scheduleRestoreRetry(): void {
  if (restoreRetryTimer) return
  const delay = Math.min(RESTORE_RETRY_BASE_MS * 2 ** restoreRetryAttempt, RESTORE_RETRY_MAX_MS)
  restoreRetryAttempt += 1
  restoreRetryTimer = setTimeout(() => {
    restoreRetryTimer = null
    ensureSession().catch((err) =>
      console.warn('[sessionLifecycle] restore retry failed', describeError(err)),
    )
  }, delay)
}

function cancelRestoreRetry(): void {
  if (restoreRetryTimer) {
    clearTimeout(restoreRetryTimer)
    restoreRetryTimer = null
  }
  restoreRetryAttempt = 0
}

/**
 * 저장된 세션을 복원하고, 없으면 익명 로그인한다.
 * - 동시 호출은 하나로 합친다(single-flight): 탭 3개가 동시에 WEB_READY를 보내도 익명 계정이 여러 개 생기지 않게.
 * - 일시적 오류면 저장된 토큰을 지우지 않고 'deferred'를 돌려준 뒤 백오프로 재시도한다(성공 시 broadcast).
 * - 서버가 토큰을 거부했을 때만(폐기·재사용 감지) 버리고 익명으로 간다.
 */
export function ensureSession(): Promise<EnsureSessionResult> {
  if (ensureInFlight) return ensureInFlight
  ensureInFlight = runEnsureSession().finally(() => {
    ensureInFlight = null
  })
  return ensureInFlight
}

async function runEnsureSession(): Promise<EnsureSessionResult> {
  const stored = await sessionStore.load()
  if (stored) {
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    })
    if (!error && data.session) {
      cancelRestoreRetry()
      await persistSession(data.session, { broadcast: true })
      return 'restored'
    }
    if (error && isTransientAuthError(error)) {
      console.warn('[sessionLifecycle] restore deferred (transient):', error.message)
      scheduleRestoreRetry()
      return 'deferred'
    }
    console.warn(
      '[sessionLifecycle] stored session rejected → anonymous:',
      error?.message ?? 'no session returned',
    )
    await discardSession()
  }

  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) {
    if (isTransientAuthError(error)) {
      console.warn('[sessionLifecycle] anonymous sign-in deferred (transient):', error.message)
      scheduleRestoreRetry()
      return 'deferred'
    }
    throw error
  }
  if (!data.session) throw new Error('[sessionLifecycle] anonymous sign-in returned no session')
  cancelRestoreRetry()
  await persistSession(data.session, { broadcast: true })
  return 'anonymous'
}

// ── 갱신 ─────────────────────────────────────────────────────────────────────

let refreshInFlight: Promise<RefreshResult> | null = null

/** 현재 세션의 refresh_token으로 갱신. 성공 시 저장 + broadcast(회전된 토큰을 웹도 써야 하므로). */
function refreshCurrentSession(): Promise<RefreshResult> {
  if (refreshInFlight) return refreshInFlight
  refreshInFlight = runRefresh().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

async function runRefresh(): Promise<RefreshResult> {
  const current = getCurrentSession()
  if (!current) return { status: 'invalid' }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: current.refresh_token,
  })
  if (error) {
    if (isAuthRefreshDiscardedError(error)) {
      // supabase-js 커밋 가드: refresh가 서버를 다녀오는 사이 내부 세션이 바뀌었다(SESSION_ROTATED 반영의 setSession,
      // 재로그인, 동시 signOut). 서버가 토큰을 거부한 게 아니므로 정본을 지우면 안 된다 — 지우면 방금 들어온
      // 유효한 교체 세션까지 날아가 로그아웃된다. 정본을 다시 읽어 교체된 쪽을 쓴다.
      const latest = getCurrentSession()
      if (!latest) return { status: 'invalid' } // 동시 signOut — 정본은 이미 비워져 있음
      if (latest.refresh_token === current.refresh_token) {
        // 내부 세션은 바뀌었는데 정본 반영은 아직(재로그인 persist 직전) — 반영 주체에 맡기고 현재 것을 유지
        console.warn(
          '[sessionLifecycle] refresh discarded (session changing mid-flight) → keeping current',
        )
        return { status: 'transient' }
      }
      console.warn(
        '[sessionLifecycle] refresh discarded (session replaced mid-flight) → using replacement',
      )
      return { status: 'superseded', session: latest }
    }
    if (isTransientAuthError(error)) {
      console.warn('[sessionLifecycle] refresh deferred (transient):', error.message)
      return { status: 'transient' }
    }
    console.warn('[sessionLifecycle] refresh rejected → discarding session:', error.message)
    await discardSession()
    return { status: 'invalid' }
  }
  if (!data.session) return { status: 'transient' }
  await persistSession(data.session, { broadcast: true })
  return { status: 'refreshed', session: data.session }
}

/**
 * 만료 임박이면 먼저 갱신한 뒤 세션을 돌려준다. 네이티브가 JWT를 직접 쓰는 경로(업로드·푸시·로그아웃)와
 * 웹에 세션을 건네는 경로(WEB_READY)가 만료된 토큰을 쓰지 않게 하는 관문.
 * 갱신이 일시 실패하면 현재 세션을 그대로 돌려주고(호출부가 401 가능성 감수), 서버가 거부했으면 null.
 */
export async function getFreshSession(): Promise<Session | null> {
  const current = getCurrentSession()
  if (!current) return null
  if (!isExpiringSoon(current)) return current
  const result = await refreshCurrentSession()
  if (result.status === 'refreshed' || result.status === 'superseded') return result.session
  if (result.status === 'transient') return current
  return null
}

/**
 * 웹이 401을 받아 REQUEST_SESSION_REFRESH를 보냈을 때: 강제 갱신 → broadcast.
 * 서버가 거부하면 익명으로 복구하고, 네이티브에 세션이 없으면(복원 보류 중) 복원을 재시도한다.
 */
export async function refreshForWeb(): Promise<void> {
  if (!getCurrentSession()) {
    await ensureSession()
    return
  }
  const result = await refreshCurrentSession()
  if (result.status === 'invalid') await ensureSession()
}

// ── 웹 회전 반영 ──────────────────────────────────────────────────────────────

/**
 * 웹 supabase-js가 스스로 refresh해 회전된 토큰(SESSION_ROTATED)을 네이티브 정본에 반영한다.
 * 로컬 저장을 먼저 한다(네트워크와 무관 — 다음 콜드스타트가 최신 refresh_token을 쓰도록). supabase-js 내부
 * 세션 동기화(setSession, /user 1회 호출)는 best-effort. 웹이 출처이므로 다시 broadcast하지 않는다.
 */
export async function adoptRotatedSession(payload: RotatedSessionPayload): Promise<void> {
  const current = getCurrentSession()
  if (!current) return // 네이티브에 세션이 없는데 웹이 회전 — 출처 불명, 무시
  if (current.user.id !== payload.user_id) return // 로그인 전환 직전의 낡은 웹 세션 — 무시
  if (current.refresh_token === payload.refresh_token) return // 이미 반영됨

  const adopted: Session = {
    ...current,
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
    expires_at: payload.expires_at,
    expires_in: Math.max(0, payload.expires_at - Math.floor(Date.now() / 1000)),
  }
  await persistSession(adopted, { broadcast: false })

  const { data, error } = await supabase.auth.setSession({
    access_token: payload.access_token,
    refresh_token: payload.refresh_token,
  })
  if (error) {
    console.warn(
      '[sessionLifecycle] setSession after rotation failed (local copy kept):',
      error.message,
    )
    return
  }
  if (data.session) await persistSession(data.session, { broadcast: false })
}
