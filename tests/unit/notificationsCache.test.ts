import {
  markLoadedAsRead,
  NotificationPages,
  withoutNotification,
} from '../../src/features/notifications/notificationsCache';
import { AppNotification } from '../../src/features/notifications/types';

function notification(id: string, readAt: string | null = null): AppNotification {
  return {
    id,
    type: 'follow',
    actor: { id: 'usr-2', handle: 'juanperez' },
    postId: null,
    replyId: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    readAt,
  };
}

const cached: NotificationPages = {
  pages: [
    { items: [notification('a'), notification('b', '2026-10-29T10:00:00.000Z')], nextCursor: 'c2' },
    { items: [notification('c')], nextCursor: null },
  ],
  pageParams: [null, 'c2'],
};

describe('markLoadedAsRead', () => {
  it('E4-H3.CA2 - marks every loaded row as read and keeps the date of the ones already read', () => {
    const updated = markLoadedAsRead(cached, '2026-10-30T15:00:00.000Z');

    expect(updated?.pages.flatMap((page) => page.items.map((item) => item.readAt))).toEqual([
      '2026-10-30T15:00:00.000Z',
      '2026-10-29T10:00:00.000Z',
      '2026-10-30T15:00:00.000Z',
    ]);
  });

  it('does nothing when nothing was loaded yet', () => {
    expect(markLoadedAsRead(undefined, '2026-10-30T15:00:00.000Z')).toBeUndefined();
  });
});

describe('withoutNotification', () => {
  it('E4-H3.CA4 - drops the row from its page and keeps every cursor', () => {
    const updated = withoutNotification(cached, 'c');

    expect(updated?.pages).toEqual([
      {
        items: [notification('a'), notification('b', '2026-10-29T10:00:00.000Z')],
        nextCursor: 'c2',
      },
      { items: [], nextCursor: null },
    ]);
    expect(updated?.pageParams).toEqual([null, 'c2']);
  });

  it('does nothing when nothing was loaded yet', () => {
    expect(withoutNotification(undefined, 'a')).toBeUndefined();
  });
});
