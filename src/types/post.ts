// One attached image as posts-api answers it. The URL is signed and expires,
// so it is never worth keeping: every reload hands out a fresh one, and `id` is
// what stays the same between them.
export interface PostImage {
  id: string;
  url: string;
  position: number;
}

// Shape of the 201 response of POST /posts and POST /posts/{id}/replies.
// Counts start at zero and content already comes back sanitized: both are
// backend guarantees, nothing mobile has to enforce on its own. `parentId` is
// null for a top-level post and the id of the original for a reply.
export interface Post {
  id: string;
  authorId: string;
  parentId: string | null;
  content: string;
  images: PostImage[];
  createdAt: string;
  likesCount: number;
  retweetsCount: number;
  repliesCount: number;
}

// A row of GET /feed: same counters as Post, plus the author fields the feed
// needs to render a row and Post doesn't carry (posting is always the
// caller, so there is nothing to name there), and whether the caller already
// liked it, which only the server can know and the like button starts from.
export interface FeedItem {
  id: string;
  authorId: string;
  authorHandle: string | null;
  authorDisplayName: string | null;
  authorAvatarUrl: string | null;
  // True when the author's account was deleted. Its replies stay in the thread
  // with their text, and handle, display name and avatar come back null, so
  // those nulls cannot tell this case apart from a profile not synced yet.
  // `authorId` is still there but opening it answers 404.
  authorDeleted: boolean;
  content: string | null;
  images: PostImage[];
  deleted: boolean;
  createdAt: string;
  likesCount: number;
  likedByMe: boolean;
  retweetedByMe: boolean;
  retweetedBy: string | null;
  entryId: string;
  activityAt: string;
  retweetsCount: number;
  repliesCount: number;
}

// GET /posts/{id}: a feed row plus the post it answers, null when it is not a
// reply. The replies listed under it are plain feed rows.
export interface PostDetail extends FeedItem {
  parentId: string | null;
}

// GET /feed's shape, and GET /posts/{id}/replies' too: a fixed page of 20 plus
// an opaque cursor for the next one, null once there is no more — same
// convention as the follow lists.
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
