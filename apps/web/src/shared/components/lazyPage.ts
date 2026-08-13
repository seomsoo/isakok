import { lazy, type ComponentType, type LazyExoticComponent } from 'react'

/**
 * 콜드 페이지 코드 스플리팅용 lazy 로더 (named export 대응).
 * 청크 로드 실패 시 1회 재시도 — WebView 세션이 배포를 넘겨 살아있으면 구 해시 청크가
 * 404가 날 수 있어서. 재시도도 실패하면 throw → 라우트 ErrorBoundary의 "다시 시도" UI로 처리.
 */
export function lazyPage<P extends object>(
  load: () => Promise<ComponentType<P>>,
): LazyExoticComponent<ComponentType<P>> {
  return lazy(async () => {
    try {
      return { default: await load() }
    } catch {
      return { default: await load() }
    }
  })
}
