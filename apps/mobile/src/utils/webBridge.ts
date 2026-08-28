import type WebView from 'react-native-webview'
import type { NativeToWebMessage, BridgeMessage } from '@moving/shared/types/bridge'

// 네이티브→웹 전송 봉투의 단일 출처. broadcast.ts(전체·포커스 전송)와 sendToWeb(단일 WebView)이 같은 래핑·주입
// 스크립트를 쓴다 — 예전엔 둘이 따로 있어 try/catch 유무가 어긋나 있었다.

export function wrapMessage(message: NativeToWebMessage): string {
  const wrapped: BridgeMessage<NativeToWebMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }
  return JSON.stringify(wrapped)
}

/** 웹 window에 message 이벤트로 전달하는 주입 스크립트. 웹 리스너가 없어도 예외 없이 끝난다. */
export function buildScript(json: string): string {
  return `
    (function() {
      try {
        window.dispatchEvent(new MessageEvent('message', { data: ${JSON.stringify(json)} }));
      } catch (e) {}
    })();
    true;
  `
}

export function sendToWeb(
  webViewRef: React.RefObject<WebView | null>,
  message: NativeToWebMessage,
): void {
  webViewRef.current?.injectJavaScript(buildScript(wrapMessage(message)))
}
