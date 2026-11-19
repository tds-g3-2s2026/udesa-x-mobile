import { FeedItem } from '../../types/post';
import { formatRelativeTime } from '../posts/relativeTime';
import { Screen, ScreenAccount, ScreenPost } from './types';

// Posts per screen, the same the evaluation used: enough to choose from, and a
// screen the model reads in one go.
export const PAGE_SIZE = 5;
// A profile shows its account and its latest posts, not the whole history.
const PROFILE_POSTS = 3;
const POST_REPLIES = 5;

export interface Account {
  id: string;
  handle: string;
  name: string;
  following?: boolean;
}

export type Preferences = { theme: string; feedLanguage: string };

// What the assistant is looking at. It is its own copy, not the screens of the
// app: the panel draws it, and every ref resolves against it.
export type View =
  | { kind: 'feed'; items: FeedItem[]; offset: number; nextCursor: string | null }
  | { kind: 'post'; post: FeedItem; replies: FeedItem[] }
  | { kind: 'search'; query: string; posts: FeedItem[]; accounts: Account[] }
  | { kind: 'profile'; account: Account; posts: FeedItem[] }
  | { kind: 'settings'; preferences: Preferences };

export function visible(view: View): { posts: FeedItem[]; accounts: Account[] } {
  switch (view.kind) {
    case 'feed':
      return { posts: view.items.slice(view.offset, view.offset + PAGE_SIZE), accounts: [] };
    case 'post':
      return { posts: [view.post], accounts: [] };
    case 'search':
      return { posts: view.posts.slice(0, PAGE_SIZE), accounts: view.accounts.slice(0, PAGE_SIZE) };
    case 'profile':
      return { posts: view.posts.slice(0, PROFILE_POSTS), accounts: [view.account] };
    case 'settings':
      return { posts: [], accounts: [] };
  }
}

// The screen as the model gets it: refs instead of ids, which stay in the app.
export function describe(view: View, now: Date = new Date()): Screen {
  const { posts, accounts } = visible(view);
  const screen: Screen = { screen: view.kind };
  if (view.kind === 'feed') {
    screen.page = Math.floor(view.offset / PAGE_SIZE) + 1;
    screen.more_below = view.offset + PAGE_SIZE < view.items.length || view.nextCursor !== null;
  }
  if (view.kind === 'search') screen.query = view.query;
  if (view.kind === 'settings') {
    screen.preferences = {
      theme: view.preferences.theme,
      feed_language: view.preferences.feedLanguage,
    };
  }
  if (accounts.length > 0) {
    screen.accounts = accounts.map((account, index) => describeAccount(account, index));
  }
  if (view.kind !== 'settings') {
    screen.posts = posts.map((post, index) => describePost(post, index, now));
  }
  if (view.kind === 'post') {
    screen.replies = view.replies.slice(0, POST_REPLIES).map((reply) => reply.content ?? '');
  }
  return screen;
}

// The post or account behind a ref, or null when it is not on the screen.
export function resolve(view: View, ref: string): { post?: FeedItem; account?: Account } | null {
  const position = Number(ref.slice(1));
  if (!Number.isInteger(position) || position < 1) return null;
  const { posts, accounts } = visible(view);
  if (ref.startsWith('p') && position <= posts.length) return { post: posts[position - 1] };
  if (ref.startsWith('a') && position <= accounts.length)
    return { account: accounts[position - 1] };
  return null;
}

export function authorName(post: FeedItem): string {
  if (post.authorDeleted) return 'Cuenta eliminada';
  return post.authorDisplayName ?? post.authorHandle ?? '';
}

function describePost(post: FeedItem, index: number, now: Date): ScreenPost {
  return {
    ref: `p${index + 1}`,
    author: authorName(post),
    handle: post.authorHandle ?? '',
    text: post.content ?? '',
    likes: post.likesCount,
    liked_by_me: post.likedByMe,
    retweeted_by_me: post.retweetedByMe,
    time: formatRelativeTime(post.createdAt, now),
  };
}

function describeAccount(account: Account, index: number): ScreenAccount {
  const described: ScreenAccount = {
    ref: `a${index + 1}`,
    handle: account.handle,
    name: account.name,
  };
  if (account.following !== undefined) described.following = account.following;
  return described;
}
