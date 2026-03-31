import { COLORS } from '@shared/constants/colors'

export function App() {
  // COLORS import 확인용 — 콘솔에서 확인 가능
  console.log('Design tokens loaded:', Object.keys(COLORS).length)

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4">
      <h1 className="text-2xl font-bold text-secondary">이사 매니저</h1>
      <p className="mt-2 text-secondary/60">0단계 세팅 완료</p>
      <div className="mt-6 flex gap-3">
        <span className="rounded-full bg-primary px-3 py-1 text-sm text-white">Primary</span>
        <span className="rounded-full bg-warning px-3 py-1 text-sm text-white">Warning</span>
        <span className="rounded-full bg-critical px-3 py-1 text-sm text-white">Critical</span>
        <span className="rounded-full bg-success px-3 py-1 text-sm text-white">Success</span>
      </div>
    </div>
  )
}
