import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import type { AuthProvider, OidcProviderResult } from './types'

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID()
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw)
  return { raw, hashed }
}

export const AppleProvider: AuthProvider = {
  name: 'apple',

  isAvailable: async () => {
    if (Platform.OS !== 'ios') return false
    return AppleAuthentication.isAvailableAsync()
  },

  signIn: async (): Promise<OidcProviderResult> => {
    const { raw, hashed } = await generateNonce()
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      ],
      nonce: hashed,
    })
    if (!credential.identityToken) {
      throw new Error('[AppleProvider] identityToken missing')
    }
    return {
      kind: 'oidc',
      provider: 'apple',
      idToken: credential.identityToken,
      nonce: raw,
    }
  },

  signOut: async () => {
    // Apple has no explicit sign-out API
  },
}
