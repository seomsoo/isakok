import { ChevronRight } from 'lucide-react'
import { isNativeWebView, sendToNative } from '@shared/utils/nativeBridge'
import { useUserId } from '@/auth/useSession'

interface MenuItem {
  label: string
  value?: string
  onClick?: () => void
  isDisabled?: boolean
  isDanger?: boolean
}

const INFO_ITEMS: MenuItem[] = [
  {
    label: '개인정보처리방침',
    onClick: () => console.log('TODO: 개인정보처리방침'),
  },
  {
    label: '이용약관',
    onClick: () => console.log('TODO: 이용약관'),
  },
  {
    label: '문의하기',
    onClick: () => {
      window.location.href = 'mailto:support@isakok.app'
    },
  },
  {
    label: '앱 버전',
    value: 'v1.0.0',
  },
]

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
                className="flex w-full items-center justify-between px-4 py-3.5"
              >
                <span className={`text-body ${item.isDanger ? 'text-critical' : 'text-secondary'}`}>
                  {item.label}
                </span>
                <ChevronRight size={18} className="text-placeholder" />
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

export function SettingsMenuList() {
  const { isAnonymous } = useUserId()

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
              isDanger: true,
              onClick: () => {
                if (isNativeWebView()) {
                  sendToNative({ type: 'REQUEST_LOGOUT' })
                }
              },
            },
          ]
        : null

  return (
    <div className="flex flex-col gap-6">
      {accountItems && <MenuSection title="계정" items={accountItems} />}
      <MenuSection title="정보" items={INFO_ITEMS} />
    </div>
  )
}
