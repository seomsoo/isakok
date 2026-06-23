import { supabase } from '@/lib/supabase'
import type { GenerateAiGuideRequest, GenerateAiGuideResponse } from '@moving/shared'

/**
 * Edge Function generate-ai-guide 호출
 * @param payload - { moveId } only
 * @returns 생성 결과 (ok + source 또는 error + code)
 */
export async function invokeGenerateAiGuide(
  payload: GenerateAiGuideRequest,
): Promise<GenerateAiGuideResponse> {
  // E2E(test 빌드)에서는 Edge Function/Anthropic 의존을 차단(§3-3) — 상세/대시보드 진입 시
  // background generation이 발화하지 않게 no-op 성공을 반환(로컬 Edge serve·키·네트워크 불요).
  if (import.meta.env.VITE_DISABLE_AI_GUIDE === 'true') {
    return { status: 'ok', source: 'cache_hit', updated: 0 }
  }

  const { data, error } = await supabase.functions.invoke('generate-ai-guide', {
    body: payload,
  })

  if (error) {
    throw new Error(`[invokeGenerateAiGuide] ${error.message}`)
  }

  return data as GenerateAiGuideResponse
}
