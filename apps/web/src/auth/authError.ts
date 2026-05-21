import { sendToNative, isNativeWebView } from '@moving/shared'

let refreshing = false
let lastRequestedAt = 0

export function handleAuthError(error: unknown) {
  if (!error || typeof error !== 'object') return
  const err = error as Record<string, unknown>
  const isUnauthorized = err.status === 401 || err.code === 'PGRST301' || err.code === '401'
  if (!isUnauthorized) return
  if (!isNativeWebView()) return

  const now = Date.now()
  if (refreshing && now - lastRequestedAt < 5000) return
  refreshing = true
  lastRequestedAt = now
  sendToNative({ type: 'REQUEST_SESSION_REFRESH' })
  setTimeout(() => {
    refreshing = false
  }, 5000)
}
