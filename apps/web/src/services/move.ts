import { supabase } from '@/lib/supabase'

interface CreateMoveInput {
  movingDate: string
  housingType: string
  contractType: string
  moveType: string
}

/**
 * 이사 생성 + 맞춤 체크리스트 자동 생성 (트랜잭션)
 * @param input - 온보딩 폼 데이터
 * @returns 생성된 이사 ID (uuid)
 * @throws RPC 실패 시 [createMoveWithChecklist] 접두사와 함께 throw
 */
export async function createMoveWithChecklist(input: CreateMoveInput): Promise<string> {
  if (!input.movingDate || !input.housingType || !input.contractType || !input.moveType) {
    throw new Error('[createMoveWithChecklist] 필수 입력값이 누락되었습니다')
  }

  const { data, error } = await supabase.rpc('create_move_with_checklist', {
    p_moving_date: input.movingDate,
    p_housing_type: input.housingType,
    p_contract_type: input.contractType,
    p_move_type: input.moveType,
    p_is_first_move: false,
    p_from_address: null,
    p_to_address: null,
    p_user_id: '00000000-0000-0000-0000-000000000000',
  })

  if (error) {
    throw new Error(`[createMoveWithChecklist] ${error.message}`)
  }

  return data as string
}
