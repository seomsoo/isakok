import * as AppleAuthentication from 'expo-apple-authentication'
import * as Crypto from 'expo-crypto'
import { Platform } from 'react-native'
import { UserCancelledError } from './types'
import type { AuthProvider, OidcProviderResult } from './types'

async function generateNonce(): Promise<{ raw: string; hashed: string }> {
  const raw = Crypto.randomUUID()
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, raw)
  return { raw, hashed }
}

// expo-apple-authentication은 사용자가 시트를 닫으면 code 'ERR_REQUEST_CANCELED'로 reject한다.
function isAppleCancel(err: unknown): boolean {
  return (err as { code?: string } | null)?.code === 'ERR_REQUEST_CANCELED'
}

export const AppleProvider: AuthProvider = {
  name: 'apple',

  isAvailable: async () => {
    if (Platform.OS !== 'ios') return false
    return AppleAuthentication.isAvailableAsync()
  },

  signIn: async (): Promise<OidcProviderResult> => {
    const { raw, hashed } = await generateNonce()
    let credential: AppleAuthentication.AppleAuthenticationCredential
    try {
      credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
        nonce: hashed,
      })
    } catch (err) {
      if (isAppleCancel(err)) throw new UserCancelledError()
      throw err
    }
    if (!credential.identityToken) {
      throw new Error('[AppleProvider] identityToken missing')
    }
    return {
      kind: 'oidc',
      provider: 'apple',
      idToken: credential.identityToken,
      nonce: raw,
      // refresh_token 교환용 (ADR-077). 단명·1회성이라 로그인 직후 즉시 교환.
      authorizationCode: credential.authorizationCode ?? undefined,
    }
  },

  signOut: async () => {
    // Apple has no explicit sign-out API
  },
}
