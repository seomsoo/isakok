import { useQuery } from '@tanstack/react-query'
import { getCurrentMove } from '@/services/move'
import { useUserId } from '@/auth/useSession'
import { queryKeys } from './queryKeys'

export function useCurrentMove() {
  const { userId } = useUserId()

  return useQuery({
    queryKey: queryKeys.currentMove,
    queryFn: () => getCurrentMove(userId as string),
    enabled: !!userId,
    staleTime: 5 * 60 * 1000,
  })
}
