import { test as setup } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { SUPABASE_STORAGE_KEY } from '@moving/shared'

const STORAGE = 'e2e/.auth/anon.json'

// 네이티브 Expo가 세션을 주입하는 구조라(브라우저에서 그냥 열면 "session missing"), E2E는 그 주입을
// signInAnonymously()로 대체한다. 검증 대상 = 웹앱 핵심 여정(WebView 브릿지 자체가 아님, 스펙 §3-4).
setup('seed anonymous session', async ({ page }) => {
  const url = process.env.VITE_SUPABASE_URL
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 미설정 — .env.test 확인')
  }

  // 1. 로컬 Supabase에 익명 세션 발급 (ADR-042 재사용)
  const supabase = createClient(url, anonKey)
  const { data, error } = await supabase.auth.signInAnonymously()
  if (error) throw error
  if (!data.session) throw new Error('익명 세션 발급 실패(session null)')

  // 2. 앱이 읽는 localStorage 키로 세션 주입. storageKey·session 모두 Node에서 계산해 "값으로" 전달
  //    (page.evaluate 본문은 브라우저 컨텍스트라 import.meta.env·외부 변수 접근 불가)
  await page.goto('/')
  await page.evaluate(
    ({ key, session }) => {
      window.localStorage.setItem(key, JSON.stringify(session))
    },
    { key: SUPABASE_STORAGE_KEY, session: data.session },
  )

  // 3. storageState 저장 → 이후 모든 spec이 재사용(로그인 반복 0)
  await page.context().storageState({ path: STORAGE })
})
