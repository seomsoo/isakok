/**
 * 앱 내 라우트 경로
 * 매직 문자열 방지용. 라우터 설정 + 네비게이션에서 공유.
 */
export const ROUTES = {
  LANDING: '/',
  ONBOARDING: '/onboarding',
  DASHBOARD: '/dashboard',
  TIMELINE: '/timeline',
  CHECKLIST_DETAIL: '/checklist/:itemId',
  PHOTOS: '/photos',
  PHOTO_RECORD: '/photos/record',
  PHOTO_REPORT: '/photos/report',
  SETTINGS: '/settings',
} as const
