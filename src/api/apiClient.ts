import axios, { InternalAxiosRequestConfig } from 'axios';
import { z } from 'zod';
import { AuthTokens, RefreshResponse } from '../types/auth';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisá tu conexión.';
const UNEXPECTED_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentalo de nuevo.';
export const SESSION_EXPIRED_MESSAGE = 'Tu sesión expiró. Iniciá sesión de nuevo.';

// The one path that must never be retried after a 401: a rejected refresh means
// the session is over, and retrying it would loop forever.
export const REFRESH_PATH = '/auth/refresh';

// Also never retried after a 401: refreshing and replaying it would spend the
// refresh call's timeout plus this one's, on a request whose caller already
// treats failure as best effort and is about to clear the local session
// regardless of the outcome.
export const LOGOUT_PATH = '/auth/logout';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

// RFC 9457 Problem Details, the error shape returned by the platform APIs.
// The failure is identified by `type`, a URI whose last segment names it;
// there is no separate `code` field. `errors` carries one entry per rejected
// field on a 422.
const problemDetailsSchema = z.object({
  type: z.string().optional(),
  title: z.string().optional(),
  detail: z.string().optional(),
  errors: z.array(z.object({ field: z.string(), message: z.string() })).optional(),
});

// 'https://udesa-x.dev/errors/reset-token-invalid' -> 'reset-token-invalid'.
// RFC 9457 uses 'about:blank' when there is nothing to identify beyond the
// status, which is why this can come back empty.
function readProblemCode(type: string | undefined): string | undefined {
  if (!type || type === 'about:blank') return undefined;
  const identifier = type.split('/').pop()?.trim();
  return identifier || undefined;
}

/**
 * Failure of an API call, with the machine readable parts of the Problem
 * Details kept next to the message. A screen that only needs something to show
 * the user can keep reading `message` and ignore the rest.
 */
export class ApiError extends Error {
  // Last segment of the Problem Details `type`, e.g. 'reset-token-invalid':
  // lets a screen offer the matching recovery without matching on prose.
  readonly code?: string;
  // Field name as the API spells it, mapped to its message.
  readonly fieldErrors: Record<string, string>;

  constructor(message: string, code?: string, fieldErrors: Record<string, string> = {}) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

// Turns a transport failure into an error whose message can be shown to the user.
// The message from the API always wins so the screens display the real reason.
export function toAuthError(error: unknown, fallbackMessage: string): Error {
  if (axios.isAxiosError(error)) {
    if (!error.response) return new ApiError(CONNECTION_ERROR_MESSAGE);

    const parsed = problemDetailsSchema.safeParse(error.response.data);
    if (!parsed.success) return new ApiError(fallbackMessage);

    const { type, detail, title, errors } = parsed.data;
    const fieldErrors: Record<string, string> = {};
    for (const entry of errors ?? []) {
      // The first message per field is the one shown: later ones would only
      // replace it in the single line the input has for it.
      fieldErrors[entry.field] ??= entry.message;
    }

    const message = detail?.trim() || title?.trim() || fallbackMessage;
    return new ApiError(message, readProblemCode(type), fieldErrors);
  }
  if (error instanceof Error) return error;
  return new ApiError(UNEXPECTED_ERROR_MESSAGE);
}

// Resolves the message that the screens show when an auth call fails.
export function getAuthErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) return error.message;
  return UNEXPECTED_ERROR_MESSAGE;
}

// Marks a request that already went out again after a refresh. A second 401 means
// the new access token is not the problem, so there is nothing left to retry.
interface RetriedRequestConfig extends InternalAxiosRequestConfig {
  isRetry?: boolean;
}

// Every call carries the access token of the live session. Reading the store
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
    const response = await apiClient.post<RefreshResponse>(REFRESH_PATH, { refreshToken });
    await setTokens(response.data.tokens);
    return response.data.tokens;
  })().finally(() => {
    pendingRefresh = null;
  });
  return pendingRefresh;
}

// A 401 is answered with a refresh and a single replay of the failed request.
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
      config.url === REFRESH_PATH ||
      config.url === LOGOUT_PATH
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
