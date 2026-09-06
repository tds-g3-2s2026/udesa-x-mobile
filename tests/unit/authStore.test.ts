import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/stores/authStore';
import { User } from '../../src/types/auth';

// In-memory SecureStore double: lets the tests check what the app really persists
// and what survives a logout, instead of asserting on hardcoded values.
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

const REFRESH_TOKEN_KEY = 'udesa_x_refresh_token';
const ACCESS_TOKEN_KEY = 'udesa_x_access_token';
const USER_KEY = 'udesa_x_user';

// The mock factory above exports its backing map; the real module type cannot express it.
const secureStoreMock = SecureStore as unknown as { values: Map<string, string> };
const secureStoreValues = secureStoreMock.values;

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  fullName: 'Joaquín León',
  isVerified: true,
};

const tokens = {
  accessToken: 'access-token-xyz',
  refreshToken: 'refresh-token-abc',
};

describe('Auth store', () => {
  beforeEach(() => {
    secureStoreValues.clear();
    jest.clearAllMocks();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      isInitialized: false,
    });
  });

  describe('E1-H2. Inicio de Sesión', () => {
    it('E1-H2.CA1 - setSession keeps the access token in state and persists the session securely', async () => {
      await useAuthStore.getState().setSession(user, tokens);

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.accessToken).toBe(tokens.accessToken);
      expect(state.refreshToken).toBe(tokens.refreshToken);
      expect(state.isInitialized).toBe(true);

      expect(secureStoreValues.get(ACCESS_TOKEN_KEY)).toBe(tokens.accessToken);
      expect(secureStoreValues.get(REFRESH_TOKEN_KEY)).toBe(tokens.refreshToken);
      expect(secureStoreValues.get(USER_KEY)).toBe(JSON.stringify(user));
    });

    it('E1-H2.CA1 - restoreSession brings back the session that was persisted', async () => {
      await useAuthStore.getState().setSession(user, tokens);
      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isInitialized: false,
      });

      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.user).toEqual(user);
      expect(state.accessToken).toBe(tokens.accessToken);
      expect(state.refreshToken).toBe(tokens.refreshToken);
      expect(state.isInitialized).toBe(true);
    });

    it('E1-H2.CA1 - restoreSession leaves no session when the secure storage is empty', async () => {
      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it('E1-H2.CA1 - restoreSession discards stored data that is not a valid session', async () => {
      secureStoreValues.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
      secureStoreValues.set(ACCESS_TOKEN_KEY, tokens.accessToken);
      secureStoreValues.set(USER_KEY, '{"id":"usr-1"}');

      await useAuthStore.getState().restoreSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('E1-H3. Cierre de Sesión', () => {
    it('E1-H3.CA2 - clearSession wipes the session state and the stored tokens', async () => {
      await useAuthStore.getState().setSession(user, tokens);

      await useAuthStore.getState().clearSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.isInitialized).toBe(true);

      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(ACCESS_TOKEN_KEY);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(REFRESH_TOKEN_KEY);
      expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith(USER_KEY);
      expect(secureStoreValues.size).toBe(0);
    });

    it('E1-H3.CA2 - after clearSession there is nothing left to restore', async () => {
      await useAuthStore.getState().setSession(user, tokens);
      await useAuthStore.getState().clearSession();

      await useAuthStore.getState().restoreSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('E1-H6. Editar mi perfil', () => {
    it('E1-H6.CA6 - setProfile merges a profile response into the session and persists it', async () => {
      await useAuthStore.getState().setSession(user, tokens);

      await useAuthStore.getState().setProfile({
        id: user.id,
        email: user.email,
        handle: user.handle,
        displayName: 'Joaquín',
        bio: 'Estudiante',
      });

      const state = useAuthStore.getState();
      expect(state.user?.displayName).toBe('Joaquín');
      expect(state.user?.bio).toBe('Estudiante');
      // Everything else about the session is untouched.
      expect(state.user?.fullName).toBe(user.fullName);
      expect(state.user?.isVerified).toBe(user.isVerified);

      const stored = JSON.parse(secureStoreValues.get(USER_KEY) ?? '{}');
      expect(stored.displayName).toBe('Joaquín');
    });

    it('E1-H6 - does nothing if the session ended before the response came back', async () => {
      await useAuthStore.getState().setProfile({
        id: 'usr-1',
        email: 'jleon@udesa.edu.ar',
        handle: '@joaquin_dev',
        displayName: 'Joaquín',
        bio: null,
      });

      expect(useAuthStore.getState().user).toBeNull();
    });
  });

  describe('T-52. Refresco de token', () => {
    const renewed = {
      accessToken: 'access-token-renewed',
      refreshToken: 'refresh-token-renewed',
    };

    it('T-52 - setTokens replaces both tokens and leaves the user signed in', async () => {
      await useAuthStore.getState().setSession(user, tokens);

      await useAuthStore.getState().setTokens(renewed);

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(renewed.accessToken);
      expect(state.refreshToken).toBe(renewed.refreshToken);
      expect(state.user).toEqual(user);
    });

    it('T-52 - the renewed tokens are the ones restored on the next launch', async () => {
      await useAuthStore.getState().setSession(user, tokens);
      await useAuthStore.getState().setTokens(renewed);

      useAuthStore.setState({
        user: null,
        accessToken: null,
        refreshToken: null,
        isInitialized: false,
      });
      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(renewed.accessToken);
      expect(state.refreshToken).toBe(renewed.refreshToken);
      expect(state.user).toEqual(user);
    });
  });
});
