// A list of accounts its owner put together (E3-H8). posts-api shows it only
// to its owner, and only accounts the owner follows can be in it.
export interface AccountList {
  id: string;
  name: string;
  membersCount: number;
  createdAt: string;
}

// An account inside a list. `handle` is null once the account was closed.
export interface ListMember {
  id: string;
  handle: string | null;
  addedAt: string;
}
