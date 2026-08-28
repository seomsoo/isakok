import { supabaseNative as supabase } from './supabaseNative'
import * as session from './session'
import { clearCurrentSession, getCurrentSession } from './sessionState'
import { broadcastToWebViews } from './broadcast'
import {
  adoptRotatedSession,
  ensureSession,
  getFreshSession,
  isSessionExpired,
  persistSession,
  refreshForWeb,
} from './sessionLifecycle'
import type { EnsureSessionResult, RotatedSessionPayload } from './sessionLifecycle'
import type { AuthProvider, AuthProviderName, OidcProviderResult } from './providers/types'
import { AppleProvider } from './providers/AppleProvider'
import { GoogleProvider } from './providers/GoogleProvider'
import { KakaoProvider } from './providers/KakaoProvider'
import { unregisterPush } from '../push/registerPush'

const providers: Record<AuthProviderName, AuthProvider> = {
  apple: AppleProvider,
  google: GoogleProvider,
  kakao: KakaoProvider,
}

export type SignInResult =
  | { mode: 'identity-linked'; userId: string }
  | { mode: 'custom-linked'; userId: string }
  | { mode: 'signed-in'; userId: string }
  | {
      mode: 'conflict-pending'
      providerName: AuthProviderName
      confirm: () => Promise<SignInResult>
    }

export interface DeleteAccountResult {
  ok: boolean
  stage?: string
}

const REVOKE_TIMEOUT_MS = 5000

function describeError(err: unknown): string {
  return err instanceof Error ? err.message.slice(0, 80) : 'unknown'
}

async function withTimeout(
  p: Promise<unknown> | undefined,
  ms: number,
  name: string,
): Promise<void> {
  if (!p) return
  try {
    await Promise.race([
      p,
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
    ])
  } catch (err) {
    console.warn(`[deleteAccount:revoke] provider=${name} error=${describeError(err)}`)
  }
}

export class AuthService {
  /** 저장 세션 복원 or 익명 로그인 (ADR-110: 일시 오류엔 세션 보존 + 백오프 재시도, single-flight). */
  static ensureAnonymousSession(): Promise<EnsureSessionResult> {
    return ensureSession()
  }

  /** 만료 임박이면 갱신한 세션. 네이티브가 JWT를 쓰거나 웹에 건네기 전 관문. */
  static getFreshSession() {
    return getFreshSession()
  }

  /** 웹이 스스로 refresh해 회전된 토큰(SESSION_ROTATED)을 네이티브 정본에 반영. */
  static adoptRotatedSession(payload: RotatedSessionPayload): Promise<void> {
    return adoptRotatedSession(payload)
  }

  static async listAvailableProviders(): Promise<AuthProviderName[]> {
    const checks = await Promise.all(
      (Object.keys(providers) as AuthProviderName[]).map(async (name) => ({
        name,
        available: await providers[name].isAvailable(),
      })),
    )
    return checks.filter((c) => c.available).map((c) => c.name)
  }

