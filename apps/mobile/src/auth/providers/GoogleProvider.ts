import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin'
import { Platform } from 'react-native'
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
      const userInfo = await GoogleSignin.signIn()
      const idToken = userInfo.data?.idToken
      if (!idToken) throw new Error('[GoogleProvider] idToken missing')
      return { kind: 'oidc', provider: 'google', idToken }
    } catch (err: unknown) {
      if (
        err instanceof Error &&
        (err as Error & { code?: string }).code === statusCodes.SIGN_IN_CANCELLED
      ) {
        throw new Error('USER_CANCELLED')
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
