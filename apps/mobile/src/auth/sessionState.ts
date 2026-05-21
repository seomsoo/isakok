import type { Session } from '@supabase/supabase-js'

let currentSession: Session | null = null

export function setCurrentSession(s: Session | null) {
  currentSession = s
}

export function getCurrentSession(): Session | null {
  return currentSession
}

export function clearCurrentSession() {
  currentSession = null
}
