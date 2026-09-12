import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { ThemeName } from '../theme/colors';

const THEME_KEY = 'udesa_x_theme';

interface ThemeState {
  theme: ThemeName;
  // False until the stored preference was read: the root layout waits for
  // this before drawing anything, the same as it does for the session.
  isInitialized: boolean;
  setTheme: (theme: ThemeName) => Promise<void>;
  restoreTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set) => ({
  theme: 'light',
  isInitialized: false,

  // This preference is device-local only, never sent to the API.
  setTheme: async (theme) => {
    set({ theme });
    try {
      await SecureStore.setItemAsync(THEME_KEY, theme);
    } catch {
      // Best effort, same as the session: the in-memory theme still applies
      // for the rest of this run even if it can't be remembered next time.
    }
  },

  restoreTheme: async () => {
    try {
      const stored = await SecureStore.getItemAsync(THEME_KEY);
      if (stored === 'light' || stored === 'dark') {
        set({ theme: stored, isInitialized: true });
        return;
      }
    } catch {
      // An unreadable store means there is no usable preference: falls back
      // to the light default below, same as a device that never set one.
    }
    set({ isInitialized: true });
  },
}));
