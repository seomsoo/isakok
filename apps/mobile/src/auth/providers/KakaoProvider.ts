import { login as kakaoLogin, logout as kakaoLogout } from '@react-native-seoul/kakao-login'
import type { AuthProvider, KakaoProviderResult } from './types'

export const KakaoProvider: AuthProvider = {
  name: 'kakao',
  isAvailable: async () => true,

  signIn: async (): Promise<KakaoProviderResult> => {
    const result = await kakaoLogin()
    if (!result.accessToken) {
      throw new Error('[KakaoProvider] accessToken missing')
    }
    return { kind: 'kakao', accessToken: result.accessToken }
  },

  signOut: async () => {
    try {
      await kakaoLogout()
    } catch {
      // already logged out
    }
  },
}
