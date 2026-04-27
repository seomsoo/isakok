import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invokeGenerateAiGuide } from '../services/aiGuide'

export function useGenerateAiGuide() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: invokeGenerateAiGuide,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['checklist'] })
    },
    onError: (err) => {
      console.error('[ai-guide] background generation failed', err)
    },
  })
}
