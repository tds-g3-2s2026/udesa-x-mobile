import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { z } from 'zod';
import { User, AuthTokens } from '../types/auth';

const REFRESH_TOKEN_KEY = 'udesa_x_refresh_token';
const ACCESS_TOKEN_KEY = 'udesa_x_access_token';
const USER_KEY = 'udesa_x_user';

// Shape validated when reading the session back from the device storage:
// anything else is treated as no session instead of trusting stale data.
const storedUserSchema = z.object({
  id: z.string().min(1),
  handle: z.string().min(1),
  email: z.string().min(1),
  fullName: z.string().min(1),
  isVerified: z.boolean(),
  avatarUrl: z.string().optional(),
});

function parseStoredUser(raw: string | null): User | null {
  if (!raw) return null;
  const parsed = storedUserSchema.safeParse(JSON.parse(raw) as unknown);
  return parsed.success ? parsed.data : null;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  // False until the stored session was read: the root layout waits for this
  // before deciding which navigation group to mount.
  isInitialized: boolean;
  setSession: (user: User, tokens: AuthTokens) => Promise<void>;
  clearSession: () => Promise<void>;
  restoreSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: null,
  isInitialized: false,

  setSession: async (user, tokens) => {
    try {
      await Promise.all([
        SecureStore.setItemAsync(REFRESH_TOKEN_KEY, tokens.refreshToken),
        SecureStore.setItemAsync(ACCESS_TOKEN_KEY, tokens.accessToken),
        SecureStore.setItemAsync(USER_KEY, JSON.stringify(user)),
      ]);
    } catch {
      // Persisting is best effort: SecureStore is unavailable on web. A failure only
      // costs the "stay signed in" feature, so the in-memory session still applies.
    }
    set({ user, accessToken: tokens.accessToken, isInitialized: true });
  },

  // E1-H3.CA2: local session data and the JWT are removed from secure storage.
  // A deletion failure is propagated because leaving credentials on the device
  // is a security problem the user has to know about.
  clearSession: async () => {
    try {
      await Promise.all([
        SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.deleteItemAsync(USER_KEY),
      ]);
    } finally {
      set({ user: null, accessToken: null, isInitialized: true });
    }
  },

  restoreSession: async () => {
    try {
      const [refreshToken, accessToken, storedUser] = await Promise.all([
        SecureStore.getItemAsync(REFRESH_TOKEN_KEY),
        SecureStore.getItemAsync(ACCESS_TOKEN_KEY),
        SecureStore.getItemAsync(USER_KEY),
      ]);
      const user = parseStoredUser(storedUser);
      if (refreshToken && accessToken && user) {
        set({ user, accessToken, isInitialized: true });
        return;
      }
    } catch {
      // An unreadable store means there is no usable session: the user signs in again.
    }
    set({ user: null, accessToken: null, isInitialized: true });
  },
}));
