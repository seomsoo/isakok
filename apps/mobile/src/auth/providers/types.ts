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
}
