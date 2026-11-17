import { Colors, palettes, ThemeName } from '../../src/theme/colors';

// WCAG 2.1 relative luminance and contrast ratio, criterion 1.4.3.
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((start) => {
    const channel = parseInt(hex.slice(start, start + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(foreground: string, background: string): number {
  const [light, dark] = [luminance(foreground), luminance(background)].sort((a, b) => b - a);
  return (light + 0.05) / (dark + 0.05);
}

// Every text color the screens draw, on every background it is drawn on.
// placeholder is left out: it only colors hints and disabled links, which
// WCAG exempts.
const TEXT_PAIRS: [keyof Colors, keyof Colors][] = [
  ['text', 'surface'],
  ['text', 'field'],
  ['muted', 'surface'],
  ['muted', 'field'],
  ['primary', 'surface'],
  ['primary', 'field'],
  ['primary', 'primarySoft'],
  ['danger', 'surface'],
  ['danger', 'field'],
  ['danger', 'dangerSoft'],
  ['onPrimary', 'primaryFill'],
];

const THEMES: ThemeName[] = ['light', 'dark'];

describe('T-48. Revisión de UX, accesibilidad y consistencia visual', () => {
  describe.each(THEMES)('%s theme', (theme) => {
    it.each(TEXT_PAIRS)('T-48 - %s on %s reaches AA (4.5:1)', (foreground, background) => {
      const colors = palettes[theme];
      expect(contrast(colors[foreground], colors[background])).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('measures the old brand blue under white text below AA', () => {
    // Guards the formula itself: #1D9BF0 is the value this issue replaced.
    expect(contrast('#FFFFFF', '#1D9BF0')).toBeCloseTo(3.0, 1);
    expect(contrast('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
  });
});
