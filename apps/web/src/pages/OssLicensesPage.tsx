import { ChevronLeft } from 'lucide-react'
import { ROUTES } from '@moving/shared'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { OSS_LICENSES } from '@/data/ossLicenses'

export function OssLicensesPage() {
  const goBack = useGoBack(ROUTES.SETTINGS)

  return (
    <main className="min-h-dvh bg-neutral">
      <div className="flex items-center px-1 pt-[env(safe-area-inset-top)] h-11">
        <button
          type="button"
          onClick={goBack}
          aria-label="뒤로가기"
          className="flex h-11 w-11 items-center justify-center text-secondary"
        >
          <ChevronLeft size={22} strokeWidth={2.2} />
        </button>
      </div>

      <div className="px-5 pb-12">
        <h1 className="text-[24px] font-bold tracking-tight text-secondary">오픈소스 라이선스</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-muted">
          이 앱은 아래 오픈소스 소프트웨어를 사용하며, 각 라이선스 고지를 따릅니다.
        </p>

        <ul className="mt-5 overflow-hidden rounded-2xl bg-surface shadow-sm">
          {OSS_LICENSES.map((lib, index) => (
            <li key={lib.name} className={index > 0 ? 'border-t border-border' : ''}>
              <div className="px-4 py-3">
                <p className="text-[14px] font-medium text-secondary">{lib.name}</p>
                <p className="mt-0.5 text-[12px] text-muted">
                  {lib.version} · {lib.license}
                </p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
