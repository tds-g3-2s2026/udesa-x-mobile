import { AuthResponse, AuthTokens, RefreshResponse, RegisterResponse } from '../../../types/auth';
import { LoginInput, RegisterInput, VerifyEmailInput } from '../schemas/authSchemas';
import {
  apiClient,
  getAuthErrorMessage,
  LOGOUT_PATH,
  REFRESH_PATH,
  SESSION_EXPIRED_MESSAGE,
  toAuthError,
} from '../../../api/apiClient';

export { apiClient, getAuthErrorMessage };

// Generic message required to avoid user enumeration.
const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';

// Short-circuits the default 10s client timeout so a slow or unreachable
// backend never delays the local wipe by more than this.
const LOGOUT_TIMEOUT_MS = 3000;

export const authService = {
  async login(credentials: LoginInput): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw toAuthError(error, INVALID_CREDENTIALS_MESSAGE);
    }
  },

  // users-api requires terms_accepted on every register call (validated
  // server-side, must be exactly `true`). It travels in snake_case because
  // that is what users-api actually uses throughout its real contract
  // (access_token, token_type, expires_in, ...) — camelCase is what the local
  // mock and the rest of this file's types use, not the other way around.
  // Kept as its own parameter instead of folding it into RegisterInput so a
  // caller can't send it without deciding it explicitly.
  async register(data: RegisterInput, termsAccepted: boolean): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<RegisterResponse>('/auth/register', {
        ...data,
        terms_accepted: termsAccepted,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo completar el registro. Intentalo de nuevo.');
    }
  },

  async verifyEmail(email: string, data: VerifyEmailInput): Promise<{ verified: boolean }> {
    try {
      const response = await apiClient.post<{ verified: boolean }>('/auth/verify-email', {
        email,
        code: data.code,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'El código es inválido o expiró. Pedí uno nuevo.');
    }
  },

  async resendVerification(email: string): Promise<{ sent: boolean }> {
    try {
      const response = await apiClient.post<{ sent: boolean }>('/auth/resend-verification', {
        email,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo reenviar el código. Intentalo en unos minutos.');
    }
  },

  // Trades the long lived refresh token for a fresh pair of tokens.
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await apiClient.post<RefreshResponse>(REFRESH_PATH, { refreshToken });
      return response.data.tokens;
    } catch (error) {
      throw toAuthError(error, SESSION_EXPIRED_MESSAGE);
    }
  },

  // Revokes the session's JWT server-side before the caller wipes it from the
  // device. Best effort on purpose: the local wipe is guaranteed regardless,
  // so a network failure or an already expired token here must never stop
  // the caller from clearing the device.
  async logout(): Promise<void> {
    try {
      await apiClient.post(LOGOUT_PATH, undefined, { timeout: LOGOUT_TIMEOUT_MS });
    } catch {
      // Nothing to recover from: the caller clears the local session regardless.
    }
  },
};
