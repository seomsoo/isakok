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
  const { data, error } = await supabase.functions.invoke('generate-ai-guide', {
    body: payload,
  })

  if (error) {
    throw new Error(`[invokeGenerateAiGuide] ${error.message}`)
  }

  return data as GenerateAiGuideResponse
}
