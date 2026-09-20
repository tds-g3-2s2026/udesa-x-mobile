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
