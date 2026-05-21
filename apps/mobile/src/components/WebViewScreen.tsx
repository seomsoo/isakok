import { useState, useEffect, useCallback } from 'react'
import { View, BackHandler, Platform, StyleSheet, Linking, AccessibilityInfo } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview'
import { router } from 'expo-router'
import { WEB_APP_URL } from '../constants/config'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useWebViewRef } from '../hooks/useWebViewRef'
import { hideSplashOnce } from '../utils/splash'
import { isAllowedWebUrl } from '../utils/urlAllowlist'
import { AuthService } from '../auth/AuthService'
import { getCurrentSession } from '../auth/sessionState'
import { registerWebView, sendSessionToWebView } from '../auth/broadcast'
import type { BridgeMessage, WebToNativeMessage } from '@moving/shared/types/bridge'
import { LoadingFallback } from './LoadingFallback'
import { ErrorFallback } from './ErrorFallback'
import { OfflineFallback } from './OfflineFallback'

interface WebViewScreenProps {
  path: string
  onMessage?: (data: unknown) => void
}

const INJECTED_BEFORE_LOAD = `
  window.__IS_NATIVE_WEBVIEW__ = true;
  (function() {
    try {
      var keys = Object.keys(localStorage);
      for (var i = 0; i < keys.length; i++) {
        if (keys[i].indexOf('sb-') === 0 && keys[i].indexOf('-auth-token') > 0) {
          localStorage.removeItem(keys[i]);
        }
      }
    } catch(e) {}
    function addClass() {
      if (document.body) {
        document.body.classList.add('native-webview');
      }
    }
    addClass();
    document.addEventListener('DOMContentLoaded', addClass);
  })();
  true;
`

const WEBVIEW_LOAD_TIMEOUT_MS = 15000

const PATH_LABELS: Record<string, string> = {
  '/': '홈',
  '/timeline': '전체 일정',
  '/photos': '집기록',
}

export function WebViewScreen({ path, onMessage }: WebViewScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const insets = useSafeAreaInsets()
  const isConnected = useNetworkStatus()
  const { webViewRef, reload, goBack } = useWebViewRef()
  const [wasOffline, setWasOffline] = useState(false)

  useEffect(() => {
    if (!isConnected) {
      setWasOffline(true)
    } else if (wasOffline) {
      setWasOffline(false)
      AccessibilityInfo.announceForAccessibility(
        '인터넷이 연결되었습니다. 페이지를 다시 불러옵니다.',
      )
      reload()
    }
  }, [isConnected, wasOffline, reload])

  useEffect(() => {
    if (Platform.OS !== 'android') return

    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (canGoBack) {
        goBack()
        return true
      }
      return false
    })

    return () => handler.remove()
  }, [canGoBack, goBack])

  useEffect(() => {
    if (!isLoading || hasError) return

    const timeout = setTimeout(() => {
      setIsLoading(false)
      setHasError(true)
    }, WEBVIEW_LOAD_TIMEOUT_MS)

    return () => clearTimeout(timeout)
  }, [hasError, isLoading])

  useEffect(() => {
    const wv = webViewRef.current
    if (!wv) return
    const unregister = registerWebView(wv)
    return unregister
  }, [webViewRef])

  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      let wrapped: BridgeMessage<WebToNativeMessage>
      try {
        wrapped = JSON.parse(event.nativeEvent.data)
      } catch {
        return
      }
      if (!wrapped || wrapped.version !== 1 || !wrapped.data?.type) return
      const message = wrapped.data

      switch (message.type) {
        case 'WEB_READY': {
          setIsLoading(false)
          setHasError(false)
          hideSplashOnce()
          const session = getCurrentSession()
          if (session && webViewRef.current) {
            sendSessionToWebView(webViewRef.current, session)
          }
          return
        }
        case 'REQUEST_LOGIN':
          router.push('/auth')
          return
        case 'REQUEST_LOGOUT':
          AuthService.signOut().catch((err) => console.error('[signOut]', err))
          return
        case 'REQUEST_SESSION_REFRESH':
          AuthService.refreshSession().catch((err) => console.error('[refresh]', err))
          return
        case 'OPEN_EXTERNAL_LINK':
          Linking.openURL(message.payload.url).catch(() => undefined)
          return
      }

      if (onMessage) {
        onMessage(wrapped)
      }
    },
    [onMessage, webViewRef],
  )

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack)
  }, [])

  const handleShouldStartLoad = useCallback((request: { url: string }) => {
    if (isAllowedWebUrl(request.url)) return true
    Linking.openURL(request.url)
    return false
  }, [])

  if (!isConnected) {
    return <OfflineFallback />
  }

  if (hasError) {
    return (
      <ErrorFallback
        onRetry={() => {
          setHasError(false)
          reload()
        }}
      />
    )
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {isLoading && (
        <View style={styles.loadingOverlay}>
          <LoadingFallback />
        </View>
      )}
      <WebView
        ref={webViewRef}
        source={{ uri: `${WEB_APP_URL}${path}` }}
        accessibilityLabel={`${PATH_LABELS[path] ?? path} 웹 콘텐츠`}
        accessibilityElementsHidden={isLoading}
        importantForAccessibility={isLoading ? 'no-hide-descendants' : 'auto'}
        javaScriptEnabled
        domStorageEnabled
        bounces={false}
        allowsBackForwardNavigationGestures={false}
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_LOAD}
        onMessage={handleMessage}
        onLoadStart={() => {
          setHasError(false)
          setIsLoading(true)
        }}
        onLoadProgress={({ nativeEvent }) => {
          if (nativeEvent.progress >= 0.95) {
            setIsLoading(false)
            setHasError(false)
          }
        }}
        onLoadEnd={() => {
          setIsLoading(false)
          setHasError(false)
        }}
        onError={() => {
          setIsLoading(false)
          setHasError(true)
        }}
        onHttpError={({ nativeEvent }) => {
          if (nativeEvent.statusCode >= 400) setHasError(true)
        }}
        onShouldStartLoadWithRequest={handleShouldStartLoad}
        onNavigationStateChange={handleNavigationStateChange}
        onContentProcessDidTerminate={() => reload()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
})
