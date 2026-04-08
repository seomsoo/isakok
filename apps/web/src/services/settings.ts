import { supabase } from '@/lib/supabase'

interface UpdateMoveInput {
  moveId: string
  movingDate: string
  housingType: string
  contractType: string
  moveType: string
}

/**
 * 이사 정보 수정 + 미완료 항목 재배치 (RPC 호출)
 * 완료된 항목은 건드리지 않음 (RPC 내부에서 미완료만 재배치)
 * @param params - 수정할 이사 정보
 */
export async function updateMoveWithReschedule(params: UpdateMoveInput) {
  const { data, error } = await supabase.rpc('update_move_with_reschedule', {
    p_move_id: params.moveId,
    p_moving_date: params.movingDate,
    p_housing_type: params.housingType,
    p_contract_type: params.contractType,
    p_move_type: params.moveType,
  })

  if (error) throw new Error(`[updateMoveWithReschedule] ${error.message}`)
  return data
}
