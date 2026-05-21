import type { WebView } from 'react-native-webview'
import type { BridgeMessage, NativeToWebMessage } from '@moving/shared/types/bridge'
import type { Session } from '@supabase/supabase-js'

const activeWebViews = new Set<WebView>()

export function registerWebView(wv: WebView | null): () => void {
  if (!wv) return () => undefined
  activeWebViews.add(wv)
  return () => {
    activeWebViews.delete(wv)
  }
}

function wrapMessage(message: NativeToWebMessage): string {
  const wrapped: BridgeMessage<NativeToWebMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }
  return JSON.stringify(wrapped)
}

function buildScript(json: string): string {
  return `
    (function() {
      try {
        window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} }));
      } catch (e) {}
    })();
    true;
  `
}

export function broadcastToWebViews(message: NativeToWebMessage): void {
  const json = wrapMessage(message)
  const script = buildScript(json)
  for (const wv of activeWebViews) {
    try {
      wv.injectJavaScript(script)
    } catch {
      /* best-effort */
    }
  }
}

export function sendSessionToWebView(wv: WebView, session: Session): void {
  const message: NativeToWebMessage = {
    type: 'AUTH_SESSION',
    payload: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: session.user.id,
      is_anonymous: !!session.user.is_anonymous,
    },
  }
  const json = wrapMessage(message)
  wv.injectJavaScript(buildScript(json))
}

export function broadcastSession(session: Session): void {
  broadcastToWebViews({
    type: 'AUTH_SESSION',
    payload: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: session.user.id,
      is_anonymous: !!session.user.is_anonymous,
    },
  })
}
