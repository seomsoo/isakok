import { onLCP, onCLS, onINP, onFCP, onTTFB, type Metric } from 'web-vitals'
import { captureEvent, ANALYTICS_EVENTS } from './events'
import { isProduction } from './env'

/**
 * Web Vitals RUM (스펙 13 §7, ADR-102) — 실유저 field 성능을 PostHog로 사후 모니터.
 *
 * lab(Lighthouse)은 Chromium이라 iOS WKWebView 성능을 못 봄 → RUM이 iOS 포함 field 진실.
 * 게이트가 아니라 머지 후 관측(머지를 막지 않음). production 빌드 전용 — dev=prod라 internal도
 * production 빌드이므로, 지표 해석 시 섞이지 않게 release_channel로 internal/production 구분.
 */
const ENABLED = isProduction()
let initialized = false // HMR·remount·WebView reload로 여러 번 불려도 metric 1회만 등록

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * pathname을 라우트 패턴으로 정규화 — 동적 세그먼트(체크리스트 itemId UUID·숫자 id)를 :id로 치환.
 * 구체 경로/식별자를 PostHog로 보내지 않게(events.ts §2-2 "경로 금지" 규율) + 고카디널리티 방지.
 * RUM은 경로별 성능 버킷팅이 목적이라 라우트 패턴이면 충분.
 */
export function toRoutePattern(pathname: string): string {
  const segments = pathname
    .split('/')
    .filter(Boolean)
    .map((seg) => (UUID_RE.test(seg) || /^\d+$/.test(seg) ? ':id' : seg))
  return '/' + segments.join('/')
}

function report(metric: Metric): void {
  // 화이트리스트(events.ts) 통과 속성만. path 대신 정규화한 route 전송.
  captureEvent(ANALYTICS_EVENTS.WEB_VITALS, {
    metric: metric.name, // LCP / CLS / INP / FCP / TTFB
    value: metric.value,
    rating: metric.rating, // good / needs-improvement / poor
    route: toRoutePattern(window.location.pathname),
    release_channel: import.meta.env.VITE_RELEASE_CHANNEL ?? 'unknown', // internal | production
  })
}

/**
 * Web Vitals 수집 시작 — production 전용. 앱 진입점(main.tsx)에서 1회 호출.
 * LCP(로딩)만 보면 인터랙션 지연을 놓침 → INP 포함(2024 Core Web Vital, 토글·폼 많은 앱이라 체감에 근접).
 */
export function initWebVitals(): void {
  if (!ENABLED || initialized) return
  initialized = true
  onLCP(report)
  onCLS(report)
  onINP(report)
  onFCP(report)
  onTTFB(report)
}
