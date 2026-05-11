import { WEB_APP_URL } from '../constants/config'

export function isAllowedWebUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    const appUrl = new URL(WEB_APP_URL)

    if (parsed.origin === appUrl.origin) return true

    if (__DEV__) {
      if (parsed.hostname === 'localhost') return true
      if (parsed.hostname.startsWith('192.168.')) return true
      if (parsed.hostname.startsWith('10.')) return true
      if (parsed.hostname.endsWith('.vercel.app')) return true
    }

    return false
  } catch {
    return false
  }
}
