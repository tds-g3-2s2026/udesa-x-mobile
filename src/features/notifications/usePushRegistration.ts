import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useAuthStore } from '../../stores/authStore';
import { notificationService } from './notificationService';

// The server sends pushes without a channel of their own, so Android files
// them under the default channel that app.json declares for FCM. Creating it
// is also what lets Android 13 and later show the permission prompt at all:
// the system only asks once the app has a channel.
export const PUSH_CHANNEL_ID = 'default';

// Hands this device's FCM token to notifications-api every time a session
// becomes active: after a login, and also when the app opens with a stored
// session. A session outlives app launches by weeks, so waiting for an
// explicit login would leave most phones without push, and so would a token
// the server dropped after FCM rejected it. The token goes out even when it
// did not change: the server files it under whoever signed in last here.
//
// Android only: the server delivers through FCM, and on iOS the device token
// is an APNs one that FCM cannot deliver to.
export function usePushRegistration(): void {
  const accountId = useAuthStore((state) => state.user?.id);

  useEffect(() => {
    if (!accountId || Platform.OS !== 'android') return;
    void registerDevice();
    // FCM can rotate the token while the app runs.
    const subscription = Notifications.addPushTokenListener((token) => void send(token));
    return () => subscription.remove();
  }, [accountId]);
}

async function registerDevice(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(PUSH_CHANNEL_ID, {
      name: 'Notificaciones',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
    if (!(await hasPermission())) return;
    await send(await Notifications.getDevicePushTokenAsync());
  } catch {
    // No token without a Firebase setup in the build, or with no Play
    // services on the device. Push is an extra of the session, never a
    // reason to get in its way: the next session start tries again.
  }
}

// Asks only while Android still lets the app ask. Once the user said no for
// good, asking again would resolve to the same no without showing anything.
async function hasPermission(): Promise<boolean> {
  const current = await Notifications.getPermissionsAsync();
  if (current.granted || !current.canAskAgain) return current.granted;
  return (await Notifications.requestPermissionsAsync()).granted;
}

async function send(token: Notifications.DevicePushToken): Promise<void> {
  if (token.type !== 'android') return;
  try {
    await notificationService.registerDeviceToken(token.data);
  } catch {
    // Same as above: the next session start sends it again.
  }
}
