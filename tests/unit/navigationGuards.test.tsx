import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../../src/features/auth/services/authService';
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
describe('Guardas de navegación', () => {
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

  it('E1-H3.CA2 - clearing the session sends the user back to the public group', async () => {
    persistSession();

    renderRouter('app', { initialUrl: '/profile' });
    expect(await screen.findByText(LOGOUT_LABEL)).toBeTruthy();

    await act(async () => {
      await useAuthStore.getState().clearSession();
    });

    expect(await screen.findByText(LOGIN_SUBTITLE)).toBeTruthy();
    expect(secureStoreValues.size).toBe(0);
  });

  it('lands on the feed and not on a hidden stack screen when the session is already there', async () => {
    persistSession();

    // No sub-path, same as a real login: Stack.Protected swaps from (auth) to
    // (app) without navigating to any particular screen inside it.
    //
    // Does NOT actually guard the bug that motivated it: change-password and
    // edit-profile once lived as Tabs.Screen entries ordered before index,
    // which briefly made one of them the tab bar's default landing screen
    // instead of the feed. Confirmed by hand that this exact test still
    // passes even with that ordering reintroduced — renderRouter resolves a
    // group path like this one by static file convention, not by asking the
    // real navigator which child it would land on. Kept anyway because the
    // assertion is still a correct, worthwhile one; the actual protection
    // against that class of bug is architectural now (change-password and
    // edit-profile physically cannot be Tabs.Screen entries anymore).
    renderRouter('app', { initialUrl: '/(app)' });

    expect(await screen.findByText(FEED_EMPTY_TITLE)).toBeTruthy();
    expect(screen.queryByText('Cambiar contraseña')).toBeNull();
  });

  it('returns to the profile, not to change-password, after saving an edit to the profile', async () => {
    persistSession();
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: user.email,
      handle: user.handle,
      displayName: 'Joaco',
      bio: '',
    });
    jest.spyOn(authService, 'updateProfile').mockResolvedValue({
      id: 'usr-1',
      email: user.email,
      handle: user.handle,
      displayName: 'Joaco Nuevo',
      bio: '',
    });

    // change-password and edit-profile used to be Tabs.Screen entries, siblings
    // of Perfil inside the same Tabs navigator. Tabs do not share one linear
    // back history between siblings the way a Stack does, so router.back()
    // after pushing from Perfil into one of them did not reliably return to
    // Perfil. They are now Stack screens one level up for exactly this reason.
    renderRouter('app', { initialUrl: '/profile' });
    await screen.findByText('Editar perfil');

    await act(async () => {
      fireEvent.press(screen.getByText('Editar perfil'));
    });
    await screen.findByDisplayValue('Joaco');

    await act(async () => {
      fireEvent.press(screen.getByText('Guardar cambios'));
    });

    await waitFor(() => expect(useAuthStore.getState().user?.displayName).toBe('Joaco Nuevo'));
    expect(await screen.findByText(LOGOUT_LABEL)).toBeTruthy();
    expect(screen.queryByText('Guardar contraseña')).toBeNull();
  });
});
