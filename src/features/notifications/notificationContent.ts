import Ionicons from '@expo/vector-icons/Ionicons';
import { AppNotification } from './types';

type IconName = keyof typeof Ionicons.glyphMap;

// The server stores data, not sentences: the text the list shows is built here
// from the type and the actor.
export interface NotificationContent {
  text: string;
  icon: IconName;
}

// Where tapping a notification leads. Kept as plain data so this module knows
// nothing about the router; the screen turns it into a route.
export type NotificationTarget = { screen: 'user'; id: string } | { screen: 'post'; id: string };

// The handle comes copied from the event that created the notification and,
// unlike the rest of the app, can come without its leading @. It is null when
// posts-api did not know the account yet.
export function actorName(handle: string | null): string {
  if (!handle) return 'Alguien';
  return handle.startsWith('@') ? handle : `@${handle}`;
}

export function describeNotification(notification: AppNotification): NotificationContent {
  const actor = actorName(notification.actor.handle);
  switch (notification.type) {
    case 'follow':
      return { text: `${actor} empezó a seguirte`, icon: 'person-add-outline' };
    case 'like':
      return { text: `${actor} le dio me gusta a tu publicación`, icon: 'heart-outline' };
    case 'retweet':
      return { text: `${actor} retuiteó tu publicación`, icon: 'repeat-outline' };
    case 'reply':
      return { text: `${actor} respondió tu publicación`, icon: 'chatbubble-outline' };
    default:
      return { text: 'Tenés una notificación nueva', icon: 'notifications-outline' };
  }
}

// A follow opens the new follower's profile. A like, a retweet or a reply opens
// postId, the post that received it: for a reply that is the answered post, the
// same one the push notification opens. A kind the app does not know opens nothing.
export function notificationTarget(notification: AppNotification): NotificationTarget | null {
  switch (notification.type) {
    case 'follow':
      return { screen: 'user', id: notification.actor.id };
    case 'like':
    case 'retweet':
    case 'reply':
      return notification.postId ? { screen: 'post', id: notification.postId } : null;
    default:
      return null;
  }
}
