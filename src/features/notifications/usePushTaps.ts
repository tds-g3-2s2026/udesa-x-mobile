import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import * as Notifications from 'expo-notifications';
import { pushTarget } from './notificationContent';
import { notificationRoute } from './notificationRoute';

// Opens what a tapped push points to, the same screen its row in the list
// opens. A tap reaches the app in one of two ways. With the app closed,
// Android starts it and keeps the tap: this runs only once the stored session
// was read, so the screen opens on top of the right session. With the app in
// the background or open, the listener gets the tap as it happens.
//
// Android only, like the token: no other platform receives these pushes.
export function usePushTaps(): void {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Without a handler, a push that arrives with the app open is not shown,
    // and there is nothing to tap.
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: false,
        shouldSetBadge: false,
      }),
    });

    const open = (response: Notifications.NotificationResponse) => {
      if (response.actionIdentifier !== Notifications.DEFAULT_ACTION_IDENTIFIER) return;
      // Handled once: the native side keeps the last tap until it is cleared,
      // and the next login would open it again.
      Notifications.clearLastNotificationResponse();
      const target = pushTarget(response.notification.request.content.data);
      if (target) router.push(notificationRoute(target));
    };

    // The tap that started the app waits one turn: navigating while this
    // layout is still mounting makes the router mount it again, and the
    // token would go out twice.
    const lastTap = Notifications.getLastNotificationResponse();
    const coldStart = lastTap ? setTimeout(() => open(lastTap), 0) : undefined;
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => {
      clearTimeout(coldStart);
      subscription.remove();
      Notifications.setNotificationHandler(null);
    };
  }, [router]);
}
