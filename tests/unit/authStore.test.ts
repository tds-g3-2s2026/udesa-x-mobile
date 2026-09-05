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

  describe('Sign in', () => {
    it('keeps the access token in state and persists the session securely', async () => {
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

    it('restores the persisted session', async () => {
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

    it('leaves no session when secure storage is empty', async () => {
      await useAuthStore.getState().restoreSession();

      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.accessToken).toBeNull();
      expect(state.isInitialized).toBe(true);
    });

    it('discards stored data that is not a valid session', async () => {
      secureStoreValues.set(REFRESH_TOKEN_KEY, tokens.refreshToken);
      secureStoreValues.set(ACCESS_TOKEN_KEY, tokens.accessToken);
      secureStoreValues.set(USER_KEY, '{"id":"usr-1"}');

      await useAuthStore.getState().restoreSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('Sign out', () => {
    it('wipes the session state and stored tokens', async () => {
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

    it('leaves nothing to restore after clearing the session', async () => {
      await useAuthStore.getState().setSession(user, tokens);
      await useAuthStore.getState().clearSession();

      await useAuthStore.getState().restoreSession();

      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().accessToken).toBeNull();
    });
  });

  describe('Token refresh', () => {
    const renewed = {
      accessToken: 'access-token-renewed',
      refreshToken: 'refresh-token-renewed',
    };

    it('replaces both tokens and leaves the user signed in', async () => {
      await useAuthStore.getState().setSession(user, tokens);

      await useAuthStore.getState().setTokens(renewed);

      const state = useAuthStore.getState();
      expect(state.accessToken).toBe(renewed.accessToken);
      expect(state.refreshToken).toBe(renewed.refreshToken);
      expect(state.user).toEqual(user);
    });

    it('restores renewed tokens on the next launch', async () => {
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
