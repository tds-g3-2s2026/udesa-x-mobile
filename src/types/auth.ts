export interface User {
  id: string;
  handle: string;
  email: string;
  fullName: string;
  isVerified: boolean;
  avatarUrl?: string;
  // Editable profile fields. Optional like `avatarUrl`: login and register
  // never return them, only GET/PATCH /me does, so most of the `User`
  // literals in the codebase predate them and have nothing to put here until
  // the store merges a profile response in.
  displayName?: string | null;
  bio?: string | null;
}

// Shape of GET and PATCH /me: the fields a profile edit can read or change,
// plus the identity fields users-api echoes back on every response (handle
// and email are immutable, but the API still confirms them).
export interface UserProfile {
  id: string;
  email: string;
  handle: string;
  displayName: string | null;
  bio: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: User;
  tokens: AuthTokens;
}

// The refresh endpoint only issues a new pair of tokens, the user does not
// change, so the client keeps the one it already restored.
export interface RefreshResponse {
  tokens: AuthTokens;
}

export interface RegisterResponse {
  user: User;
  message: string;
  requireVerification: boolean;
}
