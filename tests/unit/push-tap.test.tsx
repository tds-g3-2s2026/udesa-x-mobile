import { Platform } from 'react-native';
import { act, screen, waitFor } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { notificationService } from '../../src/features/notifications/notificationService';
import { postService } from '../../src/features/posts/services/postService';
import { profileService } from '../../src/features/social/services/profileService';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeStore } from '../../src/stores/themeStore';
import { User } from '../../src/types/auth';
import { UserProfile } from '../../src/types/social';

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

const FEED_EMPTY_TITLE = 'Todavía no hay publicaciones';
const LOGIN_SUBTITLE = 'Conectate con tu comunidad universitaria';

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  isVerified: true,
};

const follower: UserProfile = {
  id: 'usr-2',
  handle: '@ana',
  displayName: 'Ana Pérez',
  bio: null,
  avatarUrl: null,
  coverUrl: null,
  createdAt: '2026-09-01T12:00:00Z',
  followersCount: 10,
  followingCount: 3,
  isPrivate: false,
  isFollowedByMe: false,
  isMutedByMe: false,
};

function persistSession(): void {
  secureStoreValues.set('udesa_x_access_token', 'jwt-access-token');
  secureStoreValues.set('udesa_x_refresh_token', 'jwt-refresh-token');
  secureStoreValues.set('udesa_x_user', JSON.stringify(user));
}

// A tap on a push with this `data`. Only the fields the app reads: the rest of
// a response is platform detail.
function tap(data: Record<string, string>): Notifications.NotificationResponse {
  const response = {
    actionIdentifier: Notifications.DEFAULT_ACTION_IDENTIFIER,
    notification: { request: { identifier: 'msg-1', content: { data } } },
  };
  return response as unknown as Notifications.NotificationResponse;
}

// The new-follower push, with the `data` notifications-api sends.
function followTap(): Notifications.NotificationResponse {
  return tap({ type: 'follow', actorId: 'usr-2' });
}

// Android keeps the tap that started the app until the app clears it.
function keepTap(response: Notifications.NotificationResponse): void {
  let kept: Notifications.NotificationResponse | null = response;
  notifications.getLastNotificationResponse.mockImplementation(() => kept);
  notifications.clearLastNotificationResponse.mockImplementation(() => {
    kept = null;
  });
}

// Only the two fields the app reads: the rest of the status is platform detail.
function permission(granted: boolean): Notifications.NotificationPermissionsStatus {
  const status = { granted, canAskAgain: !granted };
  return status as Notifications.NotificationPermissionsStatus;
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
  jest.spyOn(profileService, 'getProfile').mockResolvedValue(follower);
  jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
  registerDeviceToken.mockResolvedValue(undefined);
  jest.replaceProperty(Platform, 'OS', 'android');
  // Back to the stand-in of jest.setup.ts: no kept tap and no permission.
  notifications.getLastNotificationResponse.mockReturnValue(null);
  notifications.clearLastNotificationResponse.mockReset();
  notifications.getPermissionsAsync.mockResolvedValue(permission(false));
});

describe('E4-H1. Recibir notificaciones de nuevo seguidor', () => {
  it('E4-H1.CA2 el tap abre el perfil del seguidor', async () => {
    persistSession();
    renderRouter('app', { initialUrl: '/' });
    await screen.findByText(FEED_EMPTY_TITLE);

    // The app is open or in the background: the tap reaches the listener.
    const [onTap] = notifications.addNotificationResponseReceivedListener.mock.calls[0];
    await act(async () => {
      onTap(followTap());
    });

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(profileService.getProfile).toHaveBeenCalledWith('usr-2');
  });

  it('E4-H1.CA2 con la app cerrada, el tap abre el perfil apenas se lee la sesión', async () => {
    keepTap(followTap());
    // A phone where push works, to see how many times the session area mounts.
    notifications.getPermissionsAsync.mockResolvedValue(permission(true));
    notifications.getDevicePushTokenAsync.mockResolvedValue({ type: 'android', data: 'fcm-token' });
    persistSession();

    renderRouter('app', { initialUrl: '/' });

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(profileService.getProfile).toHaveBeenCalledWith('usr-2');
    // Opening the profile while the session area was still mounting used to
    // mount it a second time, and the token went out twice.
    await waitFor(() => expect(registerDeviceToken).toHaveBeenCalled());
    await act(async () => {
      await jest.advanceTimersByTimeAsync(0);
    });
    expect(registerDeviceToken).toHaveBeenCalledTimes(1);
  });

  it('un tap ya atendido no se vuelve a abrir en el próximo login', async () => {
    keepTap(followTap());
    persistSession();
    renderRouter('app', { initialUrl: '/' });
    await screen.findByText('Ana Pérez');

    await act(async () => {
      await useAuthStore.getState().clearSession();
    });
    await screen.findByText(LOGIN_SUBTITLE);
    await act(async () => {
      await useAuthStore.getState().setSession(user, { accessToken: 'jwt-access-token' });
    });

    expect(await screen.findByText(FEED_EMPTY_TITLE)).toBeTruthy();
    expect(screen.queryByText('Ana Pérez')).toBeNull();
  });

  it('un push que la app no conoce no navega a ningún lado', async () => {
    persistSession();
    renderRouter('app', { initialUrl: '/' });
    await screen.findByText(FEED_EMPTY_TITLE);

    // Mentions get their own push in another story: until the app knows them,
    // tapping one only brings the app up.
    const [onTap] = notifications.addNotificationResponseReceivedListener.mock.calls[0];
    await act(async () => {
      onTap(tap({ type: 'mention', actorId: 'usr-2' }));
    });

    expect(screen.getByText(FEED_EMPTY_TITLE)).toBeTruthy();
    expect(profileService.getProfile).not.toHaveBeenCalled();
  });

  it('con la app abierta el push se muestra mientras haya sesión', async () => {
    persistSession();
    renderRouter('app', { initialUrl: '/' });
    await screen.findByText(FEED_EMPTY_TITLE);

    const [handler] = notifications.setNotificationHandler.mock.lastCall ?? [];
    const arrived = {} as Notifications.Notification;
    await expect(handler?.handleNotification(arrived)).resolves.toMatchObject({
      shouldShowBanner: true,
      shouldShowList: true,
    });

    // Signed out, a push that still reaches this phone is not shown on top of the login.
    await act(async () => {
      await useAuthStore.getState().clearSession();
    });
    await screen.findByText(LOGIN_SUBTITLE);
    expect(notifications.setNotificationHandler).toHaveBeenLastCalledWith(null);
  });
});
