import { useEffect, useRef, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { useDebouncedCallback } from 'use-debounce'
import { useUpdateMemo } from '../hooks/useUpdateMemo'
import { useToast } from '@/shared/components/ToastProvider'
import { SectionTitle } from './SectionTitle'

interface MemoSectionProps {
  itemId: string
  initialMemo: string | null
}

type SaveStatus = 'idle' | 'saving' | 'saved'

export function MemoSection({ itemId, initialMemo }: MemoSectionProps) {
  const [memo, setMemo] = useState(initialMemo ?? '')
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const updateMemo = useUpdateMemo(itemId)
  const toast = useToast()
  const lastSavedRef = useRef(initialMemo ?? '')
  const inFlightRef = useRef(false)
  const pendingRef = useRef<string | null>(null)
  const savedTimerRef = useRef<number | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement | null>(null)

  const save = (value: string) => {
    if (value === lastSavedRef.current) return
    if (inFlightRef.current) {
      pendingRef.current = value
      return
    }
    inFlightRef.current = true
    setSaveStatus('saving')
    updateMemo.mutate(value, {
      onSuccess: () => {
        lastSavedRef.current = value
        inFlightRef.current = false
        const next = pendingRef.current
        if (next !== null && next !== value) {
          pendingRef.current = null
          save(next)
          return
        }
        pendingRef.current = null
        setSaveStatus('saved')
        if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
        savedTimerRef.current = window.setTimeout(() => setSaveStatus('idle'), 2000)
      },
      onError: () => {
        inFlightRef.current = false
        pendingRef.current = null
        toast.error('메모 저장에 실패했어요')
        setSaveStatus('idle')
      },
    })
  }

  const debouncedSave = useDebouncedCallback(save, 1000)

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [memo])

  useEffect(() => {
    return () => {
      if (savedTimerRef.current !== null) clearTimeout(savedTimerRef.current)
    }
  }, [])

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const value = e.target.value
    setMemo(value)
    debouncedSave(value)
  }

  function handleBlur() {
    debouncedSave.flush()
  }

  return (
    <section>
      <SectionTitle
        right={
          <span
            role="status"
            aria-live="polite"
            aria-label={
              saveStatus === 'saving' ? '저장 중' : saveStatus === 'saved' ? '저장됨' : undefined
            }
            className="flex items-center text-body-sm text-muted"
          >
            {saveStatus === 'saving' && (
              <Loader2 size={16} className="animate-spin text-muted" strokeWidth={2.5} />
            )}
            {saveStatus === 'saved' && <span className="text-success">저장됨</span>}
          </span>
        }
      >
        내 메모
      </SectionTitle>
      <textarea
        ref={textareaRef}
        aria-label="메모 입력"
        placeholder="이 할 일에 관련된 메모를 남겨보세요"
        value={memo}
        onChange={handleChange}
        onBlur={handleBlur}
        className="w-full min-h-24 resize-none rounded-xl bg-surface px-4 py-3.5 text-body leading-relaxed text-secondary ring-1 ring-border placeholder:text-placeholder focus:outline-none focus:ring-[1.5px] focus:ring-primary"
      />
    </section>
  )
}
