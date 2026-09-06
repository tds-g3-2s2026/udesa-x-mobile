import {
  AuthResponse,
  AuthTokens,
  RefreshResponse,
  RegisterResponse,
  UserProfile,
} from '../../../types/auth';
import {
  ChangePasswordInput,
  EditProfileInput,
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  VerifyEmailInput,
} from '../schemas/authSchemas';
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

// Wire shape of GET/PATCH /me: display_name is the one field that does not
// match this file's camelCase convention, same quirk as terms_accepted and
// password_confirmation elsewhere in this contract.
interface ProfileResponseBody {
  id: string;
  email: string;
  handle: string;
  display_name: string | null;
  bio: string | null;
}

function toUserProfile(body: ProfileResponseBody): UserProfile {
  return {
    id: body.id,
    email: body.email,
    handle: body.handle,
    displayName: body.display_name,
    bio: body.bio,
  };
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

  // Asks for a reset link. The API answers the same way whether or not the
  // account exists, so there is nothing here to tell the caller apart: the
  // screen shows one generic message either way.
  async forgotPassword(data: ForgotPasswordInput): Promise<void> {
    try {
      await apiClient.post('/auth/forgot-password', { identifier: data.identifier });
    } catch (error) {
      throw toAuthError(error, 'No se pudo pedir el link. Intentalo de nuevo.');
    }
  },

  // password_confirmation travels in snake_case, the same quirk as
  // terms_accepted on register: users-api spells its contract that way.
  // Returns the handle the API reports so the screen can name the account
  // whose password just changed.
  async resetPassword(data: ResetPasswordInput): Promise<{ handle: string }> {
    try {
      const response = await apiClient.post<{ status: string; handle: string }>(
        '/auth/reset-password',
        {
          token: data.token,
          password: data.password,
          password_confirmation: data.passwordConfirmation,
        }
      );
      return { handle: response.data.handle };
    } catch (error) {
      throw toAuthError(error, 'No se pudo cambiar la contraseña. Intentalo de nuevo.');
    }
  },

  // Changes the password of the open session. Lives under /me and not /auth
  // because it is the first endpoint of the service that requires a token: the
  // request interceptor attaches it like on any other authenticated call.
  //
  // On success every session of the account is revoked server-side, including
  // the one that made this call, so the caller has to drop the local session
  // instead of trying to reuse or refresh the token it just spent.
  async changePassword(data: ChangePasswordInput): Promise<void> {
    try {
      await apiClient.post('/me/change-password', {
        current_password: data.currentPassword,
        password: data.password,
        password_confirmation: data.passwordConfirmation,
      });
    } catch (error) {
      throw toAuthError(error, 'No se pudo cambiar la contraseña. Intentalo de nuevo.');
    }
  },

  // Current profile, to prefill the edit form. Requires a token, same as
  // changePassword.
  async getProfile(): Promise<UserProfile> {
    try {
      const response = await apiClient.get<ProfileResponseBody>('/me');
      return toUserProfile(response.data);
    } catch (error) {
      throw toAuthError(error, 'No se pudo cargar tu perfil. Intentalo de nuevo.');
    }
  },

  // PATCH /me is a real partial update on the server — an omitted field is
  // left untouched — but this form always edits both fields together (it
  // loads the current profile with getProfile() first), so it always sends
  // both. Returns the full, sanitized profile the server actually stored,
  // which the caller must display instead of what the user typed (tags and
  // scripts are stripped server-side, so the response is the only source of
  // truth for what was really saved).
  async updateProfile(data: EditProfileInput): Promise<UserProfile> {
    try {
      const response = await apiClient.patch<ProfileResponseBody>('/me', {
        display_name: data.displayName,
        bio: data.bio,
      });
      return toUserProfile(response.data);
    } catch (error) {
      throw toAuthError(error, 'No se pudo actualizar tu perfil. Intentalo de nuevo.');
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
