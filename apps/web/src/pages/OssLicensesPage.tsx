import { useState } from 'react'
import { ChevronLeft, ChevronDown } from 'lucide-react'
import { ROUTES } from '@moving/shared'
import { useGoBack } from '@/shared/hooks/useGoBack'
import { OSS_LICENSES } from '@/data/ossLicenses'

export function OssLicensesPage() {
  const goBack = useGoBack(ROUTES.SETTINGS)
  const [openIndex, setOpenIndex] = useState<number | null>(null)

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
          이 앱은 아래 오픈소스 소프트웨어를 사용하며, 각 라이선스 고지를 따릅니다. 항목을 누르면
          전문을 볼 수 있습니다.
        </p>

        <ul className="mt-5 overflow-hidden rounded-2xl bg-surface shadow-sm">
          {OSS_LICENSES.map((lib, index) => {
            const isOpen = openIndex === index
            const panelId = `oss-license-panel-${index}`
            return (
              <li key={lib.name} className={index > 0 ? 'border-t border-border' : ''}>
                <button
                  type="button"
                  onClick={() => setOpenIndex(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  aria-controls={panelId}
                  className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-medium text-secondary">
                      {lib.name}
                    </span>
                    <span className="mt-0.5 block text-[12px] text-muted">
                      {lib.version} · {lib.license}
                    </span>
                  </span>
                  <ChevronDown
                    size={18}
                    className={`shrink-0 text-muted transition-transform duration-150 motion-reduce:transition-none ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    aria-hidden="true"
                  />
                </button>

                {isOpen && (
                  <div id={panelId} className="px-4 pb-4">
                    {lib.synthesized && (
                      <p className="mb-2 text-[11px] leading-relaxed text-muted/80">
                        이 패키지는 배포물에 LICENSE 파일을 포함하지 않아 표준 {lib.license} 문안을
                        표기합니다.
                      </p>
                    )}
                    <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-neutral px-3 py-3 font-sans text-[12px] leading-relaxed text-secondary">
                      {lib.text}
                    </pre>
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      </div>
    </main>
  )
}
