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
  PRIVACY: '/privacy',
  TERMS: '/terms',
  OSS_LICENSES: '/oss-licenses',
} as const

/**
 * 네이티브 탭바의 루트 경로 목록
 * WebView 스와이프백 가드, 탭바 표시 판단에 사용
 */
export const TAB_ROOT_PATHS = [
  ROUTES.LANDING,
  ROUTES.DASHBOARD,
  ROUTES.TIMELINE,
  ROUTES.PHOTOS,
] as const

/** 체크리스트 상세 페이지 경로 생성 */
export function checklistDetailPath(itemId: string, from: 'dashboard' | 'timeline') {
  return `/checklist/${itemId}?from=${from}`
}
