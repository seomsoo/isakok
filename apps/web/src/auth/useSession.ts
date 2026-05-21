import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'

const SESSION_KEY = ['auth', 'session'] as const

export function useSession() {
  const qc = useQueryClient()

  useEffect(() => {
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      qc.invalidateQueries({ queryKey: SESSION_KEY })
    })
    return () => subscription.unsubscribe()
  }, [qc])

  return useQuery({
    queryKey: SESSION_KEY,
    queryFn: async () => {
      const { data } = await supabase.auth.getSession()
      return data.session
    },
    staleTime: 1000 * 60,
  })
}

export function useUserId() {
  const query = useSession()
  return {
    userId: query.data?.user?.id ?? null,
    isLoading: query.isLoading,
    isAnonymous: query.data?.user?.is_anonymous ?? null,
  }
}
