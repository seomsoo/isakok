import { create } from 'zustand'

interface MoveStore {
  currentMoveId: string | null
  setCurrentMoveId: (id: string) => void
  clear: () => void
}

export const useMoveStore = create<MoveStore>((set) => ({
  currentMoveId: null,
  setCurrentMoveId: (id) => set({ currentMoveId: id }),
  clear: () => set({ currentMoveId: null }),
}))
