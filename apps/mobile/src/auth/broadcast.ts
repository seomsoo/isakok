import type { WebView } from 'react-native-webview'
import type { NativeToWebMessage } from '@moving/shared/types/bridge'
import type { Session } from '@supabase/supabase-js'
import { wrapMessage, buildScript } from '../utils/webBridge'

const activeWebViews = new Set<WebView>()

// 푸시 NAVIGATE 딥링크는 활성(포커스) 탭의 WebView 1개에만 전달해야 한다. 전체 broadcast 시 비활성 탭
// WebView까지 라우트가 바뀌어, 이후 그 탭 선택 시 잘못된 화면이 뜬다(P2).
let focusedWebView: WebView | null = null

// WEB_READY(웹 리스너 준비)를 받은 뒤 다음 로드가 시작되기 전까지만 "준비됨". 로딩 중인 페이지에 주입한 스크립트는
// 조용히 사라지므로, 준비 안 된 WebView로의 단건 전송은 실패로 보고해 호출부가 보류를 유지하게 한다(푸시 라우트 유실 방지).
const readyWebViews = new WeakSet<WebView>()

export function setFocusedWebView(wv: WebView): void {
  focusedWebView = wv
}

export function clearFocusedWebView(wv: WebView): void {
  if (focusedWebView === wv) focusedWebView = null
}

export function markWebViewReady(wv: WebView): void {
  readyWebViews.add(wv)
}

export function markWebViewLoading(wv: WebView): void {
  readyWebViews.delete(wv)
}

/** 포커스된 WebView 1개에만 메시지 전달. 활성·준비된 WebView가 없으면 false(호출부가 보류 유지). */
export function sendToFocusedWebView(message: NativeToWebMessage): boolean {
  if (!focusedWebView || !readyWebViews.has(focusedWebView)) return false
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
    readyWebViews.delete(wv)
  }
}

export function broadcastToWebViews(message: NativeToWebMessage): void {
  const script = buildScript(wrapMessage(message))
  for (const wv of activeWebViews) {
    try {
      wv.injectJavaScript(script)
    } catch {
      /* best-effort */
    }
  }
}

function toSessionMessage(session: Session): NativeToWebMessage {
  return {
    type: 'AUTH_SESSION',
    payload: {
      access_token: session.access_token,
      refresh_token: session.refresh_token,
      expires_at: session.expires_at ?? 0,
      user_id: session.user.id,
      is_anonymous: !!session.user.is_anonymous,
    },
  }
}

export function sendSessionToWebView(wv: WebView, session: Session): void {
  wv.injectJavaScript(buildScript(wrapMessage(toSessionMessage(session))))
}

export function broadcastSession(session: Session): void {
  broadcastToWebViews(toSessionMessage(session))
}
