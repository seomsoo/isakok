import { useState, useEffect, useCallback } from 'react'
import {
  View,
  BackHandler,
  Platform,
  StyleSheet,
  Linking,
  AccessibilityInfo,
  StatusBar,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { WebView } from 'react-native-webview'
import type { WebViewMessageEvent, WebViewNavigation } from 'react-native-webview'
import { router, useNavigation } from 'expo-router'
import { COLORS, WEB_APP_URL } from '../constants/config'
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
    function isEditable(target) {
      var el = target;
      while (el && el !== document.body) {
        if (el.isContentEditable) return true;
        var tagName = el.tagName ? el.tagName.toLowerCase() : '';
        if (tagName === 'textarea') return true;
        if (tagName === 'input') {
          var type = (el.getAttribute('type') || 'text').toLowerCase();
          return type !== 'file' && type !== 'checkbox' && type !== 'radio';
        }
        el = el.parentElement;
      }
      return false;
    }
    function suppressSelection(event) {
      if (isEditable(event.target)) return;
      event.preventDefault();
    }
    function addClass() {
      document.documentElement.classList.add('native-webview');
      if (document.body) {
        document.body.classList.add('native-webview');
      }
    }
    addClass();
    document.addEventListener('DOMContentLoaded', addClass);
    document.addEventListener('contextmenu', suppressSelection, true);
    document.addEventListener('selectstart', suppressSelection, true);
    document.addEventListener('dragstart', suppressSelection, true);
  })();
  true;
`

const WEBVIEW_LOAD_TIMEOUT_MS = 15000

const PATH_LABELS: Record<string, string> = {
  '/': '홈',
  '/timeline': '전체 일정',
  '/photos': '집기록',
}

const TAB_BAR_STYLE = {
  backgroundColor: '#FFFFFF',
  borderTopColor: '#F0EFED',
  borderTopWidth: 0.5,
  height: 56,
  paddingBottom: 4,
}
const TAB_BAR_HIDDEN = { display: 'none' as const }
const HIDE_TAB_ROUTES = ['/onboarding', '/pre-check']
const TOP_SAFE_AREA_BACKGROUND = {
  default: COLORS.neutral,
  black: '#000000',
} as const

export function WebViewScreen({ path, onMessage }: WebViewScreenProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [hasError, setHasError] = useState(false)
  const [canGoBack, setCanGoBack] = useState(false)
  const [topSafeAreaStyle, setTopSafeAreaStyle] =
    useState<keyof typeof TOP_SAFE_AREA_BACKGROUND>('default')
  const insets = useSafeAreaInsets()
  const isConnected = useNetworkStatus()
  const { webViewRef, reload, goBack } = useWebViewRef()
  const [wasOffline, setWasOffline] = useState(false)
  const navigation = useNavigation()

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
        case 'NAVIGATE_TAB': {
          const tabMap = { home: '/', timeline: '/timeline', photos: '/photos' } as const
          router.replace(tabMap[message.payload.tab])
          return
        }
        case 'ROUTE_CHANGE': {
          const shouldHide = HIDE_TAB_ROUTES.some((r) => message.payload.path.startsWith(r))
          navigation.setOptions({
            tabBarStyle: shouldHide ? TAB_BAR_HIDDEN : TAB_BAR_STYLE,
          })
          return
        }
        case 'SET_TAB_BAR':
          navigation.setOptions({
            tabBarStyle: message.payload.visible ? TAB_BAR_STYLE : TAB_BAR_HIDDEN,
          })
          return
        case 'SET_SAFE_AREA_STYLE':
          setTopSafeAreaStyle(message.payload.top)
          return
      }

      if (onMessage) {
        onMessage(wrapped)
      }
    },
    [onMessage, webViewRef, navigation],
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
    <View
      style={[
        styles.container,
        {
          backgroundColor: TOP_SAFE_AREA_BACKGROUND[topSafeAreaStyle],
          paddingTop: insets.top,
        },
      ]}
    >
      <StatusBar
        barStyle={topSafeAreaStyle === 'black' ? 'light-content' : 'dark-content'}
        backgroundColor={TOP_SAFE_AREA_BACKGROUND[topSafeAreaStyle]}
      />
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
    backgroundColor: '#F8F7F5',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
})
