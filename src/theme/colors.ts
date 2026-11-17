export type ThemeName = 'light' | 'dark';

export interface Colors {
  // Text, icons and borders drawn on surface or field.
  primary: string;
  // Background of a control whose label is onPrimary (a filled button, a
  // selected chip). Separate from primary because no single blue reads at
  // 4.5:1 both on the dark surface and under white text.
  primaryFill: string;
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

// Every text pair here reaches WCAG AA (4.5:1); tests/unit/themeContrast.test.ts
// checks it. The blue and the red keep the hue of the brand #1D9BF0 and
// #F4212E, only darker, since those two read at 3.0:1 and 4.1:1 on white.
const light: Colors = {
  primary: '#0B72B6',
  primaryFill: '#0B72B6',
  primarySoft: '#E8F5FD',
  onPrimary: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F1419',
  muted: '#536471',
  placeholder: '#8B98A5',
  border: '#CFD9DE',
  field: '#F7F9F9',
  divider: '#EFF3F4',
  danger: '#E30B19',
  dangerSoft: '#FFF5F5',
};

// The brand blue already reads on the dark neutrals, so it stays as text; the
// filled controls take the darker blue of light, the only one white reads on.
// The red goes lighter instead, to read on the dark surface.
const dark: Colors = {
  primary: '#1D9BF0',
  primaryFill: '#0B72B6',
  primarySoft: '#0D2B3D',
  onPrimary: '#FFFFFF',
  surface: '#15202B',
  text: '#E7E9EA',
  muted: '#8B98A5',
  placeholder: '#5B7083',
  border: '#38444D',
  field: '#192734',
  divider: '#38444D',
  danger: '#F6525C',
  dangerSoft: '#3D1116',
};

export const palettes: Record<ThemeName, Colors> = { light, dark };
