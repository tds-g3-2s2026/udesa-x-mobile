// A pending ask to follow the current user, aimed at them specifically:
// posts-api's GET /follow-requests only ever returns the caller's own
// incoming requests, never anyone else's.
export interface FollowRequestSummary {
  id: string;
  requesterHandle: string;
  createdAt: string;
}

export type FollowRequestResolution = 'approved' | 'rejected';

// 'pending' is not reachable yet: posts-api still rejects a follow of a
// protected account outright with `follow-needs-approval` instead of
// creating a request, so FollowButton has nowhere to get that state from today.
export type FollowState = 'none' | 'following';
