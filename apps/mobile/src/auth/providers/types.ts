export type OidcProviderName = 'apple' | 'google'
export type AuthProviderName = OidcProviderName | 'kakao'

export interface OidcProviderResult {
  kind: 'oidc'
  provider: OidcProviderName
  idToken: string
  accessToken?: string
  nonce?: string
  /** Apple 전용: refresh_token 교환(apple-token-exchange)용 authorization code (ADR-077) */
  authorizationCode?: string
}

export interface KakaoProviderResult {
  kind: 'kakao'
  accessToken: string
}

export type AuthProviderResult = OidcProviderResult | KakaoProviderResult

/**
 * 사용자가 로그인 창을 스스로 닫은 경우. 에러가 아니므로 화면은 아무 표시 없이 원래 상태로 돌아가야 한다.
 * 각 SDK의 취소 신호(Google: {type:'cancelled'} 응답, Apple: ERR_REQUEST_CANCELED, Kakao: 메시지)를 이 한 가지로 정규화.
 */
export class UserCancelledError extends Error {
  constructor() {
    super('USER_CANCELLED')
    this.name = 'UserCancelledError'
  }
}

export function isUserCancelled(err: unknown): boolean {
  return (
    err instanceof UserCancelledError || (err instanceof Error && err.message === 'USER_CANCELLED')
  )
}

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
