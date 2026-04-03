import { useNavigate } from 'react-router-dom'
import { Package } from 'lucide-react'
import { ROUTES } from '@shared/constants/routes'
import { Button } from '@/shared/components/Button'

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="flex min-h-dvh flex-col bg-neutral">
      {/* 헤더 */}
      <header className="px-6 pt-8">
        <span className="text-[15px] font-semibold tracking-tight text-secondary">이사콕</span>
      </header>

      {/* 히어로 영역 */}
      <div className="flex flex-1 flex-col items-center justify-center px-6">
        {/* 일러스트 플레이스홀더 */}
        <div className="flex h-48 w-48 items-center justify-center rounded-[28px] bg-gradient-to-br from-tertiary to-tertiary/40">
          <Package className="h-16 w-16 text-primary/50" strokeWidth={1.5} />
        </div>

        {/* 메인 카피 */}
        <h1 className="mt-10 text-center text-h1 font-bold tracking-tight text-secondary">
          이사일만 입력하면
          <br />
          할 일이 알아서 정리돼요
        </h1>
        <p className="mt-3 text-center text-body-sm text-muted">
          D-30부터 입주 후까지, 빠뜨리는 것 없이
        </p>
      </div>

      {/* CTA 영역 */}
      <div className="px-6 pb-10">
        <Button size="lg" onClick={() => navigate(ROUTES.ONBOARDING)}>
          이사 시작하기
        </Button>
        <p className="mt-2.5 text-center text-[13px] text-secondary/35">
          가입 없이 바로 시작
        </p>

        <p className="mt-8 text-center text-[13px] text-secondary/45">
          이미 시작한 이사가 있나요?{' '}
          <button
            type="button"
            className="cursor-pointer font-medium text-primary"
            onClick={() => console.log('TODO: 로그인')}
          >
            로그인
          </button>
        </p>
      </div>
    </div>
  )
}
