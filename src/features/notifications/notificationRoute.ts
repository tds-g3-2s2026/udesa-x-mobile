import type { Href } from 'expo-router';
import { NotificationTarget } from './notificationContent';

// The screen a notification opens, the same from a row of the list and from a
// tapped push.
export function notificationRoute(target: NotificationTarget): Href {
  return target.screen === 'user'
    ? { pathname: '/user/[id]', params: { id: target.id } }
    : { pathname: '/post/[id]', params: { id: target.id } };
}
