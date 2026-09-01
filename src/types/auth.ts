export interface User {
  id: string;
  handle: string;
  email: string;
  fullName: string;
  isVerified: boolean;
  avatarUrl?: string;
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
