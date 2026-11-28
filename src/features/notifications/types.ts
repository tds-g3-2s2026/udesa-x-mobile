// A row of GET /notifications. `type` stays a plain string on purpose: the
// server can add kinds the app does not know yet (mentions come with their own
// story), and an unknown one has to render as something generic, not break the
// list. `readAt` null is what marks it unread. Deleted notifications are never
// listed, so there is no deleted flag to read.
export interface AppNotification {
  id: string;
  type: string;
  actor: { id: string; handle: string | null };
  postId: string | null;
  replyId: string | null;
  createdAt: string;
  readAt: string | null;
}

// The kinds of notification an account can turn off, named like the `type` of
// a notification (and of a push). `direct_message` is stored by the server but
// no notification of that kind exists yet.
export type NotificationPreferenceType =
  'like' | 'retweet' | 'reply' | 'quote' | 'mention' | 'follow' | 'direct_message';

// GET and PUT /notifications/preferences answer one boolean per type: an
// account that never chose gets every type on.
export type NotificationPreferences = Record<NotificationPreferenceType, boolean>;

// Same page shape as the feed and the search: a fixed page of 20, newest
// first, and an opaque cursor for the next one, null once there is no more.
export interface NotificationPage {
  items: AppNotification[];
  nextCursor: string | null;
}
