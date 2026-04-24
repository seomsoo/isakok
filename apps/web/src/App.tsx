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
import { PhotosPage } from '@/pages/PhotosPage'
import { PhotoRoomPage } from '@/pages/PhotoRoomPage'
import { PhotoReportPage } from '@/pages/PhotoReportPage'
import { PhotoTrashPage } from '@/pages/PhotoTrashPage'
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
            <Route path={ROUTES.PHOTO_REPORT} element={<PhotoReportPage />} />
            <Route path={ROUTES.PHOTO_TRASH} element={<PhotoTrashPage />} />
            <Route path={ROUTES.PHOTOS} element={<PhotosPage />} />
            <Route path="/photos/:room" element={<PhotoRoomPage />} />
            <Route path="*" element={<Navigate to={ROUTES.LANDING} replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </QueryClientProvider>
  )
}
