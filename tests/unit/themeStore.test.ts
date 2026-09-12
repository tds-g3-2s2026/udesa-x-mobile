import * as SecureStore from 'expo-secure-store';
import { useThemeStore } from '../../src/stores/themeStore';

// Same in-memory SecureStore double as authStore.test.ts: the factory owns the
// map because jest.mock cannot reference variables from the module scope.
jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    values,
    setItemAsync: jest.fn((key: string, value: string) => {
      values.set(key, value);
      return Promise.resolve();
    }),
    getItemAsync: jest.fn((key: string) => Promise.resolve(values.get(key) ?? null)),
    deleteItemAsync: jest.fn((key: string) => {
      values.delete(key);
      return Promise.resolve();
    }),
  };
});

const THEME_KEY = 'udesa_x_theme';

const secureStoreMock = SecureStore as unknown as { values: Map<string, string> };
const secureStoreValues = secureStoreMock.values;

describe('Theme store', () => {
  beforeEach(() => {
    secureStoreValues.clear();
    jest.clearAllMocks();
    useThemeStore.setState({ theme: 'light', isInitialized: false });
  });

  it('E1-H10.CA1 - defaults to light and marks itself initialized when nothing was ever saved', async () => {
    await useThemeStore.getState().restoreTheme();

    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().isInitialized).toBe(true);
  });

  it('E1-H10.CA1 - restores a previously saved preference from the device', async () => {
    secureStoreValues.set(THEME_KEY, 'dark');

    await useThemeStore.getState().restoreTheme();

    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('E1-H10.CA1 - setTheme updates the state and persists it locally, nowhere else', async () => {
    await useThemeStore.getState().setTheme('dark');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(secureStoreValues.get(THEME_KEY)).toBe('dark');
  });

  it('falls back to the light default if the stored value is not a valid theme', async () => {
    secureStoreValues.set(THEME_KEY, 'sepia');

    await useThemeStore.getState().restoreTheme();

    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().isInitialized).toBe(true);
  });

  it('still marks itself initialized if reading the stored preference fails', async () => {
    jest.spyOn(SecureStore, 'getItemAsync').mockRejectedValueOnce(new Error('unavailable'));

    await useThemeStore.getState().restoreTheme();

    expect(useThemeStore.getState().theme).toBe('light');
    expect(useThemeStore.getState().isInitialized).toBe(true);
  });
});
