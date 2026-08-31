import { create } from 'zustand';
import type { RegisterField } from '../features/auth/schemas/authSchemas';

// Values typed across the steps of the signup wizard. Each step is its own route,
// so the draft lives outside the screens and survives going back and forth.
// It is kept in memory only: nothing here reaches the device storage.
const EMPTY_DRAFT: Record<RegisterField, string> = {
  fullName: '',
  email: '',
  handle: '',
  password: '',
};

type RegisterDraftState = {
  values: Record<RegisterField, string>;
  setValue: (field: RegisterField, value: string) => void;
  reset: () => void;
};

export const useRegisterDraft = create<RegisterDraftState>((set) => ({
  values: EMPTY_DRAFT,
  setValue: (field, value) => set((state) => ({ values: { ...state.values, [field]: value } })),
  reset: () => set({ values: EMPTY_DRAFT }),
}));
