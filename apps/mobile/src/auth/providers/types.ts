export type OidcProviderName = 'apple' | 'google'
export type AuthProviderName = OidcProviderName | 'kakao'

export interface OidcProviderResult {
  kind: 'oidc'
  provider: OidcProviderName
  idToken: string
  accessToken?: string
  nonce?: string
}

export interface KakaoProviderResult {
  kind: 'kakao'
  accessToken: string
}

export type AuthProviderResult = OidcProviderResult | KakaoProviderResult

export interface AuthProvider {
  name: AuthProviderName
  isAvailable: () => Promise<boolean>
  signIn: () => Promise<AuthProviderResult>
  signOut: () => Promise<void>
  /**
   * Revoke 계정 연결 (계정 삭제 시 best-effort 호출).
   * - Kakao: unlink()
   * - Google: revokeAccess()
   * - Apple: 미구현 (10-4)
   *
   * 호출자는 timeout으로 감싸고, 실패해도 계정 삭제 흐름을 계속 진행해야 함.
   */
  revoke?: () => Promise<void>
}
