import { useRef } from 'react'
import type WebView from 'react-native-webview'

export function useWebViewRef() {
  const webViewRef = useRef<WebView>(null)

  function reload() {
    webViewRef.current?.reload()
  }

  function goBack() {
    webViewRef.current?.goBack()
  }

  return { webViewRef, reload, goBack }
}
