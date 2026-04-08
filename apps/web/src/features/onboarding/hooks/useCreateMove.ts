import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  createMoveWithChecklist,
  getCurrentMove,
  type Move,
} from '@/services/move'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useMoveStore } from '@/stores/moveStore'
import { ROUTES } from '@shared/constants/routes'

const DEV_USER_ID = '00000000-0000-0000-0000-000000000000'

export function useCreateMove() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reset = useOnboardingStore((s) => s.reset)
  const setCurrentMoveId = useMoveStore((s) => s.setCurrentMoveId)

  return useMutation({
    mutationFn: createMoveWithChecklist,
    onSuccess: async (moveId, variables) => {
      const now = new Date().toISOString()
      const fallbackMove: Move = {
        id: moveId,
        user_id: DEV_USER_ID,
        moving_date: variables.movingDate,
        housing_type: variables.housingType,
        contract_type: variables.contractType,
        move_type: variables.moveType,
        is_first_move: false,
        status: 'active',
        from_address: null,
        to_address: null,
        created_at: now,
        updated_at: now,
        deleted_at: null,
      }

      queryClient.setQueryData(queryKeys.currentMove, (prev: Move | null) => prev ?? fallbackMove)
      setCurrentMoveId(moveId)

      await queryClient.invalidateQueries({
        queryKey: queryKeys.currentMove,
        exact: true,
      })

      try {
        const refreshedMove = await queryClient.fetchQuery({
          queryKey: queryKeys.currentMove,
          queryFn: getCurrentMove,
          staleTime: 0,
        })

        if (!refreshedMove) {
          queryClient.setQueryData(queryKeys.currentMove, fallbackMove)
        }
      } catch (error) {
        console.error('currentMove 재조회 실패, fallback 캐시 사용:', error)
        queryClient.setQueryData(queryKeys.currentMove, fallbackMove)
      }

      reset()
      navigate(ROUTES.PRE_CHECK, { replace: true })
    },
    onError: (error) => {
      console.error('체크리스트 생성 실패:', error)
    },
  })
}
