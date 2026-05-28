import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'

function getBrowserHistoryIndex() {
  const state = window.history.state
  if (typeof state !== 'object' || state === null || !('idx' in state)) return 0

  const idx = (state as { idx?: unknown }).idx
  return typeof idx === 'number' ? idx : 0
}

export function useGoBack(fallbackPath: string) {
  const navigate = useNavigate()

  return useCallback(() => {
    if (getBrowserHistoryIndex() > 0) {
      navigate(-1)
      return
    }

    navigate(fallbackPath, { replace: true })
  }, [navigate, fallbackPath])
}
