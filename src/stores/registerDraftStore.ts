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
  // Kept outside `values` because it is a checkbox, not a form field with
  // its own wizard step or entry in registerSchema.
  termsAccepted: boolean;
  setValue: (field: RegisterField, value: string) => void;
  setTermsAccepted: (accepted: boolean) => void;
  reset: () => void;
};

export const useRegisterDraft = create<RegisterDraftState>((set) => ({
  values: EMPTY_DRAFT,
  termsAccepted: false,
  setValue: (field, value) => set((state) => ({ values: { ...state.values, [field]: value } })),
  setTermsAccepted: (accepted) => set({ termsAccepted: accepted }),
  reset: () => set({ values: EMPTY_DRAFT, termsAccepted: false }),
}));
