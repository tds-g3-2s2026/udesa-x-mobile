import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { Alert } from 'react-native';
import { ApiError } from '../../src/api/apiClient';
import { authService } from '../../src/features/auth/services/authService';
import { notificationService } from '../../src/features/notifications/notificationService';
import { postService } from '../../src/features/posts/services/postService';
import { searchQueryClient } from '../../src/features/search/queryClient';
import * as searchService from '../../src/features/search/searchService';
import { followService } from '../../src/features/social/services/followService';
import { useAuthStore } from '../../src/stores/authStore';
import { User } from '../../src/types/auth';
import { SuggestedAccount } from '../../src/types/post';

// Same in-memory SecureStore double as the other route tests: the factory owns the
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
const secureStoreValues = (SecureStore as unknown as { values: Map<string, string> }).values;

// A session stored before onboarding existed: it has no flag at all.
const userFromBefore: User = {
  id: 'usr-1',
  handle: '@nuevo',
  email: 'nuevo@udesa.edu.ar',
  isVerified: true,
};
const newUser: User = { ...userFromBefore, onboardingCompleted: false };

function account(index: number): SuggestedAccount {
  return {
    id: `usr-${index + 10}`,
    handle: `@popular${index}`,
    displayName: null,
    avatarUrl: null,
    followersCount: 100 - index,
  };
}

const FEED_EMPTY = 'Todavía no hay publicaciones';

function persistSession(session: User): void {
  secureStoreValues.set('udesa_x_access_token', 'jwt-access-token');
  secureStoreValues.set('udesa_x_refresh_token', 'jwt-refresh-token');
  secureStoreValues.set('udesa_x_user', JSON.stringify(session));
}

// The whole route tree, starting where a signed-in app starts: the root layout
// restores the session and decides between the onboarding and the feed.
async function openApp(): Promise<void> {
  renderRouter('app', { initialUrl: '/' });
  await waitFor(() => expect(useAuthStore.getState().isInitialized).toBe(true));
}

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
}

async function chooseInterests(labels: string[]) {
  for (const label of labels) await press(label);
}

const saveInterests = jest.spyOn(authService, 'saveInterests');
const completeOnboarding = jest.spyOn(authService, 'completeOnboarding');
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

beforeEach(() => {
  searchQueryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  searchQueryClient.clear();
  secureStoreValues.clear();
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isInitialized: false,
  });
  // The feed and the other tabs load on mount; nothing here is about them.
  jest.spyOn(searchService, 'search').mockResolvedValue({ items: [], nextCursor: null });
  jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
  jest.spyOn(notificationService, 'list').mockResolvedValue({ items: [], nextCursor: null });
  jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue([0, 1, 2, 3, 4].map(account));
  saveInterests.mockReset().mockResolvedValue(undefined);
  completeOnboarding.mockReset().mockResolvedValue(undefined);
});

