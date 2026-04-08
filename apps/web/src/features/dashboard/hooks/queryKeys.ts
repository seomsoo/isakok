export const queryKeys = {
  currentMove: ['move', 'current'] as const,
  todayItems: (moveId: string) => ['checklist', 'today', moveId] as const,
  timelineItems: (moveId: string) => ['checklist', 'timeline', moveId] as const,
}
