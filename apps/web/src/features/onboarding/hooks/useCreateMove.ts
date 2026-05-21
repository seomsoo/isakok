import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { createMoveWithChecklist, getCurrentMove, type Move } from '@/services/move'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'
import { useOnboardingStore } from '@/stores/onboardingStore'
import { useMoveStore } from '@/stores/moveStore'
import { useUserId } from '@/auth/useSession'
import { ROUTES } from '@shared/constants/routes'

export function useCreateMove() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const reset = useOnboardingStore((s) => s.reset)
  const setCurrentMoveId = useMoveStore((s) => s.setCurrentMoveId)
  const { userId } = useUserId()

  return useMutation({
    mutationFn: async (input: {
      movingDate: string
      housingType: string
      contractType: string
      moveType: string
    }) => {
      let uid = userId
      if (!uid) {
        const { data } = await import('@/lib/supabase').then((m) => m.supabase.auth.getSession())
        uid = data.session?.user?.id ?? null
      }
      if (!uid) throw new Error('session missing')
      return createMoveWithChecklist({ ...input, userId: uid })
    },
    onSuccess: async (moveId, variables) => {
      const now = new Date().toISOString()
      const fallbackMove: Move = {
        id: moveId,
        user_id: userId ?? '',
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
          queryFn: () => getCurrentMove(userId as string),
          staleTime: 0,
        })

        if (!refreshedMove) {
          queryClient.setQueryData(queryKeys.currentMove, fallbackMove)
        }
      } catch (error) {
        console.error('currentMove refetch failed, using fallback cache:', error)
        queryClient.setQueryData(queryKeys.currentMove, fallbackMove)
      }

      reset()
      navigate(ROUTES.PRE_CHECK, { replace: true })
    },
    onError: (error) => {
      console.error('checklist creation failed:', error)
    },
  })
}
