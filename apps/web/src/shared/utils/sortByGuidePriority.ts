const GUIDE_PRIORITY: Record<string, number> = {
  critical: 0,
  warning: 1,
  tip: 2,
}

/**
 * guide_type 우선순위 정렬 (critical > warning > tip), 동순위는 assigned_date 오름차순
 */
export function sortByGuidePriority(items: Record<string, unknown>[]): Record<string, unknown>[] {
  return [...items].sort((a, b) => {
    const masterA = a.master_checklist_items as Record<string, unknown> | null
    const masterB = b.master_checklist_items as Record<string, unknown> | null
    const pDiff =
      (GUIDE_PRIORITY[masterA?.guide_type as string] ?? 3) -
      (GUIDE_PRIORITY[masterB?.guide_type as string] ?? 3)
    if (pDiff !== 0) return pDiff
    return (a.assigned_date as string).localeCompare(b.assigned_date as string)
  })
}
