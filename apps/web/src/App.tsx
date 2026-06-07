import { useEffect } from 'react'
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
  useLocation,
  useNavigate,
} from 'react-router-dom'
import { Ssgoi, SsgoiTransition } from '@ssgoi/react'
import { drill } from '@ssgoi/react/view-transitions'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ROUTES } from '@shared/constants/routes'
import { isNativeWebView, sendToNative, onNativeMessage, normalizePushRoute } from '@moving/shared'
import { setupWebSessionListener } from '@/auth/webSessionListener'
import { startBridgeAuthTimer } from '@/observability/bridgeMonitor'
import { EntryRedirect } from '@/pages/EntryRedirect'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PreCheckPage } from '@/pages/PreCheckPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ChecklistDetailPage } from '@/pages/ChecklistDetailPage'
import { PhotosPage } from '@/pages/PhotosPage'
import { PhotoRoomPage } from '@/pages/PhotoRoomPage'
import { PhotoReportPage } from '@/pages/PhotoReportPage'
import { PhotoTrashPage } from '@/pages/PhotoTrashPage'
import { PrivacyPage } from '@/pages/PrivacyPage'
import { TermsPage } from '@/pages/TermsPage'
import { OssLicensesPage } from '@/pages/OssLicensesPage'
import { ToastProvider } from '@/shared/components/ToastProvider'

const transitionConfig = {
  transitions: [
    drill({ enter: '/checklist/*', exit: '*' }),
    drill({ enter: '/photos/*', exit: '/photos' }),
    drill({ enter: '/privacy', exit: '/settings' }),
    drill({ enter: '/terms', exit: '/settings' }),
    drill({ enter: '/oss-licenses', exit: '/settings' }),
  ],
}

function TransitionLayout() {
  const { pathname } = useLocation()
  return (
    <div className="h-dvh overflow-y-auto relative z-0 overflow-x-clip">
      <Ssgoi config={transitionConfig}>
        <SsgoiTransition key={pathname} id={pathname}>
          <Outlet />
        </SsgoiTransition>
      </Ssgoi>
    </div>
  )
}

function WebReadySignal() {
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (isNativeWebView()) {
      setupWebSessionListener()
      sendToNative({ type: 'WEB_READY' })
      // WEB_READY 직후 AUTH_SESSION 타임아웃 측정 시작 (진입 경로 기준, 공개 라우트 제외)
      startBridgeAuthTimer(window.location.pathname)
    }
  }, [])

  useEffect(() => {
    if (isNativeWebView()) {
      sendToNative({ type: 'ROUTE_CHANGE', payload: { path: pathname } })
    }
  }, [pathname])

  useEffect(() => {
    if (!isNativeWebView()) return
    return onNativeMessage((message) => {
      if (message.type === 'NAVIGATE_TO') {
        navigate(message.payload.path, {
          replace: message.payload.replace ?? false,
        })
      } else if (message.type === 'NAVIGATE') {
        // 푸시 탭 딥링크. payload.path는 양측 normalizePushRoute(allowlist)로 정규화(외부 URL 차단).
        navigate(normalizePushRoute(message.payload.path))
      }
    })
  }, [navigate])

  return null
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <WebReadySignal />
          <Routes>
            <Route element={<TransitionLayout />}>
              <Route path={ROUTES.LANDING} element={<EntryRedirect />} />
              <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />
              <Route path={ROUTES.PRE_CHECK} element={<PreCheckPage />} />
              <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
              <Route path={ROUTES.TIMELINE} element={<TimelinePage />} />
              <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
              <Route path={ROUTES.CHECKLIST_DETAIL} element={<ChecklistDetailPage />} />
              <Route path={ROUTES.PHOTO_REPORT} element={<PhotoReportPage />} />
              <Route path={ROUTES.PHOTO_TRASH} element={<PhotoTrashPage />} />
              <Route path={ROUTES.PHOTOS} element={<PhotosPage />} />
              <Route path="/photos/:room" element={<PhotoRoomPage />} />
              <Route path={ROUTES.PRIVACY} element={<PrivacyPage />} />
              <Route path={ROUTES.TERMS} element={<TermsPage />} />
              <Route path={ROUTES.OSS_LICENSES} element={<OssLicensesPage />} />
              <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
