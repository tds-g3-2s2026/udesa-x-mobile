// A pending ask to follow the current user, aimed at them specifically:
// posts-api's GET /follow-requests only ever returns the caller's own
// incoming requests, never anyone else's.
export interface FollowRequestSummary {
  id: string;
  requesterHandle: string;
  createdAt: string;
}

// GET /follow-requests pages the same way the followers lists do.
export interface FollowRequestPage {
  items: FollowRequestSummary[];
  nextCursor: string | null;
}

export type FollowRequestResolution = 'approved' | 'rejected';

// 'pending' is what following a protected account leaves behind: posts-api
// answers 202 and the relationship waits for the owner of that account.
export type FollowState = 'none' | 'following' | 'pending';

// A row in a followers or following list. `following` is whether the caller
// (the token, not the account being listed) already follows this account —
// posts-api includes it so each row's button can be painted without a call
// per row. There is no `pending` here: the API has no way to say a follow
// request to this row is already waiting, so a false `following` always
// starts the button at 'none'.
export interface FollowListItem {
  id: string;
  handle: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  following: boolean;
  createdAt: string;
}

// GET /users/{id}/followers and /following share this shape: a fixed page of
// 20 plus an opaque cursor for the next one, null once there is no more.
export interface FollowListPage {
  items: FollowListItem[];
  nextCursor: string | null;
}

// One row of the blocked-accounts screen. GET /blocks pages the same way the
// followers lists do.
export interface BlockedAccount {
  id: string;
  handle: string | null;
  createdAt: string;
}

export interface BlockedAccountPage {
  items: BlockedAccount[];
  nextCursor: string | null;
}

// GET /users/{id}: the header of another account's profile. `displayName`,
// `bio` and `createdAt` live in users-api and arrive null when posts-api
// could not reach it. `avatarUrl` and `coverUrl` are signed URLs that expire
// after an hour, or null when the account has no photo or no cover.
// `isPrivate` says the account is protected, not whether the caller may read
// it: together with `isFollowedByMe` the screen knows both.
export interface UserProfile {
  id: string;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  createdAt: string | null;
  followersCount: number;
  followingCount: number;
  isPrivate: boolean;
  isFollowedByMe: boolean;
}

// The closed list posts-api accepts: anything else is a 422.
export type ReportReason = 'spam' | 'harassment' | 'inappropriate_content' | 'impersonation';

// Who is reported: an account directly, or a post, which counts against its
// author and lets posts-api keep which post it was. Exactly one of the two.
export type ReportTarget = { userId: string } | { postId: string };
