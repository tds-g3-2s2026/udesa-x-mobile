import { Platform } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { authService } from '../../src/features/auth/services/authService';
import { notificationService } from '../../src/features/notifications/notificationService';
import { postService } from '../../src/features/posts/services/postService';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { User } from '../../src/types/auth';

// Same in-memory SecureStore double as navigationGuards.test.tsx.
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
const notifications = jest.mocked(Notifications);
const registerDeviceToken = jest.spyOn(notificationService, 'registerDeviceToken');

const LOGIN_SUBTITLE = 'Conectate con tu comunidad universitaria';
const FEED_EMPTY_TITLE = 'Todavía no hay publicaciones';
const IDENTIFIER_PLACEHOLDER = 'ej. @joaquin_dev o jleon@udesa.edu.ar';
const TOKEN = 'fcm-token-1';

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  isVerified: true,
};

function persistSession(): void {
  secureStoreValues.set('udesa_x_access_token', 'jwt-access-token');
  secureStoreValues.set('udesa_x_refresh_token', 'jwt-refresh-token');
  secureStoreValues.set('udesa_x_user', JSON.stringify(user));
}

// Only the two fields the app reads: the rest of the status is platform detail.
function permission(granted: boolean, canAskAgain: boolean) {
  return { granted, canAskAgain } as Notifications.NotificationPermissionsStatus;
}

async function logIn(): Promise<void> {
  await screen.findByText(LOGIN_SUBTITLE);
  fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), user.handle);
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123');
  await act(async () => {
    fireEvent.press(screen.getByText('Iniciar Sesión'));
  });
  await screen.findByText(FEED_EMPTY_TITLE);
}

// The registration runs in an effect after the feed shows: letting pending
// promises settle keeps a "nothing was sent" assertion from passing early.
// renderRouter turns on fake timers, so a real setTimeout would never fire.
async function settle(): Promise<void> {
  await act(async () => {
    await jest.advanceTimersByTimeAsync(0);
  });
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
  useThemeStore.setState({ theme: 'light', isInitialized: false });
  jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
  jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue([]);
  jest
    .spyOn(authService, 'login')
    .mockResolvedValue({ user, tokens: { accessToken: 'jwt-access-token' } });
  registerDeviceToken.mockResolvedValue(undefined);

  // The stand-in of jest.setup.ts becomes an Android phone where FCM works:
  // the permission can be granted and there is a token. Each test changes
  // only the answer it is about.
  jest.replaceProperty(Platform, 'OS', 'android');
  notifications.setNotificationChannelAsync.mockResolvedValue(null);
  notifications.getPermissionsAsync.mockResolvedValue(permission(false, true));
  notifications.requestPermissionsAsync.mockResolvedValue(permission(true, true));
  notifications.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: TOKEN });
  notifications.addPushTokenListener.mockReturnValue({ remove: jest.fn() });
});

describe('E4-H1. Recibir notificaciones de nuevo seguidor', () => {
  it('E4-H1.CA3 el token se envía después de cada login', async () => {
    renderRouter('app', { initialUrl: '/' });

    await logIn();
    await waitFor(() => expect(registerDeviceToken).toHaveBeenCalledTimes(1));
    expect(registerDeviceToken).toHaveBeenLastCalledWith(TOKEN);

    await act(async () => {
      await useAuthStore.getState().clearSession();
    });
    // Same device, same token: it goes out again so the server files it under
    // whoever signed in last.
    await logIn();
    await waitFor(() => expect(registerDeviceToken).toHaveBeenCalledTimes(2));
    expect(registerDeviceToken).toHaveBeenLastCalledWith(TOKEN);
  });

  it('E4-H1.CA3 también se envía al abrir la app con la sesión guardada', async () => {
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    await screen.findByText(FEED_EMPTY_TITLE);
    await waitFor(() => expect(registerDeviceToken).toHaveBeenCalledTimes(1));
    expect(registerDeviceToken).toHaveBeenCalledWith(TOKEN);
  });

  it('E4-H1.CA3 el token nuevo que da FCM al rotarlo también se envía', async () => {
    persistSession();
    renderRouter('app', { initialUrl: '/' });
    await waitFor(() => expect(registerDeviceToken).toHaveBeenCalledTimes(1));

    const [onRotation] = notifications.addPushTokenListener.mock.calls[0];
    await act(async () => {
      onRotation({ type: 'android', data: 'fcm-token-2' });
    });

    expect(registerDeviceToken).toHaveBeenLastCalledWith('fcm-token-2');
  });

  it('sin el permiso no pide el token y la sesión sigue igual', async () => {
    notifications.requestPermissionsAsync.mockResolvedValue(permission(false, false));
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByText(FEED_EMPTY_TITLE)).toBeTruthy();
    await waitFor(() => expect(notifications.requestPermissionsAsync).toHaveBeenCalled());
    await settle();
    expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it('no vuelve a pedir el permiso si el usuario ya lo negó para siempre', async () => {
    notifications.getPermissionsAsync.mockResolvedValue(permission(false, false));
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    await screen.findByText(FEED_EMPTY_TITLE);
    await waitFor(() => expect(notifications.getPermissionsAsync).toHaveBeenCalled());
    await settle();
    expect(notifications.requestPermissionsAsync).not.toHaveBeenCalled();
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });

  it('en iOS no registra nada: el token de APNs no le sirve a FCM', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    await screen.findByText(FEED_EMPTY_TITLE);
    await settle();
    expect(notifications.getDevicePushTokenAsync).not.toHaveBeenCalled();
    expect(registerDeviceToken).not.toHaveBeenCalled();
  });
});
