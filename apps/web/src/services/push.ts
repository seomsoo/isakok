import { supabase } from '@/lib/supabase'

// 푸시 설정은 users 행에 저장(push_enabled / push_prompt_seen_at). 둘 다 10-2의 users UPDATE 차단으로
// 직접 update 불가 → 읽기는 본인 행 SELECT(RLS), 쓰기는 화이트리스트 RPC(set_push_enabled / set_push_prompt_seen).

/** 본인 user 행의 앱 토글 상태 조회 (RLS: 본인 행만). */
export async function getPushEnabled(userId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('users')
    .select('push_enabled')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(`[getPushEnabled] ${error.message}`)
  return data?.push_enabled ?? false
}

/** soft-ask 노출 조건 판정용: prompt 노출 이력 + 앱 토글 상태. */
export async function getPushPromptState(
  userId: string,
): Promise<{ promptSeen: boolean; pushEnabled: boolean }> {
  const { data, error } = await supabase
    .from('users')
    .select('push_prompt_seen_at, push_enabled')
    .eq('id', userId)
    .maybeSingle()
  if (error) throw new Error(`[getPushPromptState] ${error.message}`)
  return { promptSeen: !!data?.push_prompt_seen_at, pushEnabled: data?.push_enabled ?? false }
}

/** 앱 토글 변경 (OFF는 웹에서, ON은 네이티브 등록 흐름이 set). users UPDATE 차단 우회 RPC. */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_push_enabled', { p_enabled: enabled })
  if (error) throw new Error(`[setPushEnabled] ${error.message}`)
}

/** soft-ask 노출 가드 기록 (받기/나중에 모두 1회 호출). 이미 기록돼 있으면 RPC가 no-op. */
export async function markPushPromptSeen(): Promise<void> {
  const { error } = await supabase.rpc('set_push_prompt_seen')
  if (error) throw new Error(`[markPushPromptSeen] ${error.message}`)
}
