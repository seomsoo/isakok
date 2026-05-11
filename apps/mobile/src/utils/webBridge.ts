import type WebView from 'react-native-webview'
import type { NativeToWebMessage, BridgeMessage } from '@moving/shared/types/bridge'

export function sendToWeb(
  webViewRef: React.RefObject<WebView | null>,
  message: NativeToWebMessage,
): void {
  const wrapped: BridgeMessage<NativeToWebMessage> = {
    version: 1,
    timestamp: Date.now(),
    data: message,
  }

  const serialized = JSON.stringify(wrapped)

  webViewRef.current?.injectJavaScript(`
    (function() {
      window.dispatchEvent(
        new MessageEvent('message', { data: ${JSON.stringify(serialized)} })
      );
    })();
    true;
  `)
}
