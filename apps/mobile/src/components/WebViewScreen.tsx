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
import { COLORS, SPLASH_TIMEOUT_MS, WEB_APP_URL } from '../constants/config'
import { useNetworkStatus } from '../hooks/useNetworkStatus'
import { useWebViewRef } from '../hooks/useWebViewRef'
import { hideSplashOnce } from '../utils/splash'
import { isAllowedWebUrl } from '../utils/urlAllowlist'
import { AuthService } from '../auth/AuthService'
import {
  registerWebView,
  sendSessionToWebView,
  broadcastToWebViews,
  setFocusedWebView,
  clearFocusedWebView,
  markWebViewReady,
  markWebViewLoading,
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

// 브라우저 방식으로 남은 세션 정리는 웹(setupWebSessionListener)이 자기 storageKey로 한다 — 여기서 키를 추측하지 않는다.
const INJECTED_BEFORE_LOAD = `
  window.__IS_NATIVE_WEBVIEW__ = true;
  (function() {
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

const TAB_ROUTES = {
  home: ROUTES.LANDING,
  timeline: ROUTES.TIMELINE,
  photos: ROUTES.PHOTOS,
} as const

// 웹은 네이티브보다 새 버전일 수 있다(웹은 수시 배포, 네이티브는 심사). 타입에 없는 탭 값이 와도
// router.navigate(undefined)로 크래시하지 않도록 런타임에 확인한다.
function isKnownTab(tab: unknown): tab is keyof typeof TAB_ROUTES {
  return typeof tab === 'string' && Object.prototype.hasOwnProperty.call(TAB_ROUTES, tab)
}

// 외부 앱으로 넘겨도 되는 스킴만. javascript:·data:·intent: 등은 WebView 밖으로 내보내지 않는다.
const EXTERNAL_SCHEMES = new Set(['http:', 'https:', 'mailto:', 'tel:', 'sms:'])

function openExternally(url: string): void {
  const scheme = /^([a-zA-Z][a-zA-Z0-9+.-]*:)/.exec(url)?.[1]?.toLowerCase()
  if (!scheme || !EXTERNAL_SCHEMES.has(scheme)) {
    if (__DEV__) console.warn('[WebViewScreen] external url blocked (scheme):', url)
    return
  }
  // 처리할 앱이 없거나(예: 시뮬레이터의 tel:) 거부되면 reject된다 — 조용히 무시(미처리 시 앱 크래시).
  Linking.openURL(url).catch((err) => {
    if (__DEV__) console.warn('[WebViewScreen] openURL failed:', url, err)
  })
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
  // 오프라인·에러 폴백이 뜨면 WebView가 언마운트됐다가 새 인스턴스로 다시 마운트된다.
  // 레지스트리(broadcast)·포커스 추적이 새 인스턴스를 따라가도록 이 값을 effect 키로 쓴다.
  const isWebViewMounted = isConnected && !hasError

  // 탭바 표시는 NativeTabs 전역 상태라, 백그라운드 탭 WebView의 ROUTE_CHANGE/SET_TAB_BAR(로그아웃 리로드 등)가
  // 활성 탭의 상태를 덮어쓰면 안 된다. 각 화면은 자기 마지막 상태만 기억했다가 포커스를 얻을 때 적용한다.
  const isFocusedRef = useRef(isFocused)
  const tabBarHiddenRef = useRef(false)
  useEffect(() => {
    isFocusedRef.current = isFocused
    if (isFocused) setIsTabBarHidden(tabBarHiddenRef.current)
  }, [isFocused, setIsTabBarHidden])
  const applyTabBarHidden = useCallback(
    (hidden: boolean) => {
      tabBarHiddenRef.current = hidden
      if (isFocusedRef.current) setIsTabBarHidden(hidden)
    },
    [setIsTabBarHidden],
  )

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

  useEffect(() => {
    if (!isConnected) {
      setWasOffline(true)
      // 오프라인 동안 WebView는 언마운트되므로 진행 중이던 스톨·재시도 타이머는 의미가 없다 — 정리.
      clearLoadTimer()
      if (backoffTimerRef.current) {
        clearTimeout(backoffTimerRef.current)
        backoffTimerRef.current = null
      }
    } else if (wasOffline) {
      setWasOffline(false)
      AccessibilityInfo.announceForAccessibility(
        '인터넷이 연결되었습니다. 페이지를 다시 불러옵니다.',
      )
      // 오프라인 전에 재시도가 소진돼 hasError였다면 여기서 리셋해야 WebView가 다시 마운트되어 새로 로드된다.
      // (리셋 없이는 ErrorFallback에 고착 — "다시 불러옵니다" 공지와 어긋남.) reload()는 불필요: 언마운트됐던
      // WebView가 새 인스턴스로 마운트되며 스스로 로드한다.
      retryCountRef.current = 0
      loadFailedRef.current = false
      setHasError(false)
      setIsLoading(true)
    }
  }, [isConnected, wasOffline, clearLoadTimer])

  // 스플래시는 WEB_READY에서 내리는 게 정상 경로. 하지만 오프라인·에러 폴백이 떴거나 SPLASH_TIMEOUT_MS가 지나면
  // 강제로 내린다 — 안 그러면 폴백 화면이 스플래시 뒤에 가려져 "앱이 멈춘 것"처럼 보인다(오프라인 콜드스타트).
  useEffect(() => {
    if (!isConnected || hasError) {
      void hideSplashOnce()
      return
    }
    const timer = setTimeout(() => {
      void hideSplashOnce()
    }, SPLASH_TIMEOUT_MS)
    return () => clearTimeout(timer)
  }, [isConnected, hasError])

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

  // webViewRef 객체 자체는 불변이라 deps로는 재마운트를 감지 못 한다 — isWebViewMounted가 바뀔 때
  // 옛 인스턴스를 빼고 새 인스턴스를 등록한다(안 그러면 재마운트된 WebView가 broadcast에서 빠짐).
  useEffect(() => {
    const wv = webViewRef.current
    if (!wv) return
    const unregister = registerWebView(wv)
    return unregister
  }, [webViewRef, isWebViewMounted])

  // 활성(포커스) 탭의 WebView 추적 — 푸시 NAVIGATE 딥링크를 이 WebView에만 전달(비활성 탭 오염 방지).
  useEffect(() => {
    const wv = webViewRef.current
    if (isFocused && wv) {
      setFocusedWebView(wv)
      // 포커스를 얻으면 보류된 푸시 라우트를 다시 flush — 콜드스타트에서 비활성 탭이 먼저 준비돼 보류가 남은 경우.
      flushPendingRoute()
    }
    return () => {
      if (wv) clearFocusedWebView(wv)
    }
  }, [isFocused, webViewRef, isWebViewMounted])

  // WEB_READY 응답: 만료 임박이면 먼저 갱신한 세션을 이 WebView에 전달. 만료된 토큰을 건네면 웹 supabase-js가
  // setSession에서 스스로 refresh해 토큰이 회전되고 네이티브 정본이 낡는다(ADR-110).
  // 세션이 없으면(콜드스타트 복원이 일시 오류로 보류된 경우) 복원을 재시도 — 성공 시 broadcast로 도달한다.
  const deliverSessionToWeb = useCallback(async () => {
    const session = await AuthService.getFreshSession()
    if (session) {
      if (webViewRef.current) sendSessionToWebView(webViewRef.current, session)
      return
    }
    await AuthService.ensureAnonymousSession()
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
          clearLoadTimer()
          retryCountRef.current = 0
          loadFailedRef.current = false
          setIsLoading(false)
          setHasError(false)
          hideSplashOnce()
          deliverSessionToWeb().catch((err) => console.error('[WEB_READY:session]', err))
          // 웹 리스너가 준비된 시점 — 이제부터 이 WebView로의 단건 전송(푸시 라우트)이 유효하다.
          if (webViewRef.current) markWebViewReady(webViewRef.current)
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
        case 'SESSION_ROTATED':
          // 웹이 스스로 refresh해 회전된 토큰 — 네이티브 정본에 반영(ADR-110). 웹이 출처라 재broadcast 없음.
          AuthService.adoptRotatedSession(message.payload).catch((err) =>
            console.error('[SESSION_ROTATED]', err),
          )
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
          const tab: unknown = message.payload?.tab
          if (!isKnownTab(tab)) {
            if (__DEV__) console.warn('[WebViewScreen] NAVIGATE_TAB unknown tab ignored:', tab)
            return
          }
          router.navigate(TAB_ROUTES[tab])
          return
        }
        case 'ROUTE_CHANGE': {
          const isTabRoot = (TAB_ROOT_PATHS as readonly string[]).includes(message.payload.path)
          applyTabBarHidden(!isTabRoot)
          return
        }
        case 'SET_TAB_BAR':
          applyTabBarHidden(!message.payload.visible)
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
    [onMessage, webViewRef, applyTabBarHidden, clearLoadTimer, deliverSessionToWeb],
  )

  const handleNavigationStateChange = useCallback((navState: WebViewNavigation) => {
    setCanGoBack(navState.canGoBack)
  }, [])

  const handleShouldStartLoad = useCallback((request: { url: string; isTopFrame?: boolean }) => {
    if (isAllowedWebUrl(request.url)) return true
    // 서브프레임(iframe 등)의 외부 이동은 외부 앱을 띄우지 않고 조용히 차단 — 최상위 이동만 외부로 넘긴다.
    if (request.isTopFrame === false) return false
    openExternally(request.url)
    return false
  }, [])

  // target=_blank·window.open — 기본 동작은 아무 일도 안 일어난다(새 창을 만들 수 없음). 우리 오리진이면 이 WebView에서
  // 열고, 외부면 외부 앱으로 넘긴다.
  const handleOpenWindow = useCallback(
    ({ nativeEvent }: { nativeEvent: { targetUrl: string } }) => {
      const url = nativeEvent.targetUrl
      if (isAllowedWebUrl(url)) {
        webViewRef.current?.injectJavaScript(`window.location.href = ${JSON.stringify(url)}; true;`)
        return
      }
      openExternally(url)
    },
    [webViewRef],
  )

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
          // 새 문서 로드 시작 — 이전 문서의 웹 리스너는 사라졌으니 WEB_READY까지 단건 전송 대상에서 제외.
          if (webViewRef.current) markWebViewLoading(webViewRef.current)
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
        onOpenWindow={handleOpenWindow}
        onNavigationStateChange={handleNavigationStateChange}
        onContentProcessDidTerminate={() => reload()}
        // Android: 렌더 프로세스가 죽으면(OOM·크래시) WebView가 빈 화면으로 남는다 — iOS와 동일하게 재로드.
        onRenderProcessGone={() => reload()}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.neutral,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFill,
    zIndex: 1,
  },
})
