export interface User {
  id: string;
  handle: string;
  email: string;
  // Always true for a session that exists at all: login itself refuses an
  // unverified account (403 account-not-verified), so reaching this point
  // already proves it.
  isVerified: boolean;
  avatarUrl?: string;
  // Editable profile fields, absent until the owner sets them. Optional like
  // `avatarUrl` so the many `User` literals across the codebase that predate
  // them keep compiling.
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

export type ProfileVisibility = 'public' | 'protected';
export type FeedLanguage = 'es' | 'en' | 'all';

// Shape of GET and PATCH /me/preferences. Both fields always have a value —
// unlike bio, neither has an "empty" state to fall back to.
export interface UserPreferences {
  profileVisibility: ProfileVisibility;
  feedLanguage: FeedLanguage;
}

export interface AuthTokens {
  accessToken: string;
  // Absent for now: users-api issues only a short-lived access token and has
  // no refresh endpoint yet (tracked as its own issue there). The interceptor
  // already treats a missing refresh token as "nothing to refresh with" and
  // signs the session out on the next 401, which is the correct behavior
  // until that endpoint exists.
  refreshToken?: string;
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

// users-api's actual response to POST /auth/register: the account is always
// created unverified, with no branch where it is not, so there is nothing
// else to report back.
export interface RegisterResponse {
  id: string;
  email: string;
  handle: string;
}
