import { act, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/stores/authStore';
import { User } from '../../src/types/auth';

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

// The mock factory above exports its backing map; the real module type cannot express it.
const secureStoreMock = SecureStore as unknown as { values: Map<string, string> };
const secureStoreValues = secureStoreMock.values;

const LOGIN_SUBTITLE = 'Conectate con tu comunidad universitaria';
// The feed is the landing tab of the protected group, so its empty state is the
// marker that the authenticated area got mounted.
const FEED_EMPTY_TITLE = 'Todavía no hay publicaciones';
const LOGOUT_LABEL = 'Cerrar Sesión';

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  fullName: 'Joaquín León',
  isVerified: true,
};

function persistSession(): void {
  secureStoreValues.set('udesa_x_access_token', 'jwt-access-token');
  secureStoreValues.set('udesa_x_refresh_token', 'jwt-refresh-token');
  secureStoreValues.set('udesa_x_user', JSON.stringify(user));
}

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

// The root layout mounts one navigation group or the other with Stack.Protected.
// These tests pin that contract: the group the session does not allow is never
// mounted, which is what used to show the feed for a frame before redirecting.
describe('Navigation guards', () => {
  it('starts on the login when the device has no stored session', async () => {
    renderRouter('app', { initialUrl: '/' });

    await waitFor(() => expect(useAuthStore.getState().isInitialized).toBe(true));

    expect(await screen.findByText(LOGIN_SUBTITLE)).toBeTruthy();
    expect(screen.queryByText(LOGOUT_LABEL)).toBeNull();
  });

  it('starts on the authenticated area when the session was persisted', async () => {
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    await waitFor(() => expect(useAuthStore.getState().isInitialized).toBe(true));

    expect(await screen.findByText(FEED_EMPTY_TITLE)).toBeTruthy();
    expect(screen.queryByText(LOGIN_SUBTITLE)).toBeNull();
  });

  it('sends the user back to the public group after clearing the session', async () => {
    persistSession();

    renderRouter('app', { initialUrl: '/profile' });
    expect(await screen.findByText(LOGOUT_LABEL)).toBeTruthy();

    await act(async () => {
      await useAuthStore.getState().clearSession();
    });

    expect(await screen.findByText(LOGIN_SUBTITLE)).toBeTruthy();
    expect(secureStoreValues.size).toBe(0);
  });
});
