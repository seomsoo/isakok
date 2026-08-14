import { format } from 'date-fns'
import type { GuideType } from '@moving/shared'
import type { Tables } from '@shared/types/database'
import { supabase } from '@/lib/supabase'

// 리스트 화면(대시보드·타임라인)이 실제 소비하는 컬럼 — 타입과 select 문자열의 단일 출처.
// 컬럼이 더 필요하면 이 배열에 추가해야 타입에 잡히고 select에도 같이 반영된다.
// (guide 본문·custom_guide·memo는 리스트 미사용 — 상세 페이지는 getChecklistItemDetail이 별도 조회)
const LIST_ITEM_COLUMNS = [
  'id',
  'assigned_date',
  'is_completed',
  'completed_at',
] as const satisfies readonly (keyof Tables<'user_checklist_items'>)[]

const LIST_MASTER_COLUMNS = [
  'title',
  'category',
  'guide_type',
  'is_skippable',
] as const satisfies readonly (keyof Tables<'master_checklist_items'>)[]

const LIST_SELECT = `${LIST_ITEM_COLUMNS.join(', ')}, master_checklist_items(${LIST_MASTER_COLUMNS.join(', ')})`

/** 리스트 select가 가져오는 master 요약. guide_type 유니온은 DB CHECK 제약이 보장 */
export type ChecklistMasterSummary = Omit<
  Pick<Tables<'master_checklist_items'>, (typeof LIST_MASTER_COLUMNS)[number]>,
  'guide_type'
> & { guide_type: GuideType }

/**
 * getDashboardItems/getTimelineItems가 반환하는 행 —
 * user_checklist_items 컬럼 + master_checklist_items 중첩 (LIST_*_COLUMNS와 1:1)
 */
export type ChecklistItemWithMaster = Pick<
  Tables<'user_checklist_items'>,
  (typeof LIST_ITEM_COLUMNS)[number]
> & {
  master_checklist_items: ChecklistMasterSummary | null
}

/**
 * 스마트 재배치(빠듯 모드)가 클라이언트에서 계산해 붙이는 파생 필드 — DB 컬럼이 아니며 select 대상 아님.
 * display_date: 재배치된 표시용 날짜(대시보드), _original_date: 재배치로 assigned_date를 덮기 전 원본(타임라인)
 */
export type RescheduledChecklistItem = ChecklistItemWithMaster & {
  display_date?: string
  _original_date?: string
}

export interface DashboardItems {
  overdue: ChecklistItemWithMaster[]
  today: ChecklistItemWithMaster[]
  upcoming: ChecklistItemWithMaster[]
}

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
 * @param userId - 소유자 ID (user_id 필터)
 */
export async function getDashboardItems(moveId: string, userId: string): Promise<DashboardItems> {
  const today = format(new Date(), 'yyyy-MM-dd')

  // 결과 타입 명시는 untyped 클라이언트 경계 — LIST_SELECT가 타입과 동일한 컬럼 배열에서 생성되므로 안전
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select<string, ChecklistItemWithMaster>(LIST_SELECT)
    .eq('move_id', moveId)
    .eq('user_id', userId)
    .eq('is_completed', false)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getDashboardItems] ${error.message}`)

  const items = data ?? []

  return {
    overdue: items.filter((item) => item.assigned_date < today),
    today: items.filter((item) => item.assigned_date === today),
    upcoming: items.filter((item) => item.assigned_date > today),
  }
}

/**
 * 전체 체크리스트 조회 (타임라인용)
 * 날짜별 그룹핑은 프론트에서 처리
 * @param moveId - 이사 ID
 * @param userId - 소유자 ID (user_id 필터)
 */
export async function getTimelineItems(
  moveId: string,
  userId: string,
): Promise<ChecklistItemWithMaster[]> {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select<string, ChecklistItemWithMaster>(LIST_SELECT)
    .eq('move_id', moveId)
    .eq('user_id', userId)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getTimelineItems] ${error.message}`)
  return data ?? []
}

/**
 * 체크리스트 항목 완료/미완료 토글
 * @param itemId - 체크리스트 항목 ID
 * @param moveId - 이사 ID (방어적 스코프)
 * @param userId - 소유자 ID (user_id 필터)
 * @param isCompleted - 완료 여부
 */
export async function toggleChecklistItem(
  itemId: string,
  moveId: string,
  userId: string,
  isCompleted: boolean,
): Promise<Tables<'user_checklist_items'>> {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .update({
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date().toISOString() : null,
    })
    .eq('id', itemId)
    .eq('move_id', moveId)
    .eq('user_id', userId)
    .select()
    .single()

  if (error) throw new Error(`[toggleChecklistItem] ${error.message}`)
  return data
}

/**
 * 밀린 항목 조회 (assigned_date < 오늘 AND 미완료)
 * master_checklist_items와 JOIN해서 title, category 포함
 * @param moveId - 이사 ID
 * @param userId - 소유자 ID (user_id 필터)
 * @returns 밀린 항목 리스트
 */
export async function getOverdueItems(moveId: string, userId: string): Promise<OverdueItem[]> {
  const today = format(new Date(), 'yyyy-MM-dd')

  const { data, error } = await supabase
    .from('user_checklist_items')
    .select('id, assigned_date, master_item:master_checklist_items(title, category)')
    .eq('move_id', moveId)
    .eq('user_id', userId)
    .lt('assigned_date', today)
    .eq('is_completed', false)
    .order('assigned_date', { ascending: true })

  if (error) throw new Error(`[getOverdueItems] ${error.message}`)
  return (data ?? []) as unknown as OverdueItem[]
}

/**
 * 체크리스트 항목 상세 조회
 * user_checklist_items + master_checklist_items JOIN
 * @param itemId - user_checklist_items PK (UUID)
 * @param userId - 소유자 ID (user_id 필터)
 * @returns 유저 항목 + 마스터 가이드 통합 데이터. 없으면 throw
 */
export async function getChecklistItemDetail(itemId: string, userId: string) {
  const { data, error } = await supabase
    .from('user_checklist_items')
    .select(
      `*, master_checklist_items (
        title, description, guide_content, guide_steps, guide_items, guide_note,
        guide_url, guide_type, category, d_day_offset,
        housing_types, contract_types, move_types
      )`,
    )
    .eq('id', itemId)
    .eq('user_id', userId)
    .single()

  if (error) throw new Error(`[getChecklistItemDetail] ${error.message}`)
  return data
}

/**
 * 메모 업데이트 (단일 필드 — RPC 불필요)
 * @param itemId - user_checklist_items PK
 * @param userId - 소유자 ID (user_id 필터)
 * @param memo - 저장할 메모 (빈 문자열 허용)
 */
export async function updateItemMemo(itemId: string, userId: string, memo: string): Promise<void> {
  const { error } = await supabase
    .from('user_checklist_items')
    .update({ memo, updated_at: new Date().toISOString() })
    .eq('id', itemId)
    .eq('user_id', userId)

  if (error) throw new Error(`[updateItemMemo] ${error.message}`)
}

/**
 * 체크리스트 항목 일괄 완료 처리
 * @param itemIds - 완료 처리할 항목 ID 배열
 * @param userId - 소유자 ID (user_id 필터)
 */
export async function batchCompleteItems(itemIds: string[], userId: string): Promise<void> {
  if (itemIds.length === 0) return

  const { error } = await supabase
    .from('user_checklist_items')
    .update({ is_completed: true, completed_at: new Date().toISOString() })
    .in('id', itemIds)
    .eq('user_id', userId)

  if (error) throw new Error(`[batchCompleteItems] ${error.message}`)
}
