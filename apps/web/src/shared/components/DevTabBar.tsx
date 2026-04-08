import { House, ClipboardList, Camera } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@shared/constants/routes'
import { cn } from '@/lib/cn'

const TABS = [
  { to: ROUTES.DASHBOARD, icon: House, label: '홈' },
  { to: ROUTES.TIMELINE, icon: ClipboardList, label: '전체' },
  { to: ROUTES.PHOTOS, icon: Camera, label: '집기록' },
] as const

export function DevTabBar() {
  return (
    <nav
      role="navigation"
      aria-label="메인 네비게이션"
      className="fixed bottom-0 left-1/2 z-20 w-full max-w-[430px] -translate-x-1/2 border-t border-border bg-surface pb-[env(safe-area-inset-bottom)]"
    >
      <div className="flex h-14">
        {TABS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center justify-center gap-0.5',
                isActive ? 'text-primary' : 'text-placeholder',
              )
            }
            aria-current="page"
          >
            <Icon size={22} strokeWidth={1.8} />
            <span className="text-caption">{label}</span>
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
