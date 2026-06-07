import { useState, useEffect, useCallback, useContext, useRef } from 'react'
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
import { useIsFocused } from '@react-navigation/native'
import * as Haptics from 'expo-haptics'
import { COLORS, WEB_APP_URL } from '../constants/config'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useWebViewRef } from '../hooks/useWebViewRef'
import { hideSplashOnce } from '../utils/splash'
import { isAllowedWebUrl } from '../utils/urlAllowlist'
import { AuthService } from '../auth/AuthService'
import { getCurrentSession } from '../auth/sessionState'
import {
  registerWebView,
  sendSessionToWebView,
  broadcastToWebViews,
  setFocusedWebView,
  clearFocusedWebView,
} from '../auth/broadcast'
import { pickAndUploadMedia } from '../media/mediaUpload'
import { registerPush } from '../push/registerPush'
import { getPushStatus } from '../push/pushStatus'
import { flushPendingRoute } from '../push/notificationHandler'
import { ROUTES, TAB_ROOT_PATHS } from '@moving/shared'
import type { BridgeMessage, WebToNativeMessage } from '@moving/shared'
import { sendToWeb } from '../utils/webBridge'
import { TabBarContext } from '../app/(tabs)/_layout'
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

const WEBVIEW_LOAD_TIMEOUT_MS = 30000
const MAX_AUTO_RETRIES = 2
const RETRY_BACKOFF_MS = 800

