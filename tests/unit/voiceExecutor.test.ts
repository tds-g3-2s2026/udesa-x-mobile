import { describe as describeView, resolve } from '../../src/features/assistant/assistantView';
import {
  AssistantDeps,
  Confirmation,
  Proposal,
  VoiceExecutor,
} from '../../src/features/assistant/voiceExecutor';
import { FeedItem } from '../../src/types/post';
import { FollowState } from '../../src/types/social';

const NOW = new Date('2026-11-19T12:00:00Z');

function post(n: number, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: `post-${n}`,
    authorId: `author-${n}`,
    authorHandle: `@autor${n}`,
    authorDisplayName: `Autor ${n}`,
    authorAvatarUrl: null,
    authorDeleted: false,
    content: `Texto del post ${n}`,
    images: [],
    deleted: false,
    createdAt: '2026-11-19T11:55:00Z',
    likesCount: 2,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:post-${n}`,
    activityAt: '2026-11-19T11:55:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

const FEED = Array.from({ length: 7 }, (_, index) => post(index + 1));
const ANA = { id: 'user-ana', handle: '@ana', name: 'Ana' };

function fakeDeps(answer: Confirmation = { confirmed: true }): jest.Mocked<AssistantDeps> {
  return {
    getFeed: jest.fn(async (cursor: string | null) =>
      cursor === null
        ? { items: FEED.slice(0, 6), nextCursor: 'next' }
        : { items: FEED.slice(6), nextCursor: null }
    ),
    getPost: jest.fn(async (id: string) => FEED.find((item) => item.id === id) as FeedItem),
    getReplies: jest.fn(async (_id: string) => ({
      items: [post(90, { content: 'Una respuesta' })],
      nextCursor: null,
    })),
    like: jest.fn(async (_id: string) => {}),
    unlike: jest.fn(async (_id: string) => {}),
    retweet: jest.fn(async (_id: string) => {}),
    reply: jest.fn(async (_id: string, _text: string) => {}),
    compose: jest.fn(async (_text: string) => {}),
    search: jest.fn(async (_query: string) => ({ posts: [post(3)], accounts: [ANA] })),
    getProfile: jest.fn(async (id: string) => ({
      id,
      handle: '@ana',
      name: 'Ana',
      following: false,
    })),
    getProfilePosts: jest.fn(async (_id: string) => [post(4), post(5), post(6), post(7)]),
    follow: jest.fn(async (_id: string): Promise<FollowState> => 'following'),
    getPreferences: jest.fn(async () => ({ theme: 'dark', feedLanguage: 'all' })),
    setTheme: jest.fn(async (_theme: string) => {}),
    setFeedLanguage: jest.fn(async (_language: string) => {}),
    confirm: jest.fn(async (_proposal: Proposal) => answer),
    errorMessage: jest.fn((_error: unknown) => 'No se pudo completar la acción'),
  };
}

async function started(deps: AssistantDeps = fakeDeps()) {
  const executor = new VoiceExecutor(deps);
  await executor.start();
  return executor;
}

describe('VoiceExecutor', () => {
  it('AI-05 - likes the post the model refers to', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    const result = await executor.perform('like_post', { ref: 'p2' });

    expect(result).toEqual({ ok: true, done: 'Like dado' });
    expect(deps.like).toHaveBeenCalledWith('post-2');
    expect(executor.describe(NOW).posts?.[1]).toMatchObject({ liked_by_me: true, likes: 3 });
    expect(executor.current().highlightedId).toBe('post-2');
  });

  it('AI-05 - asks before retweeting, replying, posting or following', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    await executor.perform('retweet_post', { ref: 'p1' });
    await executor.perform('reply_to_post', { ref: 'p1', text: 'Nos vemos mañana' });
    await executor.perform('compose_post', { text: 'Llego tarde' });
    await executor.perform('open_profile', { ref: 'p1' });
    await executor.perform('follow', { ref: 'a1' });

    expect(deps.confirm.mock.calls.map(([proposal]) => proposal.action)).toEqual([
      'retweet_post',
      'reply_to_post',
      'compose_post',
      'follow',
    ]);
    expect(deps.confirm.mock.calls[1][0]).toMatchObject({
      post: { id: 'post-1' },
      text: 'Nos vemos mañana',
    });
    expect(deps.retweet).toHaveBeenCalledWith('post-1');
    expect(deps.reply).toHaveBeenCalledWith('post-1', 'Nos vemos mañana');
    expect(deps.compose).toHaveBeenCalledWith('Llego tarde');
    expect(deps.follow).toHaveBeenCalledWith('author-1');
  });

  it('AI-05 - never sends post ids to the assistant', async () => {
    const executor = await started();
    const screens = [executor.describe(NOW)];
    for (const [action, args] of [
      ['open_post', { ref: 'p1' }],
      ['search', { query: 'torneo' }],
      ['open_profile', { ref: 'a1' }],
    ] as const) {
      await executor.perform(action, args);
      screens.push(executor.describe(NOW));
    }

    const sent = JSON.stringify(screens);
    expect(sent).not.toMatch(/post-\d|author-\d|user-ana/);
    expect(sent).toContain('"ref":"p1"');
  });

  it('a declined confirmation does nothing and ends the request', async () => {
    const deps = fakeDeps({ confirmed: false });
    const executor = await started(deps);

    const result = await executor.perform('retweet_post', { ref: 'p1' });

    expect(result).toEqual({ ok: false, cancelled: true, error: 'El usuario no lo confirmó' });
    expect(deps.retweet).not.toHaveBeenCalled();
  });

  it('publishes the text as the user left it after editing', async () => {
    const deps = fakeDeps({ confirmed: true, text: 'Llego tarde, perdón' });
    const executor = await started(deps);

    await executor.perform('compose_post', { text: 'Llego tarde' });

    expect(deps.compose).toHaveBeenCalledWith('Llego tarde, perdón');
  });

  it('confirms whatever the server marks, beyond the four actions it always confirms', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    await executor.perform('like_post', { ref: 'p1' }, true);

    expect(deps.confirm).toHaveBeenCalledWith(expect.objectContaining({ action: 'like_post' }));
  });

  it('describes the feed five posts at a time, with what is below', async () => {
    const executor = await started();

    const screen = executor.describe(NOW);

    expect(screen).toMatchObject({ screen: 'feed', page: 1, more_below: true });
    expect(screen.posts).toHaveLength(5);
    expect(screen.posts?.[0]).toEqual({
      ref: 'p1',
      author: 'Autor 1',
      handle: '@autor1',
      text: 'Texto del post 1',
      likes: 2,
      liked_by_me: false,
      retweeted_by_me: false,
      time: 'hace 5m',
    });
  });

  it('scrolls down a screen, loading the next page when it runs out', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    expect(await executor.perform('scroll_feed', { direction: 'down' })).toMatchObject({
      ok: true,
    });

    expect(deps.getFeed).toHaveBeenLastCalledWith('next');
    const screen = executor.describe(NOW);
    expect(screen).toMatchObject({ page: 2, more_below: false });
    expect(screen.posts?.map((item) => item.text)).toEqual([
      'Texto del post 6',
      'Texto del post 7',
    ]);
    expect(await executor.perform('scroll_feed', { direction: 'down' })).toEqual({
      ok: false,
      error: 'Ya estás al final del feed',
    });
  });

  it('scrolls back up, and not past the top', async () => {
    const executor = await started();

    expect(await executor.perform('scroll_feed', { direction: 'up' })).toEqual({
      ok: false,
      error: 'Ya estás arriba de todo',
    });
    await executor.perform('scroll_feed', { direction: 'down' });
    await executor.perform('scroll_feed', { direction: 'up' });

    expect(executor.describe(NOW).page).toBe(1);
  });

  it('refreshes the feed back to the top', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);
    await executor.perform('scroll_feed', { direction: 'down' });

    await executor.perform('refresh_feed', {});

    expect(executor.describe(NOW).page).toBe(1);
    expect(deps.getFeed).toHaveBeenLastCalledWith(null);
  });

  it('refuses a ref that is not on the screen, saying which', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    expect(await executor.perform('like_post', { ref: 'p6' })).toEqual({
      ok: false,
      error: 'p6 no está en la pantalla',
    });
    expect(await executor.perform('like_post', { ref: 'a1' })).toMatchObject({ ok: false });
    expect(deps.like).not.toHaveBeenCalled();
  });

  it('does not like twice or take away a like that is not there', async () => {
    const deps = fakeDeps();
    deps.getFeed.mockResolvedValueOnce({
      items: [post(1, { likedByMe: true, likesCount: 4 }), post(2)],
      nextCursor: null,
    });
    const executor = await started(deps);

    expect(await executor.perform('like_post', { ref: 'p1' })).toEqual({
      ok: true,
      done: 'Ya tenía tu like',
    });
    expect(await executor.perform('unlike_post', { ref: 'p2' })).toEqual({
      ok: true,
      done: 'No tenía tu like',
    });
    expect(await executor.perform('unlike_post', { ref: 'p1' })).toEqual({
      ok: true,
      done: 'Like sacado',
    });
    expect(deps.like).not.toHaveBeenCalled();
    expect(deps.unlike).toHaveBeenCalledWith('post-1');
    expect(executor.describe(NOW).posts?.[0]).toMatchObject({ liked_by_me: false, likes: 3 });
  });

  it('does not retweet twice', async () => {
    const deps = fakeDeps();
    deps.getFeed.mockResolvedValueOnce({
      items: [post(1, { retweetedByMe: true })],
      nextCursor: null,
    });
    const executor = await started(deps);

    expect(await executor.perform('retweet_post', { ref: 'p1' })).toEqual({
      ok: true,
      done: 'Ya estaba retuiteado',
    });
    expect(deps.retweet).not.toHaveBeenCalled();
    // Nothing would change, so nothing is asked.
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  it('opens a post with its replies', async () => {
    const executor = await started();

    await executor.perform('open_post', { ref: 'p3' });

    expect(executor.describe(NOW)).toMatchObject({
      screen: 'post',
      posts: [{ ref: 'p1', text: 'Texto del post 3' }],
      replies: ['Una respuesta'],
    });
    await executor.perform('like_post', { ref: 'p1' });
    expect(executor.describe(NOW).posts?.[0].liked_by_me).toBe(true);
  });

  it('searches and acts on what it found', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    await executor.perform('search', { query: 'torneo' });
    await executor.perform('like_post', { ref: 'p1' });

    expect(deps.search).toHaveBeenCalledWith('torneo');
    expect(executor.describe(NOW)).toMatchObject({
      screen: 'search',
      query: 'torneo',
      accounts: [{ ref: 'a1', handle: '@ana', name: 'Ana' }],
      posts: [{ ref: 'p1', liked_by_me: true }],
    });
    expect(deps.like).toHaveBeenCalledWith('post-3');
  });

  it('opens a profile from an account and follows it there', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);
    await executor.perform('search', { query: 'Ana' });

    expect(await executor.perform('open_profile', { ref: 'a1' })).toEqual({
      ok: true,
      done: 'Perfil de Ana',
    });
    const profile = executor.describe(NOW);
    expect(profile.accounts).toEqual([
      { ref: 'a1', handle: '@ana', name: 'Ana', following: false },
    ]);
    expect(profile.posts).toHaveLength(3);

    await executor.perform('follow', { ref: 'a1' });
    expect(executor.describe(NOW).accounts?.[0].following).toBe(true);
    expect(await executor.perform('follow', { ref: 'a1' })).toEqual({
      ok: true,
      done: 'Ya lo seguías',
    });
    expect(deps.follow).toHaveBeenCalledTimes(1);
    expect(deps.confirm).toHaveBeenCalledTimes(1);
  });

  it('says when following a private account leaves a request', async () => {
    const deps = fakeDeps();
    deps.follow.mockResolvedValueOnce('pending');
    const executor = await started(deps);
    await executor.perform('open_profile', { ref: 'p2' });

    expect(await executor.perform('follow', { ref: 'a1' })).toEqual({
      ok: true,
      done: 'La cuenta es privada: quedó la solicitud de seguimiento',
    });
  });

  it('only follows from a profile, and only accounts', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    expect(await executor.perform('follow', { ref: 'a1' })).toEqual({
      ok: false,
      error: 'Para seguir a alguien, primero abrí su perfil (open_profile)',
    });
    await executor.perform('open_profile', { ref: 'p1' });
    expect(await executor.perform('follow', { ref: 'p1' })).toEqual({
      ok: false,
      error: 'p1 no es una cuenta',
    });
    expect(deps.follow).not.toHaveBeenCalled();
    // The user is never asked to confirm what cannot be done.
    expect(deps.confirm).not.toHaveBeenCalled();
  });

  it('does not open the profile of a deleted account', async () => {
    const deps = fakeDeps();
    deps.getFeed.mockResolvedValueOnce({
      items: [post(1, { authorDeleted: true })],
      nextCursor: null,
    });
    const executor = await started(deps);

    expect(await executor.perform('open_profile', { ref: 'p1' })).toEqual({
      ok: false,
      error: 'La cuenta de ese post ya no existe',
    });
    expect(executor.describe(NOW).posts?.[0].author).toBe('Cuenta eliminada');
  });

  it('changes the theme and the language of the feed, and shows the settings', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);

    await executor.perform('set_preference', { name: 'theme', value: 'dark' });
    await executor.perform('set_preference', { name: 'feed_language', value: 'en' });

    expect(deps.setTheme).toHaveBeenCalledWith('dark');
    expect(deps.setFeedLanguage).toHaveBeenCalledWith('en');
    expect(executor.describe(NOW)).toEqual({
      screen: 'settings',
      preferences: { theme: 'dark', feed_language: 'all' },
    });
    expect(await executor.perform('set_preference', { name: 'font', value: 'big' })).toEqual({
      ok: false,
      error: 'font no es una preferencia',
    });
  });

  it('likes a post on a profile too', async () => {
    const deps = fakeDeps();
    const executor = await started(deps);
    await executor.perform('open_profile', { ref: 'p1' });

    await executor.perform('like_post', { ref: 'p2' });

    expect(deps.like).toHaveBeenCalledWith('post-5');
    expect(executor.describe().posts?.[1].liked_by_me).toBe(true);
  });

  it('reads a post with no text, name or handle as empty', async () => {
    const deps = fakeDeps();
    const bare = post(1, { content: null, authorDisplayName: null, authorHandle: null });
    deps.getFeed.mockResolvedValueOnce({ items: [bare], nextCursor: null });
    deps.getPost.mockResolvedValueOnce(bare);
    deps.getReplies.mockResolvedValueOnce({
      items: [post(2, { content: null })],
      nextCursor: null,
    });
    const executor = await started(deps);

    expect(executor.describe(NOW).posts?.[0]).toMatchObject({ author: '', handle: '', text: '' });
    await executor.perform('open_post', { ref: 'p1' });
    expect(executor.describe(NOW).replies).toEqual(['']);
  });

  it('only scrolls on the feed', async () => {
    const executor = await started();
    await executor.perform('search', { query: 'x' });

    expect(await executor.perform('scroll_feed', { direction: 'down' })).toMatchObject({
      ok: false,
    });
  });

  it('turns a failed call into a message for the model', async () => {
    const deps = fakeDeps();
    deps.like.mockRejectedValueOnce(new Error('network'));
    const executor = await started(deps);

    expect(await executor.perform('like_post', { ref: 'p1' })).toEqual({
      ok: false,
      error: 'No se pudo completar la acción',
    });
    expect(executor.describe(NOW).posts?.[0].liked_by_me).toBe(false);
  });

  it('answers finish without doing anything, and refuses an unknown action', async () => {
    const onChange = jest.fn();
    const executor = new VoiceExecutor(fakeDeps(), onChange);
    await executor.start();

    expect(await executor.perform('finish', { say: 'Listo' })).toEqual({ ok: true, done: 'Listo' });
    expect(await executor.perform('delete_post', { ref: 'p1' })).toEqual({
      ok: false,
      error: 'delete_post no es una acción de la app',
    });
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

describe('resolve', () => {
  it('finds nothing for a malformed ref', () => {
    const view = { kind: 'feed' as const, items: FEED, offset: 0, nextCursor: null };

    expect(resolve(view, 'p0')).toBeNull();
    expect(resolve(view, 'px')).toBeNull();
    expect(resolve(view, 'p2')).toEqual({ post: FEED[1] });
    expect(describeView(view, NOW).more_below).toBe(true);
  });
});
