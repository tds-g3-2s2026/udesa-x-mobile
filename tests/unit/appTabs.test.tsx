import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as SecureStore from 'expo-secure-store';
import { useAuthStore } from '../../src/stores/authStore';
import { User } from '../../src/types/auth';

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
const secureStoreMock = SecureStore as unknown as { values: Map<string, string> };
const secureStoreValues = secureStoreMock.values;

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  fullName: 'Joaquín León',
  isVerified: true,
};

function persistSession(session: User = user): void {
  secureStoreValues.set('udesa_x_access_token', 'jwt-access-token');
  secureStoreValues.set('udesa_x_refresh_token', 'jwt-refresh-token');
  secureStoreValues.set('udesa_x_user', JSON.stringify(session));
}

// The root layout restores the session before mounting the protected group, so the
// tests wait for that read: it also keeps the store updates inside act.
async function renderTab(url: string): Promise<void> {
  renderRouter('app', { initialUrl: url });
  await waitFor(() => expect(useAuthStore.getState().isInitialized).toBe(true));
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
  persistSession();
});

// These tests run the real route tree of app/(app), so they fail if a tab
// file is renamed, removed or dropped from the navigator.
describe('T-51. Navegación por tabs', () => {
  it('T-51 - the authenticated area exposes the four tabs of the product', async () => {
    await renderTab('/');

    expect(screen.getByText('Inicio')).toBeTruthy();
    expect(screen.getByText('Buscar')).toBeTruthy();
    expect(screen.getByText('Notificaciones')).toBeTruthy();
    expect(screen.getByText('Perfil')).toBeTruthy();
  });

  it('T-51 - the landing tab is the feed with its search shortcut', async () => {
    await renderTab('/');

    expect(screen.getByText('Todavía no hay publicaciones')).toBeTruthy();
    expect(screen.getByLabelText('Buscar en UdeSA-X')).toBeTruthy();
  });

  it('T-51 - the search shortcut of the feed opens the Buscar tab', async () => {
    await renderTab('/');

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Buscar en UdeSA-X'));
    });

    expect(screen.getByPlaceholderText('Buscar personas y publicaciones')).toBeTruthy();
  });

  it('T-51 - the Buscar tab reports that results are not wired yet', async () => {
    await renderTab('/search');

    const field = screen.getByPlaceholderText('Buscar personas y publicaciones');
    expect(screen.getByText('Empezá a buscar')).toBeTruthy();

    fireEvent.changeText(field, 'joaquin');

    expect(screen.getByText('Sin resultados')).toBeTruthy();
  });

  it('T-51 - the Notificaciones tab shows its empty state', async () => {
    await renderTab('/notifications');

    expect(screen.getByText('No tenés notificaciones')).toBeTruthy();
  });

  it('T-51 - the Perfil tab shows the session data and the logout', async () => {
    await renderTab('/profile');

    expect(screen.getByText(user.fullName)).toBeTruthy();
    expect(screen.getByText(user.handle)).toBeTruthy();
    expect(screen.getByText(user.email)).toBeTruthy();
    expect(screen.getByText('Correo verificado')).toBeTruthy();
    expect(screen.getByText('Cerrar Sesión')).toBeTruthy();
  });

  it('T-51 - the Perfil tab flags an account whose email is not verified', async () => {
    persistSession({ ...user, isVerified: false });

    await renderTab('/profile');

    expect(screen.getByText('Correo sin verificar')).toBeTruthy();
  });

  it('T-51 - pressing the Perfil tab moves there from the feed', async () => {
    await renderTab('/');
    expect(screen.getByText('Todavía no hay publicaciones')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Perfil'));
    });

    expect(screen.getByText(user.email)).toBeTruthy();
    expect(screen.queryByText('Todavía no hay publicaciones')).toBeNull();
  });
});
