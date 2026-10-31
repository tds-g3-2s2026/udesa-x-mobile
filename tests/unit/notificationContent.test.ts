import {
  actorName,
  describeNotification,
  notificationTarget,
} from '../../src/features/notifications/notificationContent';
import { AppNotification } from '../../src/features/notifications/types';

function notification(overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: 'ntf-1',
    type: 'follow',
    actor: { id: 'usr-2', handle: 'juanperez' },
    postId: null,
    replyId: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

describe('actorName', () => {
  it('adds the leading @ the events leave out', () => {
    expect(actorName('juanperez')).toBe('@juanperez');
  });

  it('does not double the @ when the handle already has it', () => {
    expect(actorName('@juanperez')).toBe('@juanperez');
  });

  it('names an account posts-api did not know yet as Alguien', () => {
    expect(actorName(null)).toBe('Alguien');
  });
});

describe('describeNotification', () => {
  it.each([
    ['follow', '@juanperez empezó a seguirte'],
    ['like', '@juanperez le dio me gusta a tu publicación'],
    ['retweet', '@juanperez retuiteó tu publicación'],
    ['reply', '@juanperez respondió tu publicación'],
  ])('writes the text of a %s', (type, text) => {
    expect(describeNotification(notification({ type })).text).toBe(text);
  });

  it('shows a kind the app does not know as a generic notification instead of failing', () => {
    expect(describeNotification(notification({ type: 'mention' }))).toEqual({
      text: 'Tenés una notificación nueva',
      icon: 'notifications-outline',
    });
  });
});

describe('notificationTarget', () => {
  it('opens the profile of the new follower', () => {
    expect(notificationTarget(notification())).toEqual({ screen: 'user', id: 'usr-2' });
  });

  it.each(['like', 'retweet'])('opens the post a %s was about', (type) => {
    expect(notificationTarget(notification({ type, postId: 'post-1' }))).toEqual({
      screen: 'post',
      id: 'post-1',
    });
  });

  it('opens the answered post of a reply, not the reply', () => {
    expect(
      notificationTarget(notification({ type: 'reply', postId: 'post-1', replyId: 'reply-1' }))
    ).toEqual({ screen: 'post', id: 'post-1' });
  });

  it('opens nothing when the post is missing or the kind is unknown', () => {
    expect(notificationTarget(notification({ type: 'like' }))).toBeNull();
    expect(notificationTarget(notification({ type: 'reply' }))).toBeNull();
    expect(notificationTarget(notification({ type: 'mention', postId: 'post-1' }))).toBeNull();
  });
});
