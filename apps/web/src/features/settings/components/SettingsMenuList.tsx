import { ChevronRight } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { isNativeWebView, sendToNative } from '@shared/utils/nativeBridge'
import { ROUTES } from '@shared/constants/routes'
import { useUserId } from '@/auth/useSession'

interface MenuItem {
  label: string
  value?: string
  onClick?: () => void
  isDisabled?: boolean
  isDanger?: boolean
  ariaLabel?: string
}

function MenuSection({ title, items }: { title: string; items: MenuItem[] }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-body-sm text-muted">{title}</h2>
      <div className="overflow-hidden rounded-2xl bg-surface shadow-sm">
        {items.map((item, index) => (
          <div key={item.label}>
            {index > 0 && <div className="mx-4 border-t border-border" />}
            {item.onClick ? (
              <button
                type="button"
                onClick={item.onClick}
                disabled={item.isDisabled}
                aria-label={item.ariaLabel}
                className="flex w-full items-center justify-between px-4 py-3.5"
              >
                <span className={`text-body ${item.isDanger ? 'text-critical' : 'text-secondary'}`}>
                  {item.label}
                </span>
                <ChevronRight size={18} className="text-placeholder" aria-hidden="true" />
              </button>
            ) : (
              <div className="flex items-center justify-between px-4 py-3.5">
                <span className="text-body text-secondary">{item.label}</span>
                <span className="text-body-sm text-muted">{item.value}</span>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

interface SettingsMenuListProps {
  onDeleteAccount?: () => void
}

export function SettingsMenuList({ onDeleteAccount }: SettingsMenuListProps = {}) {
  const { isAnonymous } = useUserId()
  const navigate = useNavigate()

  const infoItems: MenuItem[] = [
    {
      label: '개인정보처리방침',
      onClick: () => navigate(ROUTES.PRIVACY),
    },
    {
      label: '이용약관',
      onClick: () => navigate(ROUTES.TERMS),
    },
    {
      label: '문의하기',
      onClick: () => {
        window.location.href = 'mailto:usnimoes@gmail.com'
      },
    },
    {
      label: '앱 버전',
      value: 'v1.0.0',
    },
  ]

  const accountItems: MenuItem[] | null =
    isAnonymous === true
      ? [
          {
            label: '로그인',
            onClick: () => {
              if (isNativeWebView()) {
                sendToNative({ type: 'REQUEST_LOGIN' })
              }
            },
          },
        ]
      : isAnonymous === false
        ? [
            {
              label: '로그아웃',
              onClick: () => {
                if (isNativeWebView()) {
                  sendToNative({ type: 'REQUEST_LOGOUT' })
                }
              },
            },
            ...(onDeleteAccount
              ? [
                  {
                    label: '계정 삭제',
                    isDanger: true,
                    onClick: onDeleteAccount,
                    ariaLabel: '계정 삭제 (되돌릴 수 없음)',
                  },
                ]
              : []),
          ]
        : null

  return (
    <div className="flex flex-col gap-6">
      {accountItems && <MenuSection title="계정" items={accountItems} />}
      <MenuSection title="정보" items={infoItems} />
    </div>
  )
}
