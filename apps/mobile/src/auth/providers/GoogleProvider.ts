import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'
import { UserCancelledError } from './types'
import type { AuthProvider, OidcProviderResult } from './types'

GoogleSignin.configure({
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  scopes: ['email', 'profile'],
})

export const GoogleProvider: AuthProvider = {
  name: 'google',

  isAvailable: async () => {
    if (Platform.OS === 'ios') return true
    try {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: false })
      return true
    } catch {
      return false
    }
  },

  signIn: async (): Promise<OidcProviderResult> => {
    try {
      if (Platform.OS === 'android') {
        await GoogleSignin.hasPlayServices()
      }
      const response = await GoogleSignin.signIn()
      // v13+: 취소는 reject가 아니라 {type:'cancelled'} 응답으로 온다 — 이걸 놓치면 "idToken missing" 에러로 표시된다.
      if (response.type === 'cancelled') throw new UserCancelledError()
      const idToken = response.data.idToken
      if (!idToken) throw new Error('[GoogleProvider] idToken missing')
      return { kind: 'oidc', provider: 'google', idToken }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        throw new UserCancelledError()
      }
      throw err
    }
  },

  signOut: async () => {
    await GoogleSignin.signOut()
  },

  revoke: async () => {
    await GoogleSignin.revokeAccess()
  },
}
