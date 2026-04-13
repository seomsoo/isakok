import { create } from 'zustand'
import type { UrgencyMode } from '@moving/shared'

interface ModeStore {
  previousMode: UrgencyMode | null
  setPreviousMode: (mode: UrgencyMode) => void
  transitionDismissed: boolean
  dismissTransition: () => void
  resetTransition: () => void
}

export const useModeStore = create<ModeStore>((set) => ({
  previousMode: null,
  setPreviousMode: (mode) => set({ previousMode: mode, transitionDismissed: false }),
  transitionDismissed: false,
  dismissTransition: () => set({ transitionDismissed: true }),
  resetTransition: () => set({ transitionDismissed: false }),
}))
