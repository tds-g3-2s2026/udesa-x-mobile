// Shape of POST /posts' 201 response. Counts start at zero and content
// already comes back sanitized: both are backend guarantees, nothing
// mobile has to enforce on its own.
export interface Post {
  id: string;
  authorId: string;
  content: string;
  createdAt: string;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
}

// A row of GET /feed: same counters as Post, plus the author fields the feed
// needs to render a row and Post doesn't carry (posting is always the
// caller, so there is nothing to name there).
export interface FeedItem {
  id: string;
  authorId: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  content: string;
  createdAt: string;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
}

// GET /feed's shape: a fixed page of 20 plus an opaque cursor for the next
// one, null once there is no more — same convention as the follow lists.
export interface FeedPage {
  items: FeedItem[];
  nextCursor: string | null;
}

// A row of GET /users/suggested: a plain list, not a cursor page, capped at
// 10 and already excludes the caller's own account and whoever they follow.
export interface SuggestedAccount {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  followersCount: number;
}
