import { createAppDeps } from '../../src/features/assistant/appDeps';
import { authService } from '../../src/features/auth/services/authService';
import { postService } from '../../src/features/posts/services/postService';
import * as searchService from '../../src/features/search/searchService';
import { followService } from '../../src/features/social/services/followService';
import { profileService } from '../../src/features/social/services/profileService';
import { useThemeStore } from '../../src/stores/themeStore';
import { FeedItem } from '../../src/types/post';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(async () => undefined),
  getItemAsync: jest.fn(async () => null),
}));

const item = { id: 'post-1', content: 'Hola' } as FeedItem;
const confirm = jest.fn(async () => ({ confirmed: true }));
const deps = createAppDeps(confirm);

describe('createAppDeps', () => {
  afterEach(() => jest.restoreAllMocks());

  it('performs each action with the same call as the tap it replaces', async () => {
    const calls = {
      getFeed: jest
        .spyOn(postService, 'getFeed')
        .mockResolvedValue({ items: [], nextCursor: null }),
      getPost: jest.spyOn(postService, 'getPost').mockResolvedValue({ ...item, parentId: null }),
      getReplies: jest
        .spyOn(postService, 'getReplies')
        .mockResolvedValue({ items: [], nextCursor: null }),
      likePost: jest.spyOn(postService, 'likePost').mockResolvedValue(),
      unlikePost: jest.spyOn(postService, 'unlikePost').mockResolvedValue(),
      retweet: jest.spyOn(postService, 'retweet').mockResolvedValue(),
      createReply: jest.spyOn(postService, 'createReply').mockResolvedValue({} as never),
      createPost: jest.spyOn(postService, 'createPost').mockResolvedValue({} as never),
      follow: jest.spyOn(followService, 'follow').mockResolvedValue('following'),
      getPosts: jest
        .spyOn(profileService, 'getPosts')
        .mockResolvedValue({ items: [item], nextCursor: null }),
    };

    await deps.getFeed('cursor');
    await deps.getPost('post-1');
    await deps.getReplies('post-1');
    await deps.like('post-1');
    await deps.unlike('post-1');
    await deps.retweet('post-1');
    await deps.reply('post-1', 'Dale');
    await deps.compose('Llego tarde');
    expect(await deps.follow('user-1')).toBe('following');
    expect(await deps.getProfilePosts('user-1')).toEqual([item]);

    expect(calls.getFeed).toHaveBeenCalledWith('cursor');
    expect(calls.likePost).toHaveBeenCalledWith('post-1');
    expect(calls.unlikePost).toHaveBeenCalledWith('post-1');
    expect(calls.retweet).toHaveBeenCalledWith('post-1');
    expect(calls.createReply).toHaveBeenCalledWith('post-1', 'Dale');
    expect(calls.createPost).toHaveBeenCalledWith('Llego tarde');
    expect(calls.follow).toHaveBeenCalledWith('user-1');
    expect(deps.confirm).toBe(confirm);
  });

  it('searches posts and accounts, reading the posts on screen whole', async () => {
    const search = jest.spyOn(searchService, 'search').mockImplementation(async (kind) =>
      kind === 'posts'
        ? {
            items: [
              {
                id: 'post-1',
                authorId: 'a',
                authorHandle: '@a',
                createdAt: '',
                parentId: null,
                snippet: [],
              },
              {
                id: 'gone',
                authorId: 'b',
                authorHandle: '@b',
                createdAt: '',
                parentId: null,
                snippet: [],
              },
            ],
            nextCursor: null,
          }
        : {
            items: [
              { id: 'user-1', handle: 'ana', displayName: 'Ana', isPrivate: false },
              { id: 'user-2', handle: '@beto', displayName: null, isPrivate: false },
            ],
            nextCursor: null,
          }
    );
    jest
      .spyOn(postService, 'getPost')
      .mockImplementation(async (id) =>
        id === 'gone' ? Promise.reject(new Error('404')) : { ...item, parentId: null }
      );

    const found = await deps.search('@ana');

    expect(search.mock.calls.map(([kind, query]) => [kind, query])).toEqual([
      ['posts', '@ana'],
      ['users', 'ana'],
    ]);
    expect(found.posts.map((post) => post.id)).toEqual(['post-1']);
    expect(found.accounts).toEqual([
      { id: 'user-1', handle: '@ana', name: 'Ana' },
      { id: 'user-2', handle: '@beto', name: '@beto' },
    ]);
  });

  it('reads a profile with whether the user follows it', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue({
      id: 'user-1',
      handle: 'ana',
      displayName: null,
      bio: null,
      avatarUrl: null,
      coverUrl: null,
      createdAt: null,
      followersCount: 0,
      followingCount: 0,
      isPrivate: false,
      isFollowedByMe: true,
      isMutedByMe: false,
    });

    expect(await deps.getProfile('user-1')).toEqual({
      id: 'user-1',
      handle: '@ana',
      name: '@ana',
      following: true,
    });
  });

  it('changes the theme on the phone and the language of the feed on the server', async () => {
    const update = jest.spyOn(authService, 'updatePreferences').mockResolvedValue({
      profileVisibility: 'public',
      feedLanguage: 'en',
    });
    jest
      .spyOn(authService, 'getPreferences')
      .mockResolvedValue({ profileVisibility: 'public', feedLanguage: 'en' });

    await deps.setTheme('dark');
    await deps.setFeedLanguage('en');

    expect(useThemeStore.getState().theme).toBe('dark');
    expect(update).toHaveBeenCalledWith({ feedLanguage: 'en' });
    expect(await deps.getPreferences()).toEqual({ theme: 'dark', feedLanguage: 'en' });
    expect(deps.errorMessage(new Error('Sin conexión'))).toBe('Sin conexión');
  });
});
