import { Component, type ErrorInfo, type ReactNode } from 'react'
import { ErrorMessage } from './ErrorMessage'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/**
 * 렌더 중 예외를 잡아 흰 화면 대신 폴백을 보여주는 경계.
 * React는 에러 경계를 class로만 지원(함수형 훅 부재)하므로 예외적으로 class 사용.
 * App.tsx에서 라우트(pathname) 키로 마운트 → 화면 이동 시 자동 복구.
 * "다시 시도"는 reload가 아니라 상태 리셋으로 제자리 재렌더 (네이티브 느낌: 콜드로드 깜빡임 없음).
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // 진단용 — 전역 핸들러/Sentry가 별도 캡처. 메시지에 PII 보간 금지(관측 규율).
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  private handleReset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh flex-col bg-neutral">
          <ErrorMessage message="문제가 발생했어요" onRetry={this.handleReset} />
        </div>
      )
    }
    return this.props.children
  }
}
