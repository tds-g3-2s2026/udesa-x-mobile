// A pending ask to follow the current user, aimed at them specifically:
// posts-api's GET /follow-requests only ever returns the caller's own
// incoming requests, never anyone else's.
export interface FollowRequestSummary {
  id: string;
  requesterHandle: string;
  createdAt: string;
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
