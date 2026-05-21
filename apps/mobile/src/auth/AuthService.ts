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
  | { mode: 'signed-in'; userId: string; conflict: boolean }

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
        await AuthService.ensureUsersProviderUpdated(linked.userId, result.provider)
        return { mode: 'identity-linked', userId: linked.userId }
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
    await AuthService.ensureUsersProviderUpdated(data.session.user.id, result.provider)

    return {
      mode: 'signed-in',
      userId: data.session.user.id,
      conflict: wasAnonymous,
    }
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
      const status = (error as { context?: { response?: { status?: number } } }).context?.response
        ?.status
      if (status === 409) {
        return {
          mode: 'signed-in',
          userId: currentUser?.id ?? '',
          conflict: true,
        }
      }
      throw error
    }
    if (!data?.access_token || !data?.refresh_token) {
      throw new Error('[AuthService] Kakao token exchange response missing')
    }

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
    await AuthService.ensureUsersProviderUpdated(sessionData.session.user.id, 'kakao')

    return {
      mode: data.linked ? 'custom-linked' : 'signed-in',
      userId: sessionData.session.user.id,
      conflict: !data.linked && wasAnonymous,
    }
  }

  // ADR-054: primary path is the DB trigger; this is a defensive fallback
  private static async ensureUsersProviderUpdated(userId: string, provider: string) {
    try {
      await supabase.from('users').update({ provider }).eq('id', userId).eq('provider', 'anonymous')
    } catch {
      // best effort
    }
  }

  static async signOut(): Promise<void> {
    await Promise.allSettled(Object.values(providers).map((p) => p.signOut()))
    await supabase.auth.signOut()
    await session.clear()
    clearCurrentSession()
    broadcastToWebViews({ type: 'AUTH_LOGOUT' })
    await AuthService.ensureAnonymousSession()
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
