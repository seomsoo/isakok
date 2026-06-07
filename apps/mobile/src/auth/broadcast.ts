import type { WebView } from 'react-native-webview'
import type { BridgeMessage, NativeToWebMessage } from '@moving/shared/types/bridge'
import type { Session } from '@supabase/supabase-js'

const activeWebViews = new Set<WebView>()

// 푸시 NAVIGATE 딥링크는 활성(포커스) 탭의 WebView 1개에만 전달해야 한다. 전체 broadcast 시 비활성 탭
// WebView까지 라우트가 바뀌어, 이후 그 탭 선택 시 잘못된 화면이 뜬다(P2).
let focusedWebView: WebView | null = null

export function setFocusedWebView(wv: WebView): void {
  focusedWebView = wv
}

export function clearFocusedWebView(wv: WebView): void {
  if (focusedWebView === wv) focusedWebView = null
}

/** 포커스된 WebView 1개에만 메시지 전달. 활성 WebView가 없으면 false(호출부가 보류 유지). */
export function sendToFocusedWebView(message: NativeToWebMessage): boolean {
  if (!focusedWebView) return false
  try {
    focusedWebView.injectJavaScript(buildScript(wrapMessage(message)))
    return true
  } catch {
    return false
  }
}

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
