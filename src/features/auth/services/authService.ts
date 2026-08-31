import axios, { InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { AuthResponse, AuthTokens, RefreshResponse, RegisterResponse } from '../../../types/auth';
import { useAuthStore } from '../../../stores/authStore';
import { LoginInput, RegisterInput, VerifyEmailInput } from '../schemas/authSchemas';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisá tu conexión.';
const UNEXPECTED_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentalo de nuevo.';

// Generic message required by E1-H2.CA3 to avoid user enumeration.
const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';

// T-52: shown when the refresh token is gone or the API rejects it, the only case
// where the user has to sign in again.
const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Iniciá sesión de nuevo.';

// The one path that must never be retried after a 401: a rejected refresh means
// the session is over, and retrying it would loop forever.
const REFRESH_PATH = '/auth/refresh';

// E1-H3.CA2: short-circuits the default 10s client timeout so a slow or
// unreachable backend never delays the local wipe by more than this.
const LOGOUT_TIMEOUT_MS = 3000;

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// RFC 9457 Problem Details, the error shape returned by the platform APIs.
const problemDetailsSchema = z.object({
  title: z.string().optional(),
  detail: z.string().optional(),
});

function readProblemMessage(data: unknown): string | null {
  const parsed = problemDetailsSchema.safeParse(data);
  if (!parsed.success) return null;
  const message = parsed.data.detail?.trim() || parsed.data.title?.trim();
  return message ? message : null;
}

// Turns a transport failure into an error whose message can be shown to the user.
// The message from the API always wins so the screens display the real reason.
function toAuthError(error: unknown, fallbackMessage: string): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) return new Error(CONNECTION_ERROR_MESSAGE);
    return new Error(readProblemMessage(error.response.data) ?? fallbackMessage);
  }
  if (error instanceof Error) return error;
  return new Error(UNEXPECTED_ERROR_MESSAGE);
}

// Resolves the message that the screens show when an auth call fails.
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return UNEXPECTED_ERROR_MESSAGE;
}

export const authService = {
  async login(credentials: LoginInput): Promise<AuthResponse> {
    try {
      const response = await apiClient.post<AuthResponse>('/auth/login', credentials);
      return response.data;
    } catch (error) {
      throw toAuthError(error, INVALID_CREDENTIALS_MESSAGE);
    }
  },

  // E1-H12.CA1/CA2: users-api requires terms_accepted on every register call
  // (validated server-side, must be exactly `true`) and, unlike every other
  // field on this contract, expects it in snake_case: it has no camelCase
  // alias on their side. Kept as its own parameter instead of folding it into
  // RegisterInput so a caller can't send it without deciding it explicitly.
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

  // T-52: trades the long lived refresh token for a fresh pair of tokens.
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    try {
      const response = await apiClient.post<RefreshResponse>(REFRESH_PATH, { refreshToken });
      return response.data.tokens;
    } catch (error) {
      throw toAuthError(error, SESSION_EXPIRED_MESSAGE);
    }
  },

  // E1-H3.CA2: revokes the session's JWT server-side before the caller wipes it
  // from the device. Best effort on purpose: CA.2 only guarantees the local
  // wipe, so a network failure or an already expired token here must never
  // stop the caller from clearing the device.
  async logout(): Promise<void> {
    try {
      await apiClient.post('/auth/logout', undefined, { timeout: LOGOUT_TIMEOUT_MS });
    } catch {
      // Nothing to recover from: the caller clears the local session regardless.
    }
  },
};

// Marks a request that already went out again after a refresh. A second 401 means
// the new access token is not the problem, so there is nothing left to retry.
interface RetriedRequestConfig extends InternalAxiosRequestConfig {
  isRetry?: boolean;
}

// T-52: every call carries the access token of the live session. Reading the store
// at request time means a refresh applies to the next request without rewiring.
apiClient.interceptors.request.use((config) => {
  const accessToken = useAuthStore.getState().accessToken;
  if (accessToken && config.url !== REFRESH_PATH) {
    config.headers.set('Authorization', `Bearer ${accessToken}`);
  }
  return config;
});

// One refresh shared by every request that got a 401 at the same time. Without it
// each one would spend the refresh token, and the losers would drop the session
// that the winner had just renewed.
let pendingRefresh: Promise<AuthTokens> | null = null;

function refreshSession(): Promise<AuthTokens> {
  pendingRefresh ??= (async () => {
    const { refreshToken, setTokens } = useAuthStore.getState();
    if (!refreshToken) throw new Error(SESSION_EXPIRED_MESSAGE);
    const tokens = await authService.refreshToken(refreshToken);
    await setTokens(tokens);
    return tokens;
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

// T-52: a 401 is answered with a refresh and a single replay of the failed request.
// When the refresh itself fails the local session is dropped, which is what sends
// the user back to the login through the guards of the root layout.
apiClient.interceptors.response.use(
  (response) => response,
  async (error: unknown) => {
    if (!axios.isAxiosError(error)) throw error;

    const config = error.config as RetriedRequestConfig | undefined;
    if (
      !config ||
      error.response?.status !== 401 ||
      config.isRetry ||
      config.url === REFRESH_PATH
    ) {
      throw error;
    }

    try {
      await refreshSession();
    } catch {
      // clearSession already dropped the in-memory session; a failure wiping the
      // device must not replace the 401 the caller has to handle.
      await useAuthStore
        .getState()
        .clearSession()
        .catch(() => undefined);
      throw error;
    }

    // The request interceptor reads the token that setTokens just stored, so the
    // replay goes out authenticated without touching the headers here.
    config.isRetry = true;
    return apiClient.request(config);
  }
);
