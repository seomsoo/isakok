import { create } from 'zustand'

interface AiGuideState {
  triggeredKeys: Record<string, boolean>
  markTriggered: (key: string) => void
  hasTriggered: (key: string) => boolean
}

export const useAiGuideStore = create<AiGuideState>((set, get) => ({
  triggeredKeys: {},
  markTriggered: (key) =>
    set((s) => ({
      triggeredKeys: { ...s.triggeredKeys, [key]: true },
    })),
  hasTriggered: (key) => !!get().triggeredKeys[key],
}))
