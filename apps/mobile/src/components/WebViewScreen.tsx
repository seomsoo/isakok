import { useState, useEffect, useCallback } from 'react'
import { View, BackHandler, Platform, StyleSheet, Linking } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview'
import { WEB_APP_URL } from '../constants/config'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useWebViewRef } from '../hooks/useWebViewRef'
import { hideSplashOnce } from '../utils/splash'
import { isAllowedWebUrl } from '../utils/urlAllowlist'
import { LoadingFallback } from './LoadingFallback'
import { ErrorFallback } from './ErrorFallback'
import { OfflineFallback } from './OfflineFallback'

interface WebViewScreenProps {
  path: string
}

const INJECTED_BEFORE_LOAD = `
  window.__IS_NATIVE_WEBVIEW__ = true;
  (function() {
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

export function WebViewScreen({ path }: WebViewScreenProps) {
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

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const parsed = JSON.parse(event.nativeEvent.data)
      if (parsed.version === 1 && parsed.data?.type === 'WEB_READY') {
        setIsLoading(false)
        setHasError(false)
        hideSplashOnce()
      }
      if (parsed.version === 1 && parsed.data?.type === 'OPEN_EXTERNAL_LINK') {
        const url = parsed.data.payload?.url
        if (typeof url === 'string') {
          Linking.openURL(url)
        }
      }
    } catch {
      // non-bridge message
    }
  }, [])

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
