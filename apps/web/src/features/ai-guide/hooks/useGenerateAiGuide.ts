import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeGenerateAiGuide } from '../services/aiGuide'
import { queryKeys } from '@/features/dashboard/hooks/queryKeys'

export function useGenerateAiGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invokeGenerateAiGuide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.checklistAll })
    },
    onError: (err) => {
      console.error('[ai-guide] background generation failed', err)
    },
  })
}
