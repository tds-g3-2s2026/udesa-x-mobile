import { useThemeStore } from '../stores/themeStore';
import { Colors, palettes } from './colors';

// The single read path every screen uses for colors: subscribing through the
// store, instead of reading a static export, is what lets a screen switch
// theme instantly — it re-renders with the new palette the moment the
// preference changes, with no reload needed.
export function useThemeColors(): Colors {
  const theme = useThemeStore((state) => state.theme);
  return palettes[theme];
}
