import { useQuery } from '@tanstack/react-query'
import { useEffect } from 'react'
import { getCurrentMove } from '@/services/move'
import { useMoveStore } from '@/stores/moveStore'
import { useUserId } from '@/auth/useSession'
import { queryKeys } from './queryKeys'

export function useCurrentMove() {
  const setCurrentMoveId = useMoveStore((s) => s.setCurrentMoveId)
  const { userId } = useUserId()

  const query = useQuery({
    queryKey: queryKeys.currentMove,
    queryFn: () => getCurrentMove(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })

  useEffect(() => {
    if (query.data?.id) {
      setCurrentMoveId(query.data.id)
    }
  }, [query.data?.id, setCurrentMoveId])

  return query
}
