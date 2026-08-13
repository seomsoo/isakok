import { lazy, type ComponentType } from 'react'

/**
 * 콜드 페이지 코드 스플리팅용 lazy 로더 (named export 대응).
 * React.lazy는 로더 결과(거부 포함)를 인스턴스에 캐시하므로, 두 시도 모두 실패하면 인스턴스를
 * 새로 만들어 다음 렌더(=ErrorBoundary "다시 시도")가 load()를 실제로 재호출하게 한다.
 * WebView 세션이 배포를 넘겨 살아있으면 구 해시 청크 404가 날 수 있어서 — 풀 리로드 금지
 * 규칙(ErrorBoundary) 안에서 회복 경로를 보장.
 */
export function lazyPage<P extends object>(load: () => Promise<ComponentType<P>>) {
  let Current = make()

  function make() {
    return lazy(async (): Promise<{ default: ComponentType<P> }> => {
      try {
        return { default: await load() }
      } catch {
        try {
          // 일시적 네트워크 실패는 즉시 1회 재시도
          return { default: await load() }
        } catch (err) {
          // 거부가 캐시된 인스턴스 폐기 — 다음 렌더는 새 인스턴스로 load()부터 다시
          Current = make()
          throw err
        }
      }
    })
  }

  return function LazyPage(props: P) {
    const Component = Current
    return <Component {...props} />
  }
}
