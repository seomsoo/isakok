import * as SecureStore from 'expo-secure-store'
import type { Session } from '@supabase/supabase-js'

const KEY = 'isakok.session.v1'

interface StoredSession {
  access_token: string
  refresh_token: string
}

export async function load(): Promise<StoredSession | null> {
  const raw = await SecureStore.getItemAsync(KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw)
  } catch {
    await SecureStore.deleteItemAsync(KEY)
    return null
  }
}

export async function save(session: Session) {
  await SecureStore.setItemAsync(
    KEY,
    JSON.stringify({
      access_token: session.access_token,
      refresh_token: session.refresh_token,
    }),
  )
}

export async function clear() {
  await SecureStore.deleteItemAsync(KEY)
}