  static async signInWithProvider(name: AuthProviderName): Promise<SignInResult> {
    const provider = providers[name]
    if (!provider) throw new Error(`[AuthService] unknown provider: ${name}`)

    const result = await provider.signIn()

    if (result.kind === 'kakao') {
      return AuthService.signInWithKakaoToken(result.accessToken)
    }

    // 익명 여부는 네이티브 정본 세션의 user 클레임으로 판단 — getUser() 네트워크 호출은 supabase-js 내부 세션이
    // 낡았을 때 그 refresh_token으로 갱신을 시도해 세션을 날릴 수 있다.
    const wasAnonymous = !!getCurrentSession()?.user.is_anonymous

    if (wasAnonymous) {
      const linked = await AuthService.tryLinkIdentity(result)
      if (linked) {
        await AuthService.exchangeAppleToken(result)
        return { mode: 'identity-linked', userId: linked.userId }
      }
      return {
        mode: 'conflict-pending',
        providerName: name,
        confirm: async () => {
          const { data, error } = await supabase.auth.signInWithIdToken({
            provider: result.provider,
            token: result.idToken,
            nonce: result.nonce,
          })
          if (error) throw error
          if (!data.session) throw new Error('[AuthService] session missing')

          await persistSession(data.session, { broadcast: true })
          await AuthService.exchangeAppleToken(result)

          return { mode: 'signed-in' as const, userId: data.session.user.id }
        },
      }
    }

    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: result.provider,
      token: result.idToken,
      nonce: result.nonce,
    })
    if (error) throw error
    if (!data.session) throw new Error('[AuthService] session missing')

    await persistSession(data.session, { broadcast: true })
    await AuthService.exchangeAppleToken(result)

    return { mode: 'signed-in', userId: data.session.user.id }
  }

  // ADR-043: as any is a verified exception — SDK types don't include `token` param yet.
  // linkIdentity response's user.identities is empty; use getSession() to confirm.
  private static async tryLinkIdentity(
    result: OidcProviderResult,
  ): Promise<{ userId: string } | null> {
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: result.provider,
        token: result.idToken,
        access_token: result.accessToken,
        nonce: result.nonce,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } as any) // ADR-043: SDK type gap, runtime works
      if (error) return null

      const { data } = await supabase.auth.getSession()
      if (!data.session) return null

      await persistSession(data.session, { broadcast: true })
      return { userId: data.session.user.id }
    } catch {
      return null
    }
  }

  // Apple refresh_token 교환 (ADR-077): 로그인 직후 authorization code를 apple-token-exchange로 전달.
  // best-effort — 실패해도 로그인은 성공 유지. code가 단명·1회성이라 즉시 1회 재시도, 그래도 실패면
  // 다음 로그인 때 새 code로 재확보(서버가 refresh_token 없으면 삭제 시 revoke만 건너뜀).
  private static async exchangeAppleToken(result: OidcProviderResult): Promise<void> {
    if (result.provider !== 'apple' || !result.authorizationCode) return
    const {
      data: { session: current },
    } = await supabase.auth.getSession()
    if (!current?.access_token) return

    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const { error } = await supabase.functions.invoke('apple-token-exchange', {
          body: { code: result.authorizationCode },
          headers: { Authorization: `Bearer ${current.access_token}` },
        })
        if (!error) return
        console.warn(`[apple-token-exchange] attempt=${attempt} failed`)
      } catch (err) {
        console.warn(`[apple-token-exchange] attempt=${attempt} threw`, describeError(err))
      }
    }
  }

  private static async signInWithKakaoToken(kakaoAccessToken: string): Promise<SignInResult> {
    // 익명 세션을 카카오 계정에 연결하려면 유효한 JWT가 필요 — 만료 직전이면 먼저 갱신.
    const currentSession = await getFreshSession()
    const wasAnonymous = !!currentSession?.user.is_anonymous

    const { data, error } = await supabase.functions.invoke('kakao-token-exchange', {
      body: { kakaoAccessToken },
      headers: currentSession?.access_token
        ? { Authorization: `Bearer ${currentSession.access_token}` }
        : undefined,
    })

    if (error) {
      const ctx = (error as { context?: Response & { status?: number } }).context
      const status = ctx?.status
      if (status === 409) {
        throw new Error('이미 다른 계정에 연결된 카카오 계정이에요')
      }
      throw error
    }
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error('[AuthService] Kakao token exchange response missing')
    }

    const completeKakaoLogin = async (): Promise<SignInResult> => {
      const { error: setErr } = await supabase.auth.setSession({
        access_token: data.access_token,
        refresh_token: data.refresh_token,
      })
      if (setErr) throw setErr

      const { data: sessionData } = await supabase.auth.getSession()
      if (!sessionData.session) throw new Error('[AuthService] session missing (Kakao)')

      await persistSession(sessionData.session, { broadcast: true })

      return { mode: 'signed-in' as const, userId: sessionData.session.user.id }
    }

    if (!data.linked && wasAnonymous) {
      return {
        mode: 'conflict-pending',
        providerName: 'kakao' as AuthProviderName,
        confirm: completeKakaoLogin,
      }
    }

    const completed = await completeKakaoLogin()
    if (completed.mode !== 'signed-in') return completed
    return data.linked ? { mode: 'custom-linked', userId: completed.userId } : completed
  }

  static async signOut(): Promise<void> {
    // 푸시 토큰 unbind (보안): 세션 clear 이전에 이 계정의 토큰/토글을 끊어, 같은 기기를 쓰는 다음 익명 유저에게
    // 옛 user 알림이 가지 않게 한다. JWT가 만료 직전이면 먼저 갱신 — 만료된 JWT로는 조용히 401이 나서 토큰이 남는다.
    const previous = await getFreshSession()
    if (previous) await unregisterPush(previous)

    await Promise.allSettled(Object.values(providers).map((p) => p.signOut()))
    // 서버 세션 폐기는 best-effort — 오프라인이어도 로컬 로그아웃은 반드시 진행한다.
    try {
      const { error } = await supabase.auth.signOut()
      if (error) console.warn('[signOut] server sign-out failed', describeError(error))
    } catch (err) {
      console.warn('[signOut] server sign-out threw', describeError(err))
    }
    await session.clear()
    clearCurrentSession()
    broadcastToWebViews({ type: 'AUTH_LOGOUT' })
    // 익명 세션 재생성이 실패해도(네트워크 등) 로그아웃은 완료된 것 — ensureSession이 백오프로 재시도하고
    // 성공 시 broadcast하므로 여기선 기록만 남긴다.
    try {
      await ensureSession()
    } catch (err) {
      console.warn('[signOut] anonymous session deferred', describeError(err))
    }
  }

  static async deleteAccount(): Promise<DeleteAccountResult> {
    let ok = false
    let stage: string | undefined

    // 요청 전에 자격증명을 확인한다(ADR-110 관문). 만료된 JWT로 보내면 서버 401을 "이미 삭제된 계정"으로 오판해
    // 살아있는 계정을 로컬에서만 지우게 된다. supabase-js 내부 세션(낡았을 수 있음)에 맡기지 않고 Authorization을 명시.
    const current = await getFreshSession()
    if (!current) {
      stage = 'session-lost' // 세션 없음·서버 거부 — 삭제를 요청할 자격증명이 없다 → 익명 복구
    } else if (isSessionExpired(current)) {
      stage = 'offline' // 만료됐는데 갱신이 일시 실패 — 세션 유지, 연결 후 재시도(웹 안내)
    } else {
      try {
        const { error } = await supabase.functions.invoke('delete-account', {
          body: {},
          headers: { Authorization: `Bearer ${current.access_token}` },
        })
        if (!error) {
          ok = true
        } else {
          const ctx = (error as { context?: { status?: number; body?: string } }).context
          const status = ctx?.status
          if (status === 401) {
            stage = 'auth-expired'
          } else {
            if (typeof ctx?.body === 'string') {
              try {
                const parsed = JSON.parse(ctx.body)
                if (typeof parsed?.stage === 'string') stage = parsed.stage
              } catch {
                // body wasn't JSON; ignore
              }
            }
            console.warn(`[deleteAccount] edge function failed status=${status} stage=${stage}`)
          }
        }
      } catch (err) {
        stage = 'network'
        console.warn('[deleteAccount] invoke threw', describeError(err))
      }
    }

    // 500 stage(storage-remove/storage-verify/auth-provider-links/delete-user)와 offline은 서버 데이터가
    // 살아있는 상태 → 로컬 세션 유지하고 사용자가 재시도할 수 있게 한다.
    // ok / auth-expired(유효 JWT인데 401 = 이미 삭제된 user) / network / session-lost 만 익명 복구 경로.
    const shouldRecoverAnonymous =
      ok || stage === 'auth-expired' || stage === 'network' || stage === 'session-lost'

    if (shouldRecoverAnonymous) {
      await Promise.allSettled(
        Object.entries(providers).map(([name, p]) =>
          withTimeout(p.revoke?.(), REVOKE_TIMEOUT_MS, name),
        ),
      )
      await Promise.allSettled(Object.values(providers).map((p) => p.signOut()))
      await supabase.auth.signOut()
      await session.clear()
      clearCurrentSession()
    }

    // 결과를 먼저 broadcast — AUTH_LOGOUT이 WebView를 redirect하기 전에 토스트가 도달하도록.
    broadcastToWebViews({ type: 'ACCOUNT_DELETE_RESULT', payload: { ok, stage } })

    if (shouldRecoverAnonymous) {
      broadcastToWebViews({ type: 'AUTH_LOGOUT' })
      try {
        await ensureSession()
      } catch (err) {
        console.warn('[deleteAccount] anonymous recovery failed', describeError(err))
      }
    }

    return { ok, stage }
  }

  /** 웹 REQUEST_SESSION_REFRESH(401) 대응: 강제 갱신 → broadcast. 일시 오류면 세션 유지, 서버 거부면 익명 복구. */
  static refreshSession(): Promise<void> {
    return refreshForWeb()
  }
}
