import type { ReactNode } from 'react'
import { isNativeWebView, PUSH_SETTING_COPY } from '@moving/shared'
import { Skeleton } from '@/shared/components/Skeleton'
import { usePushSettings } from '../hooks/usePushSettings'

/**
 * 설정 화면 푸시 토글 행 (12단계 §6-2). 푸시는 네이티브 전용이라 브라우저(웹 직접 접속)에선 노출 안 함.
 * effective status 표대로: denied는 토글 대신 "설정에서 켜기", granted+ON+미등록은 "켜는 중".
 */
export function PushSettingRow() {
  if (!isNativeWebView()) return null
  return <PushSettingRowInner />
}

/** section + 제목 + 카드 셸 (loading/error/정상 3상태가 공유). */
function PushRowShell({ children }: { children: ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-body-sm text-muted">알림</h2>
      <div className="rounded-2xl bg-surface px-4 py-3.5 shadow-sm">{children}</div>
    </section>
  )
}

function PushSettingRowInner() {
  const {
    permission,
    hasToken,
    pushEnabled,
    isLoading,
    isError,
    refetch,
    enable,
    disable,
    openSettings,
  } = usePushSettings()

  if (isLoading) {
    return (
      <PushRowShell>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="mt-1.5 h-4 w-40" />
          </div>
          <Skeleton className="h-7 w-12 shrink-0 rounded-full" />
        </div>
      </PushRowShell>
    )
  }

  if (isError) {
    return (
      <PushRowShell>
        <div className="flex items-center justify-between gap-3">
          <p className="text-body-sm text-muted">알림 설정을 불러오지 못했어요</p>
          <button
            type="button"
            onClick={() => refetch()}
            className="shrink-0 rounded-lg px-3 py-2 text-body-sm font-medium text-primary"
          >
            다시 시도
          </button>
        </div>
      </PushRowShell>
    )
  }

  const isDenied = permission === 'denied'
  const checked = !isDenied && pushEnabled
  const statusText = isDenied
    ? PUSH_SETTING_COPY.osDisabledTitle
    : permission === 'granted' && pushEnabled && !hasToken
      ? PUSH_SETTING_COPY.registering
      : PUSH_SETTING_COPY.description

  const handleToggle = () => {
    if (checked) disable()
    else enable()
  }

  return (
    <PushRowShell>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-body text-secondary">{PUSH_SETTING_COPY.title}</p>
          {/* 상태 전이("켜는 중"→완료, denied 전환 등)를 스크린리더가 읽도록 live region */}
          <p
            className={`mt-0.5 text-body-sm ${isDenied ? 'text-critical' : 'text-muted'}`}
            aria-live="polite"
          >
            {statusText}
          </p>
        </div>

        {isDenied ? (
          <button
            type="button"
            onClick={openSettings}
            className="shrink-0 rounded-lg px-3 py-2 text-body-sm font-medium text-primary"
          >
            {PUSH_SETTING_COPY.osDisabledAction}
          </button>
        ) : (
          <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={PUSH_SETTING_COPY.title}
            onClick={handleToggle}
            className="flex h-11 w-12 shrink-0 items-center"
          >
            {/* 시각 트랙은 28px 유지, 터치 hit area는 버튼(h-11=44px)로 확장 (WCAG 2.5.8) */}
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                checked ? 'bg-primary' : 'bg-placeholder/50'
              }`}
            >
              {/* 썸은 left로 위치 — ON은 calc로 트랙 우측 2px에 고정(폰트 스케일·렌더 차이와 무관하게 트랙 안에 머묾), 수직은 top-1/2 중앙정렬 */}
              <span
                className={`absolute top-1/2 h-6 w-6 -translate-y-1/2 rounded-full bg-surface shadow transition-[left] duration-200 ${
                  checked ? 'left-[calc(100%_-_1.625rem)]' : 'left-0.5'
                }`}
              />
            </span>
          </button>
        )}
      </div>
    </PushRowShell>
  )
}
