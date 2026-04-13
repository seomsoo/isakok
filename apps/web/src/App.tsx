import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/queryClient'
import { ROUTES } from '@shared/constants/routes'
import { LandingPage } from '@/pages/LandingPage'
import { OnboardingPage } from '@/pages/OnboardingPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { PreCheckPage } from '@/pages/PreCheckPage'
import { TimelinePage } from '@/pages/TimelinePage'
import { SettingsPage } from '@/pages/SettingsPage'
import { ChecklistDetailPage } from '@/pages/ChecklistDetailPage'
import { ToastProvider } from '@/shared/components/ToastProvider'

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <BrowserRouter>
          <Routes>
            <Route path={ROUTES.LANDING} element={<LandingPage />} />
            <Route path={ROUTES.ONBOARDING} element={<OnboardingPage />} />
            <Route path={ROUTES.PRE_CHECK} element={<PreCheckPage />} />
            <Route path={ROUTES.DASHBOARD} element={<DashboardPage />} />
            <Route path={ROUTES.TIMELINE} element={<TimelinePage />} />
            <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
            <Route path={ROUTES.CHECKLIST_DETAIL} element={<ChecklistDetailPage />} />
            <Route
              path={ROUTES.PHOTOS}
              element={
                <div className="flex min-h-dvh items-center justify-center bg-neutral text-muted">
                  집기록 기능은 준비 중이에요
                </div>
              }
            />
            <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
