import { createClient } from '@supabase/supabase-js'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  throw new Error(
    '[supabaseNative] EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY missing',
  )
}

const SUPABASE_URL = url
const SUPABASE_ANON_KEY = anonKey

export const supabaseNative = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
})

/**
 * 사용자 access_token으로 인증된 일회성 클라이언트 (Storage 직접 업로드용, ADR-079).
 * supabaseNative(세션 없음)와 분리 — 업로드는 사용자 JWT로 Storage RLS(foldername[1]=auth.uid())를 통과해야 한다.
 */
export function createAuthedClient(accessToken: string) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