describe('E1-H14. Onboarding Inicial', () => {
  it('E1-H14.CA1 - shows the carousel before the first feed', async () => {
    persistSession(newUser);

    await openApp();

    expect(await screen.findByText('Bienvenido a UdeSA-X')).toBeTruthy();
    expect(screen.getByText('Publicá lo que pasa')).toBeTruthy();
    expect(screen.queryByText(FEED_EMPTY)).toBeNull();
  });

  it('E1-H14.CA1 - does not show it again once finished', async () => {
    persistSession(newUser);
    await openApp();
    await screen.findByText('Bienvenido a UdeSA-X');

    // Through the whole carousel, page by page.
    await press('Siguiente');
    await press('Siguiente');
    await press('Empezar');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');
    await screen.findByText('@popular0');
    await press('Ir al inicio');

    expect(await screen.findByText(FEED_EMPTY)).toBeTruthy();
    expect(completeOnboarding).toHaveBeenCalledTimes(1);

    // The next app start goes straight to the feed.
    screen.unmount();
    useAuthStore.setState({ user: null, isInitialized: false });
    await openApp();
    expect(await screen.findByText(FEED_EMPTY)).toBeTruthy();
    expect(screen.queryByText('Bienvenido a UdeSA-X')).toBeNull();
  });

  it('E1-H14.CA1 - the carousel follows a swipe to its last page', async () => {
    persistSession(newUser);
    await openApp();
    const carousel = await screen.findByTestId('onboarding-carousel');

    await act(async () => {
      fireEvent(carousel, 'layout', { nativeEvent: { layout: { width: 300 } } });
    });
    await act(async () => {
      fireEvent(carousel, 'momentumScrollEnd', { nativeEvent: { contentOffset: { x: 600 } } });
    });

    expect(screen.getByRole('button', { name: 'Empezar' })).toBeTruthy();
    expect(screen.queryByText('Saltear')).toBeNull();
  });

  it('E1-H14.CA1 - an account from before the onboarding goes straight to the feed', async () => {
    persistSession(userFromBefore);

    await openApp();

    expect(await screen.findByText(FEED_EMPTY)).toBeTruthy();
    expect(screen.queryByText('Bienvenido a UdeSA-X')).toBeNull();
  });

  it('E1-H14.CA1 - the carousel can be skipped, the interests cannot', async () => {
    persistSession(newUser);
    await openApp();
    await screen.findByText('Bienvenido a UdeSA-X');

    await act(async () => {
      fireEvent.press(screen.getByText('Saltear'));
    });

    expect(await screen.findByText('¿Qué te interesa?')).toBeTruthy();
    expect(screen.queryByText('Saltear')).toBeNull();
  });

  it('E1-H14.CA2 - asks for at least 3 interests and saves them in the order chosen', async () => {
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');

    await chooseInterests(['Tecnología', 'Política']);
    expect(
      screen.getByRole('button', { name: 'Continuar' }).props.accessibilityState
    ).toMatchObject({ disabled: true });
    expect(screen.getByText('2 elegidos')).toBeTruthy();

    // Tapping one again takes it back out.
    await chooseInterests(['Política', 'Música', 'Economía']);
    expect(screen.getByText('3 elegidos')).toBeTruthy();
    await press('Continuar');

    expect(saveInterests).toHaveBeenCalledWith(['technology', 'music', 'economy']);
    expect(await screen.findByText('Cuentas para seguir')).toBeTruthy();
  });

  it('E1-H14.CA2 - a failed save stays on the interests and says why', async () => {
    saveInterests.mockRejectedValueOnce(new ApiError('Sin conexión.'));
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');

    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');

    expect(alert).toHaveBeenCalledWith('Error', 'Sin conexión.');
    expect(screen.getByText('¿Qué te interesa?')).toBeTruthy();
  });

  it('E1-H14.CA3 - suggests at least 5 popular accounts and follows one with a single tap', async () => {
    const follow = jest.spyOn(followService, 'follow').mockResolvedValueOnce('following');
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');

    for (const index of [0, 1, 2, 3, 4]) {
      expect(await screen.findByText(`@popular${index}`)).toBeTruthy();
    }
    await act(async () => {
      fireEvent.press(screen.getAllByText('Seguir')[0]);
    });

    expect(follow).toHaveBeenCalledWith('usr-10');
    expect(await screen.findByText('Siguiendo')).toBeTruthy();
  });

  it('E1-H14.CA3 - finishing is possible without following anyone, or without suggestions', async () => {
    jest
      .spyOn(postService, 'getSuggestedAccounts')
      .mockRejectedValueOnce(new ApiError('No se pudieron cargar las sugerencias.'));
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');

    expect(await screen.findByText('No se pudieron cargar las sugerencias.')).toBeTruthy();
    await press('Ir al inicio');

    expect(await screen.findByText(FEED_EMPTY)).toBeTruthy();
  });

  it('E1-H14.CA2 - back to the interests when the server did not keep them', async () => {
    completeOnboarding.mockRejectedValueOnce(
      new ApiError('Elegí al menos 3 intereses antes de terminar.', 'too-few-interests')
    );
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');
    await screen.findByText('@popular0');

    await press('Ir al inicio');

    expect(alert).toHaveBeenCalledWith('Error', 'Elegí al menos 3 intereses antes de terminar.');
    expect(await screen.findByText('¿Qué te interesa?')).toBeTruthy();
    expect(useAuthStore.getState().user?.onboardingCompleted).toBe(false);
  });

  it('E1-H14.CA3 - says so when there is nobody to suggest yet', async () => {
    jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValueOnce([]);
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);

    await press('Continuar');

    expect(await screen.findByText('Todavía no hay cuentas para sugerirte.')).toBeTruthy();
  });

  it('a failed finish stays on the suggestions and says why', async () => {
    completeOnboarding.mockRejectedValueOnce(new ApiError('Sin conexión.'));
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');
    await screen.findByText('@popular0');

    await press('Ir al inicio');

    expect(alert).toHaveBeenCalledWith('Error', 'Sin conexión.');
    expect(screen.getByText('Cuentas para seguir')).toBeTruthy();
    expect(useAuthStore.getState().user?.onboardingCompleted).toBe(false);
  });

  it('a session that ended while finishing goes back to the login', async () => {
    completeOnboarding.mockRejectedValueOnce(new ApiError('Tu sesión expiró.', 'session-revoked'));
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);
    await press('Continuar');
    await screen.findByText('@popular0');

    await press('Ir al inicio');

    expect(alert).toHaveBeenCalledWith('Tu sesión se cerró', 'Tu sesión expiró.');
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });

  it('a session that ended during the onboarding goes back to the login', async () => {
    saveInterests.mockRejectedValueOnce(new ApiError('Tu sesión expiró.', 'session-revoked'));
    persistSession(newUser);
    await openApp();
    await act(async () => {
      fireEvent.press(await screen.findByText('Saltear'));
    });
    await screen.findByText('¿Qué te interesa?');
    await chooseInterests(['Deportes', 'Música', 'Ciencia']);

    await press('Continuar');

    expect(alert).toHaveBeenCalledWith('Tu sesión se cerró', 'Tu sesión expiró.');
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });
});
