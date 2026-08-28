import { WEB_APP_URL } from '../constants/config'

// dev 빌드에서만 허용하는 로컬·프리뷰 호스트. 정확한 호스트/사설 IP 패턴만 — 접두·접미 문자열 매칭은
// `10.evil.com`, `evil.vercel.app` 같은 호스트를 통과시킨다.
const DEV_HOST_PATTERNS: readonly RegExp[] = [
  /^localhost$/,
  /^127\.0\.0\.1$/,
  /^10\.0\.2\.2$/, // Android 에뮬레이터 → 호스트
  /^192\.168\.\d{1,3}\.\d{1,3}$/,
  /^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/,
  /^isakok(-[a-z0-9-]+)?\.vercel\.app$/, // Vercel 프리뷰(isakok-*)만
]

export function isAllowedWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const appUrl = new URL(WEB_APP_URL)

    if (parsed.origin === appUrl.origin) return true

    if (__DEV__ && (parsed.protocol === 'http:' || parsed.protocol === 'https:')) {
      return DEV_HOST_PATTERNS.some((pattern) => pattern.test(parsed.hostname))
    }

    return false
  } catch {
    return false
  }
}
