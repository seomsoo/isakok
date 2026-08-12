import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from '@/App'
import { initSentry } from '@/observability/sentry'
import { initPostHog } from '@/observability/posthog'
import { initWebVitals } from '@/observability/webVitals'
import { getEnv } from '@/observability/env'
import { assertEnvRefPairing } from '@/lib/envFingerprint'
import '@/index.css'

// 관측 초기화는 렌더 전(가장 먼저) — 부팅 단계 에러/이벤트도 잡도록. 키 없으면 각각 no-op.
initSentry()
initPostHog()
// Web Vitals RUM — production 전용, 게이트 아닌 사후 모니터(스펙 13 §7). 비-prod는 no-op.
initWebVitals()

// 환경 × Supabase ref 오배선은 렌더 전에 시끄럽게 실패 — Sentry init 이후라 throw도 수집된다 (스펙 14 §5-6)
assertEnvRefPairing(import.meta.env.VITE_SUPABASE_URL, getEnv())

const rootElement = document.getElementById('root')

if (!rootElement) {
  throw new Error('Root element not found. Check index.html for <div id="root">')
}

createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
