import {
  login as kakaoLogin,
  logout as kakaoLogout,
  unlink as kakaoUnlink,
} from '@react-native-seoul/kakao-login'
import { UserCancelledError } from './types'
import type { AuthProvider, KakaoProviderResult } from './types'

// @react-native-seoul/kakao-login은 모든 실패를 code 'RNKakaoLogins' + SDK 메시지로 reject한다.
// 취소는 Kakao SDK의 ClientFailureReason.Cancelled(iOS "user cancelled"/"canceled by user") /
// ClientErrorCause.Cancelled(Android)로 오며 메시지가 유일한 구분 신호라 메시지로 판별한다.
function isKakaoCancel(err: unknown): boolean {
  return err instanceof Error && /cancel/i.test(err.message)
}

export const KakaoProvider: AuthProvider = {
  name: 'kakao',
  isAvailable: async () => true,

  signIn: async (): Promise<KakaoProviderResult> => {
    try {
      const result = await kakaoLogin()
      if (!result.accessToken) {
        throw new Error('[KakaoProvider] accessToken missing')
      }
      return { kind: 'kakao', accessToken: result.accessToken }
    } catch (err) {
      if (isKakaoCancel(err)) throw new UserCancelledError()
      throw err
    }
  },

  signOut: async () => {
    try {
      await kakaoLogout()
    } catch {
      // already logged out
    }
  },

  revoke: async () => {
    await kakaoUnlink()
  },
}
