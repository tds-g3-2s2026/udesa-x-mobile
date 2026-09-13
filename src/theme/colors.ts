export type ThemeName = 'light' | 'dark';

export interface Colors {
  primary: string;
  primarySoft: string;
  onPrimary: string;
  surface: string;
  text: string;
  muted: string;
  placeholder: string;
  border: string;
  field: string;
  divider: string;
  danger: string;
  dangerSoft: string;
}

const light: Colors = {
  primary: '#1D9BF0',
  primarySoft: '#E8F5FD',
  onPrimary: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F1419',
  muted: '#536471',
  placeholder: '#8B98A5',
  border: '#CFD9DE',
  field: '#F7F9F9',
  divider: '#EFF3F4',
  danger: '#F4212E',
  dangerSoft: '#FFF5F5',
};

// Same brand blue and red as light: only the neutrals invert, so the app
// reads as the same product and not a different skin.
const dark: Colors = {
  primary: '#1D9BF0',
  primarySoft: '#0D2B3D',
  onPrimary: '#FFFFFF',
  surface: '#15202B',
  text: '#E7E9EA',
  muted: '#8B98A5',
  placeholder: '#5B7083',
  border: '#38444D',
  field: '#192734',
  divider: '#38444D',
  danger: '#F4212E',
  dangerSoft: '#3D1116',
};

export const palettes: Record<ThemeName, Colors> = { light, dark };
