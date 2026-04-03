import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createMoveWithChecklist } from '@/services/move'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { ROUTES } from '@shared/constants/routes'

export function useCreateMove() {
  const navigate = useNavigate()
  const reset = useOnboardingStore((s) => s.reset)

  return useMutation({
    mutationFn: createMoveWithChecklist,
    onSuccess: () => {
      reset()
      navigate(ROUTES.DASHBOARD, { replace: true })
    },
    onError: (error) => {
      console.error('체크리스트 생성 실패:', error)
    },
  })
}
