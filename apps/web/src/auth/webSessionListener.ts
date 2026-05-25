import { supabase } from '@/lib/supabase'
import { queryClient } from '@/lib/queryClient'
import type { BridgeMessage, NativeToWebMessage } from '@shared/types/bridge'

let attached = false

export function setupWebSessionListener() {
  if (attached) return
  attached = true

  try {
    const key = Object.keys(localStorage).find(
      (k) => k.startsWith('sb-') && k.endsWith('-auth-token'),
    )
    if (key) localStorage.removeItem(key)
  } catch {
    /* best-effort */
  }

  window.addEventListener('message', async (event) => {
    let wrapped: BridgeMessage<NativeToWebMessage>
    try {
      wrapped = typeof event.data === 'string' ? JSON.parse(event.data) : event.data
    } catch {
      return
    }
    if (!wrapped || wrapped.version !== 1 || !wrapped.data?.type) return

    const message = wrapped.data
    if (message.type === 'AUTH_SESSION') {
      const { error } = await supabase.auth.setSession({
        access_token: message.payload.access_token,
        refresh_token: message.payload.refresh_token,
      })
      if (error) console.error('[webSessionListener] setSession', error)
    } else if (message.type === 'AUTH_LOGOUT') {
      await supabase.auth.signOut({ scope: 'local' })
      queryClient.clear()
      window.location.replace('/')
    }
  })
}
