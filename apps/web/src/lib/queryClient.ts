import { QueryClient, QueryCache, MutationCache } from '@tanstack/react-query'
import { handleAuthError } from '@/auth/authError'

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (err) => handleAuthError(err),
  }),
  mutationCache: new MutationCache({
    onError: (err) => handleAuthError(err),
  }),
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
      refetchOnWindowFocus: false,
    },
  },
})