// scheme://host[:port] 까지만 추출해 오리진을 비교한다. RN의 불완전한 URL 폴리필에 의존하지 않도록
// 정규식으로 처리(startsWith 의 host-prefix 충돌·정규화 차이 회피).
function extractOrigin(url: string | undefined | null): string {
  const match = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\/[^/?#]*/.exec(url ?? '')
  return match ? match[0] : ''
}

function isSameOrigin(url: string | undefined | null, base: string): boolean {
  const origin = extractOrigin(url)
  return origin !== '' && origin === extractOrigin(base)
}

const PATH_LABELS: Record<string, string> = {
  [ROUTES.LANDING]: '홈',
  [ROUTES.ONBOARDING]: '이사 정보 입력',
  [ROUTES.DASHBOARD]: '대시보드',
  [ROUTES.TIMELINE]: '전체 일정',
  [ROUTES.PHOTOS]: '집기록',
  [ROUTES.SETTINGS]: '설정',
  [ROUTES.PRIVACY]: '개인정보처리방침',
  [ROUTES.TERMS]: '이용약관',
}

function getPathLabel(path: string): string {
  const exact = PATH_LABELS[path]
  if (exact) return exact
  if (path.startsWith('/checklist/')) return '체크리스트 상세'
  if (path.startsWith('/photos/')) return '집기록 상세'
  return '웹 콘텐츠'
}
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
  const { setIsTabBarHidden } = useContext(TabBarContext)
  const navigation = useNavigation()
  const isFocused = useIsFocused()

  useEffect(() => {
    const unsubscribe = (
      navigation as unknown as { addListener: (event: string, cb: () => void) => () => void }
    ).addListener('tabPress', () => {
      if (isFocused && webViewRef.current) {
        sendToWeb(webViewRef, {
          type: 'NAVIGATE_TO',
          payload: { path, replace: true },
        })
      }
    })
    return unsubscribe
  }, [navigation, isFocused, path, webViewRef])

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

  const retryCountRef = useRef(0)
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // 직전 로드가 실패했는지 표시. react-native-webview 는 onError 직후에도 onLoadEnd 를 호출하므로
  // 이 플래그로 onLoadEnd 가 실패를 "성공"으로 덮어쓰는 것(재시도 카운트·에러 화면 소실)을 막는다.
  const loadFailedRef = useRef(false)

  const clearLoadTimer = useCallback(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current)
      loadTimerRef.current = null
    }
  }, [])

  // 콜드 로드 실패(네트워크 오류·스톨 타임아웃·문서 HTTP 오류) 시 곧장 에러 화면을 띄우지 않고
  // 로딩을 유지한 채 조용히 최대 MAX_AUTO_RETRIES회 재시도한다. 소진 후에만 ErrorFallback 노출.
  // source 는 진단용 — 어느 경로(onError/httpError/stall)에서 실패했는지 dev 로그로 남긴다.
  const handleLoadFailure = useCallback(
    (source: string, detail?: string) => {
      clearLoadTimer()
      loadFailedRef.current = true
      if (retryCountRef.current < MAX_AUTO_RETRIES) {
        retryCountRef.current += 1
        if (__DEV__) {
          console.warn(
            `[WebViewScreen] load failure (${source}) → 재시도 ${retryCountRef.current}/${MAX_AUTO_RETRIES}`,
            detail ?? '',
          )
        }
        setHasError(false)
        setIsLoading(true)
        if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = setTimeout(() => reload(), RETRY_BACKOFF_MS)
      } else {
        if (__DEV__) {
          console.warn(
            `[WebViewScreen] load failure (${source}) → 재시도 소진, 에러 화면 표시`,
            detail ?? '',
          )
        }
        setIsLoading(false)
        setHasError(true)
      }
    },
    [clearLoadTimer, reload],
  )

  // 로드가 멈추면(스톨) 실패로 간주하는 타이머. 진행(onLoadProgress)이 있을 때마다 다시 무장해
  // "느리지만 진행 중"인 로드를 죽이지 않는다.
  const armLoadTimer = useCallback(() => {
    clearLoadTimer()
    loadTimerRef.current = setTimeout(
      () => handleLoadFailure('stall-timeout'),
      WEBVIEW_LOAD_TIMEOUT_MS,
    )
  }, [clearLoadTimer, handleLoadFailure])

  useEffect(() => {
    return () => {
      clearLoadTimer()
      if (backoffTimerRef.current) clearTimeout(backoffTimerRef.current)
    }
  }, [clearLoadTimer])

  // 로드 완료를 한 번 announce — path 가 바뀌면 isLoading 이 true 로 돌아 자연스럽게 재공지.
  const announcedRef = useRef(false)
  useEffect(() => {
    if (isLoading) {
      announcedRef.current = false
      return
    }
    if (hasError || announcedRef.current) return
    AccessibilityInfo.announceForAccessibility(`${getPathLabel(path)} 페이지가 준비되었어요`)
    announcedRef.current = true
  }, [isLoading, hasError, path])

  useEffect(() => {
    const wv = webViewRef.current
    if (!wv) return
    const unregister = registerWebView(wv)
    return unregister
  }, [webViewRef])

  // 활성(포커스) 탭의 WebView 추적 — 푸시 NAVIGATE 딥링크를 이 WebView에만 전달(비활성 탭 오염 방지).
  useEffect(() => {
    const wv = webViewRef.current
    if (isFocused && wv) setFocusedWebView(wv)
    return () => {
      if (wv) clearFocusedWebView(wv)
    }
  }, [isFocused, webViewRef])

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
          clearLoadTimer()
          retryCountRef.current = 0
          loadFailedRef.current = false
          setIsLoading(false)
          setHasError(false)
          hideSplashOnce()
          const session = getCurrentSession()
          if (session && webViewRef.current) {
            sendSessionToWebView(webViewRef.current, session)
          }
          flushPendingRoute() // 콜드스타트로 보류된 푸시 라우트가 있으면 지금 전달
          return
        }
        case 'REQUEST_LOGIN':
          router.push('/auth')
          return
        case 'REQUEST_LOGOUT':
          AuthService.signOut().catch((err) => console.error('[signOut]', err))
          return
        case 'REQUEST_DELETE_ACCOUNT':
          AuthService.deleteAccount().catch((err) =>
            console.error('[deleteAccount]', err instanceof Error ? err.message : err),
          )
          return
        case 'REQUEST_SESSION_REFRESH':
          AuthService.refreshSession().catch((err) => console.error('[refresh]', err))
          return
        case 'REQUEST_PUSH_PERMISSION': {
          // soft-ask "받기" / 설정 토글 ON → 네이티브 hard-ask + 토큰 등록 → 상태 회신.
          registerPush()
            .then((payload) => broadcastToWebViews({ type: 'PUSH_STATUS', payload }))
            .catch((err) => console.error('[REQUEST_PUSH_PERMISSION]', err))
          return
        }
        case 'REQUEST_PUSH_STATUS': {
          getPushStatus()
            .then((payload) => broadcastToWebViews({ type: 'PUSH_STATUS', payload }))
            .catch((err) => console.error('[REQUEST_PUSH_STATUS]', err))
          return
        }
        case 'OPEN_APP_SETTINGS':
          Linking.openSettings().catch((err) => console.error('[OPEN_APP_SETTINGS]', err))
          return
        case 'OPEN_EXTERNAL_LINK':
          Linking.openURL(message.payload.url).catch(() => undefined)
          return
        case 'OPEN_MEDIA_PICKER': {
          // 네이티브 미디어 피커 → Storage 직접 업로드 후 메타데이터 회신 (ADR-079).
          // 취소·실패도 빈 결과로 반드시 회신 — 웹이 업로드 가드(in-flight)를 항상 해제하도록(무신호 방지).
          const picker = message.payload
          const replyUploaded = (
            items: { storage_path: string; taken_at: string | null; hash: string }[],
            failed: number,
          ) => {
            if (!webViewRef.current) return
            sendToWeb(webViewRef, {
              type: 'MEDIA_UPLOADED',
              payload: {
                moveId: picker.moveId,
                room: picker.room,
                photoType: picker.photoType,
                items,
                failed,
              },
            })
          }
          pickAndUploadMedia(picker)
            .then((result) => {
              if (result.canceled) replyUploaded([], 0)
              else replyUploaded(result.items, result.failed)
            })
            .catch((err) => {
              console.error('[OPEN_MEDIA_PICKER]', err instanceof Error ? err.message : err)
              replyUploaded([], 0)
            })
          return
        }
        case 'NAVIGATE_TAB': {
          const tabMap = {
            home: ROUTES.LANDING,
            timeline: ROUTES.TIMELINE,
            photos: ROUTES.PHOTOS,
          } as const
          router.navigate(tabMap[message.payload.tab])
          return
        }
        case 'ROUTE_CHANGE': {
          const isTabRoot = (TAB_ROOT_PATHS as readonly string[]).includes(message.payload.path)
          setIsTabBarHidden(!isTabRoot)
          return
        }
        case 'SET_TAB_BAR':
          setIsTabBarHidden(!message.payload.visible)
          return
        case 'SET_SAFE_AREA_STYLE':
          setTopSafeAreaStyle(message.payload.top)
          return
        case 'REQUEST_HAPTIC': {
          const map = {
            light: Haptics.ImpactFeedbackStyle.Light,
            medium: Haptics.ImpactFeedbackStyle.Medium,
            heavy: Haptics.ImpactFeedbackStyle.Heavy,
            success: Haptics.NotificationFeedbackType.Success,
            error: Haptics.NotificationFeedbackType.Error,
          } as const
          const style = map[message.payload.style]
          if (
            style === Haptics.NotificationFeedbackType.Success ||
            style === Haptics.NotificationFeedbackType.Error
          ) {
            Haptics.notificationAsync(style)
          } else {
            Haptics.impactAsync(style)
          }
          return
        }
      }

      if (onMessage) {
        onMessage(wrapped)
      }
    },
    [onMessage, webViewRef, setIsTabBarHidden, clearLoadTimer],
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
          retryCountRef.current = 0
          loadFailedRef.current = false
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
        accessibilityLabel={`${getPathLabel(path)} 웹 콘텐츠`}
        accessibilityElementsHidden={isLoading}
        importantForAccessibility={isLoading ? 'no-hide-descendants' : 'auto'}
        javaScriptEnabled
        domStorageEnabled
        bounces
        allowsBackForwardNavigationGestures
        pullToRefreshEnabled={Platform.OS === 'android'}
        allowFileAccess
        allowFileAccessFromFileURLs={false}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        automaticallyAdjustContentInsets={false}
        contentInsetAdjustmentBehavior="never"
        injectedJavaScriptBeforeContentLoaded={INJECTED_BEFORE_LOAD}
        onMessage={handleMessage}
        onLoadStart={() => {
          loadFailedRef.current = false
          setHasError(false)
          setIsLoading(true)
          armLoadTimer()
        }}
        onLoadProgress={({ nativeEvent }) => {
          // 진행이 있으면 스톨 타이머를 다시 무장(느린 로드를 살림).
          // 성공 확정(타이머 해제·재시도 리셋)은 WEB_READY / 정상 onLoadEnd 에서만 한다.
          armLoadTimer()
          // 거의 다 받았으면 스피너만 숨김(UX). 0.95 를 성공 판정으로 쓰지 않는다 —
          // 95% 이후 WEB_READY·onLoadEnd 가 안 오는 스톨도 잡아야 하므로 타이머는 계속 둔다.
          if (nativeEvent.progress >= 0.95) {
            setIsLoading(false)
          }
        }}
        onLoadEnd={() => {
          // react-native-webview 는 실패(onError) 직후에도 onLoadEnd 를 호출한다.
          // 직전 로드가 실패였다면 성공 처리하지 않고 재시도/에러 로직을 그대로 둔다.
          if (loadFailedRef.current) return
          clearLoadTimer()
          retryCountRef.current = 0
          setIsLoading(false)
          setHasError(false)
        }}
        onError={(event) => {
          // react-native-webview 의 기본 에러 화면(예: NSURLErrorDomain "Error loading page")
          // 렌더를 막아, 우리 흐름(스피너 → 자동 재시도 → ErrorFallback)만 보이게 한다.
          event.preventDefault()
          handleLoadFailure('onError', event.nativeEvent?.description)
        }}
        onHttpError={({ nativeEvent }) => {
          // onHttpError 는 메인 프레임(문서) 응답에만 발생한다(서브리소스는 별도 경로).
          // 우리 웹앱 오리진 문서의 4xx·5xx 만 실패로 보고 재시도 경로로 보낸다.
          if (nativeEvent.statusCode >= 400 && isSameOrigin(nativeEvent.url, WEB_APP_URL)) {
            handleLoadFailure('httpError', String(nativeEvent.statusCode))
          }
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
