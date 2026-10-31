import { InfiniteData } from '@tanstack/react-query';
import { NotificationPage } from './types';

export type NotificationPages = InfiniteData<NotificationPage, string | null>;

// One cache entry per account: the root provider clears the whole cache when
// the session changes, and the account in the key keeps a request that was
// still in flight from landing on the next session's list.
export function notificationsKey(viewerId: string | undefined) {
  return ['notifications', viewerId] as const;
}

// After read-all succeeds, every row already loaded is read. A row that was
// already read keeps its own date.
export function markLoadedAsRead(
  data: NotificationPages | undefined,
  readAt: string
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.map((item) => (item.readAt ? item : { ...item, readAt })),
    })),
  };
}

// Drops one notification from whichever page holds it, keeping each page's
// cursor so scrolling further still continues from the same place.
export function withoutNotification(
  data: NotificationPages | undefined,
  id: string
): NotificationPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      items: page.items.filter((item) => item.id !== id),
    })),
  };
}
