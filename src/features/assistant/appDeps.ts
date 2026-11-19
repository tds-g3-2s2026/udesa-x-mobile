import { getAuthErrorMessage } from '../../api/apiClient';
import { useThemeStore } from '../../stores/themeStore';
import { ThemeName } from '../../theme/colors';
import { FeedLanguage } from '../../types/auth';
import { FeedItem } from '../../types/post';
import { UserProfile } from '../../types/social';
import { authService } from '../auth/services/authService';
import { postService } from '../posts/services/postService';
import { search } from '../search/searchService';
import { PostSearchResult, UserSearchResult, normalizedSearchText } from '../search/types';
import { followService } from '../social/services/followService';
import { profileService } from '../social/services/profileService';
import { Account, PAGE_SIZE } from './assistantView';
import { AssistantDeps, Confirmation, Proposal } from './voiceExecutor';

// The executor on top of the services the screens already use: an action by
// voice is the same call as the tap it replaces.
export function createAppDeps(
  confirm: (proposal: Proposal) => Promise<Confirmation>
): AssistantDeps {
  return {
    getFeed: (cursor) => postService.getFeed(cursor),
    getPost: (postId) => postService.getPost(postId),
    getReplies: (postId) => postService.getReplies(postId),
    like: (postId) => postService.likePost(postId),
    unlike: (postId) => postService.unlikePost(postId),
    retweet: (postId) => postService.retweet(postId),
    reply: async (postId, text) => {
      await postService.createReply(postId, text);
    },
    compose: async (text) => {
      await postService.createPost(text);
    },
    search: searchEverything,
    getProfile: async (userId) => fromProfile(await profileService.getProfile(userId)),
    getProfilePosts: async (userId) => (await profileService.getPosts(userId)).items,
    follow: (userId) => followService.follow(userId),
    getPreferences: async () => ({
      theme: useThemeStore.getState().theme,
      feedLanguage: (await authService.getPreferences()).feedLanguage,
    }),
    setTheme: (theme) => useThemeStore.getState().setTheme(theme as ThemeName),
    setFeedLanguage: async (language) => {
      await authService.updatePreferences({ feedLanguage: language as FeedLanguage });
    },
    confirm,
    errorMessage: getAuthErrorMessage,
  };
}

async function searchEverything(
  query: string
): Promise<{ posts: FeedItem[]; accounts: Account[] }> {
  // The searches of the screen take a signal to drop a stale query; a step of
  // the assistant never goes stale, so this one is never aborted.
  const { signal } = new AbortController();
  const [posts, users] = await Promise.all([
    search('posts', normalizedSearchText(query, 'posts'), null, signal),
    search('users', normalizedSearchText(query, 'users'), null, signal),
  ]);
  // A result brings a snippet, not the likes the screen tells the model about,
  // so the ones on screen are read whole. One that was deleted meanwhile is left out.
  const found = (posts.items as PostSearchResult[]).slice(0, PAGE_SIZE);
  const read = await Promise.allSettled(found.map((result) => postService.getPost(result.id)));
  return {
    posts: read.flatMap((outcome) => (outcome.status === 'fulfilled' ? [outcome.value] : [])),
    accounts: (users.items as UserSearchResult[]).map(fromSearch),
  };
}

function withAt(handle: string): string {
  return handle.startsWith('@') ? handle : `@${handle}`;
}

function fromSearch(user: UserSearchResult): Account {
  const handle = withAt(user.handle);
  return { id: user.id, handle, name: user.displayName || handle };
}

function fromProfile(profile: UserProfile): Account {
  const handle = profile.handle ? withAt(profile.handle) : '';
  return {
    id: profile.id,
    handle,
    name: profile.displayName || handle,
    following: profile.isFollowedByMe,
  };
}
