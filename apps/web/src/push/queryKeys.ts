export const pushKeys = {
  enabled: (userId: string | null) => ['push', 'enabled', userId] as const,
  prompt: (userId: string | null) => ['push', 'prompt', userId] as const,
}
