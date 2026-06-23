import { createClient } from '@supabase/supabase-js'
import { SUPABASE_STORAGE_KEY } from '@moving/shared'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL 또는 Anon Key가 설정되지 않았습니다. .env.local 파일을 확인하세요.')
}

const isNative = typeof window !== 'undefined' && window.__IS_NATIVE_WEBVIEW__ === true

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: !isNative,
    autoRefreshToken: !isNative,
    detectSessionInUrl: false,
    // 세션 키를 명시 고정 — E2E 세션 시딩이 동일 키로 주입(단일 출처). 네이티브는
    // persistSession=false라 영향 없고(세션은 브릿지 주입), 브라우저만 이 키로 persist.
    storageKey: SUPABASE_STORAGE_KEY,
  },
})
