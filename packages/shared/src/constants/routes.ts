/**
 * 앱 내 라우트 경로
 * 매직 문자열 방지용. 라우터 설정 + 네비게이션에서 공유.
 */
export const ROUTES = {
  LANDING: '/',
  ONBOARDING: '/onboarding',
  PRE_CHECK: '/pre-check',
  DASHBOARD: '/dashboard',
  TIMELINE: '/timeline',
  CHECKLIST_DETAIL: '/checklist/:itemId',
  PHOTOS: '/photos',
  PHOTO_RECORD: '/photos/record',
  PHOTO_REPORT: '/photos/report',
  PHOTO_TRASH: '/photos/trash',
  SETTINGS: '/settings',
} as const
