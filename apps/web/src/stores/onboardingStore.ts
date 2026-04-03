import { create } from 'zustand'
import type { HousingType, ContractType, MoveType } from '@shared/types/move'

interface OnboardingState {
  step: number
  movingDate: string | null
  housingType: HousingType | null
  contractType: ContractType | null
  moveType: MoveType | null

  setStep: (step: number) => void
  setMovingDate: (date: string) => void
  setHousingType: (type: HousingType) => void
  setContractType: (type: ContractType) => void
  setMoveType: (type: MoveType) => void
  reset: () => void
}

const initialState = {
  step: 1,
  movingDate: null,
  housingType: null,
  contractType: null,
  moveType: null,
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setStep: (step) => set({ step }),
  setMovingDate: (date) => set({ movingDate: date }),
  setHousingType: (type) => set({ housingType: type }),
  setContractType: (type) => set({ contractType: type }),
  setMoveType: (type) => set({ moveType: type }),
  reset: () => set(initialState),
}))
