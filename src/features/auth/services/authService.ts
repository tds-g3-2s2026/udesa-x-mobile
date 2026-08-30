import axios from 'axios';
import { z } from 'zod';
import { AuthResponse, RegisterResponse } from '../../../types/auth';
import { LoginInput, RegisterInput, VerifyEmailInput } from '../schemas/authSchemas';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

const CONNECTION_ERROR_MESSAGE = 'No se pudo conectar con el servidor. Revisá tu conexión.';
const UNEXPECTED_ERROR_MESSAGE = 'Ocurrió un error inesperado. Intentalo de nuevo.';

// Generic message required by E1-H2.CA3 to avoid user enumeration.
const INVALID_CREDENTIALS_MESSAGE = 'Credenciales inválidas';

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

  async register(data: RegisterInput): Promise<RegisterResponse> {
    try {
      const response = await apiClient.post<RegisterResponse>('/auth/register', data);
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
};
