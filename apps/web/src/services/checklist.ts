import { format } from 'date-fns'
import { supabase } from '@/lib/supabase'

export interface OverdueItem {
  id: string
  assigned_date: string
  master_item: {
    title: string
    category: string
  }
}

/**
 * 대시보드용 항목 조회: 밀린 할 일 + 오늘 할 일 + 앞으로 할 일
 * @param moveId - 이사 ID
 */
export async function getDashboardItems(moveId: string) {
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('*, master_checklist_items(*)')
    .eq('move_id', moveId)
    .eq('is_completed', false)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getDashboardItems] ${error.message}`)

  const overdueItems = data?.filter((item) => item.assigned_date < today) ?? []
  const todayItems = data?.filter((item) => item.assigned_date === today) ?? []
  const upcomingItems = data?.filter((item) => item.assigned_date > today) ?? []

  return { overdue: overdueItems, today: todayItems, upcoming: upcomingItems }
}

/**
 * 전체 체크리스트 조회 (타임라인용)
 * 날짜별 그룹핑은 프론트에서 처리
 * @param moveId - 이사 ID
 */
export async function getTimelineItems(moveId: string) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('*, master_checklist_items(*)')
    .eq('move_id', moveId)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getTimelineItems] ${error.message}`)
  return data ?? []
}

/**
 * 체크리스트 항목 완료/미완료 토글
 * @param itemId - 체크리스트 항목 ID
 * @param moveId - 이사 ID (방어적 스코프)
 * @param isCompleted - 완료 여부
 */
export async function toggleChecklistItem(
  itemId: string,
  moveId: string,
  isCompleted: boolean,
) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .eq('move_id', moveId)
    .select()
    .single()

  if (error) throw new Error(`[toggleChecklistItem] ${error.message}`)
  return data
}

/**
 * 밀린 항목 조회 (assigned_date < 오늘 AND 미완료)
 * master_checklist_items와 JOIN해서 title, category 포함
 * @param moveId - 이사 ID
 * @returns 밀린 항목 리스트
 */
export async function getOverdueItems(moveId: string): Promise<OverdueItem[]> {
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('id, assigned_date, master_item:master_checklist_items(title, category)')
    .eq('move_id', moveId)
    .lt('assigned_date', today)
    .eq('is_completed', false)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getOverdueItems] ${error.message}`)
  return (data ?? []) as unknown as OverdueItem[]
}

/**
 * 체크리스트 항목 일괄 완료 처리
 * @param itemIds - 완료 처리할 항목 ID 배열
 */
export async function batchCompleteItems(itemIds: string[]): Promise<void> {
  if (itemIds.length === 0) return

  const { error } = await supabase
    .from('user_checklist_items')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .in('id', itemIds)

  if (error) throw new Error(`[batchCompleteItems] ${error.message}`)
}
