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

export interface RegisterResponse {
  user: User;
  message: string;
  requireVerification: boolean;
}
