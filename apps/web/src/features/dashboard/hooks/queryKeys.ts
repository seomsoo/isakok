export const queryKeys = {
  currentMove: ['move', 'current'] as const,
  checklistAll: ['checklist'] as const,
  todayItems: (moveId: string) => ['checklist', 'today', moveId] as const,
  timelineItems: (moveId: string) => ['checklist', 'timeline', moveId] as const,
  itemDetail: (itemId: string) => ['checklist', 'detail', itemId] as const,
  overdueItems: (moveId: string) => ['checklist', 'overdue', moveId] as const,
}
