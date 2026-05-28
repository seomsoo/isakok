import { supabaseNative as supabase } from './supabaseNative'
import * as session from './session'
import { setCurrentSession, clearCurrentSession } from './sessionState'
import { broadcastToWebViews, broadcastSession } from './broadcast'
import type { AuthProvider, AuthProviderName, OidcProviderResult } from './providers/types'
import { AppleProvider } from './providers/AppleProvider'
import { GoogleProvider } from './providers/GoogleProvider'
import { KakaoProvider } from './providers/KakaoProvider'

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
    const code = err instanceof Error ? err.message.slice(0, 80) : 'unknown'
    console.warn(`[deleteAccount:revoke] provider=${name} error=${code}`)
  }
}

export class AuthService {
  static async ensureAnonymousSession(): Promise<void> {
    const stored = await session.load()
    if (stored) {
      const { error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      })
      if (!error) {
        const { data } = await supabase.auth.getSession()
        if (data.session) {
          await session.save(data.session)
          setCurrentSession(data.session)
          broadcastSession(data.session)
          return
        }
      }
      await session.clear()
    }
    const { data, error } = await supabase.auth.signInAnonymously()
    if (error) throw error
    if (data.session) {
      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
    }
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

    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    const wasAnonymous = !!currentUser?.is_anonymous

    if (wasAnonymous) {
      const linked = await AuthService.tryLinkIdentity(result)
      if (linked) {
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

          await session.save(data.session)
          setCurrentSession(data.session)
          broadcastSession(data.session)

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

    await session.save(data.session)
    setCurrentSession(data.session)
    broadcastSession(data.session)

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

      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
      return { userId: data.session.user.id }
    } catch {
      return null
    }
  }

  private static async signInWithKakaoToken(kakaoAccessToken: string): Promise<SignInResult> {
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser()
    const wasAnonymous = !!currentUser?.is_anonymous

    const {
      data: { session: currentSession },
    } = await supabase.auth.getSession()
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

      await session.save(sessionData.session)
      setCurrentSession(sessionData.session)
      broadcastSession(sessionData.session)

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
    await Promise.allSettled(Object.values(providers).map((p) => p.signOut()))
    await supabase.auth.signOut()
    await session.clear()
    clearCurrentSession()
    broadcastToWebViews({ type: 'AUTH_LOGOUT' })
    await AuthService.ensureAnonymousSession()
  }

  static async deleteAccount(): Promise<DeleteAccountResult> {
    let ok = false
    let stage: string | undefined

    try {
      const { error } = await supabase.functions.invoke('delete-account', { body: {} })
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
      console.warn(
        '[deleteAccount] invoke threw',
        err instanceof Error ? err.message.slice(0, 80) : 'unknown',
      )
    }

    // 500 stage(storage-remove/storage-verify/auth-provider-links/delete-user)는 서버 데이터가
    // 살아있는 부분 실패 상태 → 로컬 세션 유지하고 사용자가 재시도할 수 있게 한다.
    // ok / auth-expired(이미 삭제된 user의 stale JWT) / network 만 익명 복구 경로.
    const shouldRecoverAnonymous = ok || stage === 'auth-expired' || stage === 'network'

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
        await AuthService.ensureAnonymousSession()
      } catch (err) {
        console.warn(
          '[deleteAccount] anonymous recovery failed',
          err instanceof Error ? err.message.slice(0, 80) : 'unknown',
        )
      }
    }

    return { ok, stage }
  }

  static async refreshSession(): Promise<void> {
    const { data, error } = await supabase.auth.refreshSession()
    if (error) {
      await session.clear()
      clearCurrentSession()
      await AuthService.ensureAnonymousSession()
      return
    }
    if (data.session) {
      await session.save(data.session)
      setCurrentSession(data.session)
      broadcastSession(data.session)
    }
  }
}
