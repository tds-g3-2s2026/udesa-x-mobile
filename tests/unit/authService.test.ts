import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { apiClient, authService } from '../../src/features/auth/services/authService';
import { AuthResponse } from '../../src/types/auth';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiSuccess<T>(data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config: requestConfig };
}

// Failure with an RFC 9457 Problem Details body, the error shape of the platform APIs.
function apiFailure(status: number, data: unknown): AxiosError {
  const response: AxiosResponse<unknown> = {
    data,
    status,
    statusText: '',
    headers: {},
    config: requestConfig,
  };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', requestConfig, {}, response);
}

function networkFailure(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', requestConfig, {});
}

const session: AuthResponse = {
  user: {
    id: 'usr-1',
    handle: '@joaquin_dev',
    email: 'jleon@udesa.edu.ar',
    fullName: 'Joaquín León',
    isVerified: true,
  },
  tokens: {
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
  },
};

const post = jest.spyOn(apiClient, 'post');

describe('Auth service', () => {
  afterEach(() => {
    post.mockReset();
  });

  describe('E1-H2. Inicio de Sesión', () => {
    it('E1-H2.CA1 - returns the tokens issued by the API for valid credentials', async () => {
      post.mockResolvedValueOnce(apiSuccess(session));

      const result = await authService.login({
        identifier: '@joaquin_dev',
        password: 'Password123',
      });

      expect(post).toHaveBeenCalledWith('/auth/login', {
        identifier: '@joaquin_dev',
        password: 'Password123',
      });
      expect(result.tokens).toEqual(session.tokens);
      expect(result.user).toEqual(session.user);
    });

    it('E1-H2.CA3 - fails with the generic message returned by the API', async () => {
      post.mockRejectedValueOnce(apiFailure(401, { detail: 'Credenciales inválidas' }));

      await expect(
        authService.login({ identifier: '@joaquin_dev', password: 'WrongPass1' })
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('E1-H2.CA3 - falls back to the generic message when the API sends no detail', async () => {
      post.mockRejectedValueOnce(apiFailure(401, ''));

      await expect(
        authService.login({ identifier: '@joaquin_dev', password: 'WrongPass1' })
      ).rejects.toThrow('Credenciales inválidas');
    });

    it('E1-H2.CA3 - reports the connection failure instead of returning a fake session', async () => {
      post.mockRejectedValueOnce(networkFailure());

      await expect(
        authService.login({ identifier: '@joaquin_dev', password: 'Password123' })
      ).rejects.toThrow('No se pudo conectar con el servidor. Revisá tu conexión.');
    });
  });

  describe('E1-H1. Registro de Usuarios', () => {
    it('E1-H1.CA2 - propagates the duplicated email error reported by the API', async () => {
      post.mockRejectedValueOnce(apiFailure(409, { detail: 'El correo ya está registrado' }));

      await expect(
        authService.register(
          {
            handle: '@joaquin_dev',
            email: 'jleon@udesa.edu.ar',
            fullName: 'Joaquín León',
            password: 'Password123',
          },
          true
        )
      ).rejects.toThrow('El correo ya está registrado');
    });

    it('E1-H12.CA2 - sends terms_accepted in snake_case, matching the users-api contract', async () => {
      post.mockResolvedValueOnce(
        apiSuccess({ user: session.user, message: 'Registro exitoso', requireVerification: true })
      );

      await authService.register(
        {
          handle: '@joaquin_dev',
          email: 'jleon@udesa.edu.ar',
          fullName: 'Joaquín León',
          password: 'Password123',
        },
        true
      );

      expect(post).toHaveBeenCalledWith('/auth/register', {
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        password: 'Password123',
        terms_accepted: true,
      });
    });

    it('E1-H1.CA6 - propagates the expired verification code error reported by the API', async () => {
      post.mockRejectedValueOnce(apiFailure(400, { detail: 'El código expiró' }));

      await expect(
        authService.verifyEmail('jleon@udesa.edu.ar', { code: '123456' })
      ).rejects.toThrow('El código expiró');
    });

    it('E1-H1.CA6 - requests a new verification code from the API', async () => {
      post.mockResolvedValueOnce(apiSuccess({ sent: true }));

      const result = await authService.resendVerification('jleon@udesa.edu.ar');

      expect(post).toHaveBeenCalledWith('/auth/resend-verification', {
        email: 'jleon@udesa.edu.ar',
      });
      expect(result.sent).toBe(true);
    });
  });

  describe('E1-H5. Olvidé Mi Contraseña', () => {
    it('E1-H5.CA4 - asks for the link with the identifier, as the API names it', async () => {
      post.mockResolvedValueOnce(apiSuccess({ status: 'accepted' }));

      await authService.forgotPassword({ identifier: 'jleon@udesa.edu.ar' });

      expect(post).toHaveBeenCalledWith('/auth/forgot-password', {
        identifier: 'jleon@udesa.edu.ar',
      });
    });

    it('E1-H5.CA3 - sends password_confirmation in snake_case, matching the contract', async () => {
      post.mockResolvedValueOnce(apiSuccess({ status: 'reset', handle: '@joaquin_dev' }));

      const result = await authService.resetPassword({
        token: 'reset-token-1',
        password: 'Password123',
        passwordConfirmation: 'Password123',
      });

      expect(post).toHaveBeenCalledWith('/auth/reset-password', {
        token: 'reset-token-1',
        password: 'Password123',
        password_confirmation: 'Password123',
      });
      expect(result.handle).toBe('@joaquin_dev');
    });

    // The bodies below are the real ones users-api returns, verified against
    // the running service: the failure is identified by the last segment of
    // `type` and there is no `code` field. Reading a `code` looked right and
    // passed against a mock that invented one, so these keep that from
    // happening again.
    it('E1-H5.CA2 - identifies an expired link by its type, so the screen can offer a new one', async () => {
      post.mockRejectedValueOnce(
        apiFailure(400, {
          type: 'https://udesa-x.dev/errors/reset-token-invalid',
          title: 'No se pudo cambiar la contraseña',
          status: 400,
          detail: 'El link de recuperación es inválido o expiró. Pedí uno nuevo',
          traceId: 'd85b2aed',
          instance: '/auth/reset-password',
        })
      );

      await expect(
        authService.resetPassword({
          token: 'expired-token',
          password: 'Password123',
          passwordConfirmation: 'Password123',
        })
      ).rejects.toMatchObject({
        code: 'reset-token-invalid',
        message: 'El link de recuperación es inválido o expiró. Pedí uno nuevo',
      });
    });

    it('E1-H5.CA6 - identifies the reuse of the current password by its type', async () => {
      post.mockRejectedValueOnce(
        apiFailure(400, {
          type: 'https://udesa-x.dev/errors/password-unchanged',
          detail: 'La contraseña nueva tiene que ser distinta de la actual',
        })
      );

      await expect(
        authService.resetPassword({
          token: 'reset-token-1',
          password: 'Password123',
          passwordConfirmation: 'Password123',
        })
      ).rejects.toMatchObject({ code: 'password-unchanged' });
    });

    it('E1-H5.CA3 - keeps the rejected fields of a 422 so the screen can mark the input', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x.dev/errors/validation-failed',
          detail: 'Revisá los campos marcados.',
          errors: [
            {
              field: 'password_confirmation',
              message: 'Value error, Las contraseñas no coinciden',
            },
          ],
        })
      );

      await expect(
        authService.resetPassword({
          token: 'reset-token-1',
          password: 'Password123',
          passwordConfirmation: 'Password124',
        })
      ).rejects.toMatchObject({
        fieldErrors: {
          password_confirmation: 'Value error, Las contraseñas no coinciden',
        },
      });
    });

    it('E1-H5.CA8 - propagates the rate limit message reported by the API', async () => {
      post.mockRejectedValueOnce(
        apiFailure(429, {
          type: 'https://udesa-x.dev/errors/too-many-reset-requests',
          detail: 'Se pidieron demasiados links de recuperación. Esperá 60 minutos',
        })
      );

      await expect(
        authService.forgotPassword({ identifier: 'jleon@udesa.edu.ar' })
      ).rejects.toThrow('Se pidieron demasiados links de recuperación. Esperá 60 minutos');
    });

    it('leaves the code empty when the API identifies nothing beyond the status', async () => {
      // 'about:blank' is what RFC 9457 uses when there is no specific type,
      // and it must not be mistaken for an error identifier.
      post.mockRejectedValueOnce(
        apiFailure(400, { type: 'about:blank', detail: 'Algo salió mal' })
      );

      await expect(
        authService.resetPassword({
          token: 'reset-token-1',
          password: 'Password123',
          passwordConfirmation: 'Password123',
        })
      ).rejects.toMatchObject({ code: undefined, message: 'Algo salió mal' });
    });
  });

  describe('E1-H13. Cambiar Contraseña', () => {
    const change = {
      currentPassword: 'Vieja1234',
      password: 'Nueva1234',
      passwordConfirmation: 'Nueva1234',
    };

    it('E1-H13.CA1 - pega a /me/change-password con los tres campos en snake_case', async () => {
      post.mockResolvedValueOnce(apiSuccess({ status: 'changed' }));

      await authService.changePassword(change);

      // Va bajo /me y no /auth, y es el primer endpoint que exige token.
      expect(post).toHaveBeenCalledWith('/me/change-password', {
        current_password: 'Vieja1234',
        password: 'Nueva1234',
        password_confirmation: 'Nueva1234',
      });
    });

    it('E1-H13.CA4 - la contraseña actual equivocada llega como error de campo, no de sesión', async () => {
      // Es 400 y no 401 a propósito: con un 401 el interceptor lo leería como
      // sesión vencida y sacaría al usuario de la app por un error de tipeo.
      post.mockRejectedValueOnce(
        apiFailure(400, {
          type: 'https://udesa-x.dev/errors/invalid-current-password',
          detail: 'La contraseña actual no es correcta',
        })
      );

      await expect(authService.changePassword(change)).rejects.toMatchObject({
        code: 'invalid-current-password',
        message: 'La contraseña actual no es correcta',
      });
    });

    it('E1-H13.CA4 - el límite de intentos trae su propio identificador, distinto al del login', async () => {
      post.mockRejectedValueOnce(
        apiFailure(429, {
          type: 'https://udesa-x.dev/errors/too-many-password-attempts',
          detail:
            'Erraste la contraseña actual demasiadas veces. Volvé a intentar el cambio en 15 minutos',
        })
      );

      await expect(authService.changePassword(change)).rejects.toMatchObject({
        // No es `too-many-attempts`: ese es el lockout de login, que sí bloquea
        // la entrada. Este contador es separado y no impide iniciar sesión.
        code: 'too-many-password-attempts',
      });
    });

    it('E1-H13.CA3 - la sesión revocada llega identificada para poder mandar al login', async () => {
      post.mockRejectedValueOnce(
        apiFailure(401, {
          type: 'https://udesa-x.dev/errors/session-revoked',
          detail: 'Tu sesión se cerró. Iniciá sesión de nuevo',
        })
      );

      await expect(authService.changePassword(change)).rejects.toMatchObject({
        code: 'session-revoked',
      });
    });
  });

  describe('E1-H3. Cierre de Sesión', () => {
    it('E1-H3.CA2 - requests the revocation of the active session token with a short timeout', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined));

      await authService.logout();

      expect(post).toHaveBeenCalledWith('/auth/logout', undefined, { timeout: 3000 });
    });

    it('E1-H3.CA2 - resolves without throwing when the API rejects the logout call', async () => {
      post.mockRejectedValueOnce(apiFailure(401, { detail: 'invalid-token' }));

      await expect(authService.logout()).resolves.toBeUndefined();
    });

    it('E1-H3.CA2 - resolves without throwing when the backend is unreachable', async () => {
      post.mockRejectedValueOnce(networkFailure());

      await expect(authService.logout()).resolves.toBeUndefined();
    });
  });

  describe('T-52. Refresco de token', () => {
    it('T-52 - trades the refresh token for the new pair issued by the API', async () => {
      post.mockResolvedValueOnce(
        apiSuccess({ tokens: { accessToken: 'new-access', refreshToken: 'new-refresh' } })
      );

      const tokens = await authService.refreshToken('jwt-refresh-token');

      expect(post).toHaveBeenCalledWith('/auth/refresh', {
        refreshToken: 'jwt-refresh-token',
      });
      expect(tokens).toEqual({ accessToken: 'new-access', refreshToken: 'new-refresh' });
    });

    it('T-52 - propagates the rejection of the refresh token reported by the API', async () => {
      post.mockRejectedValueOnce(apiFailure(401, { detail: 'El refresh token no es válido' }));

      await expect(authService.refreshToken('expired-refresh-token')).rejects.toThrow(
        'El refresh token no es válido'
      );
    });

    it('T-52 - falls back to its own message when the API sends no detail', async () => {
      post.mockRejectedValueOnce(apiFailure(401, ''));

      await expect(authService.refreshToken('expired-refresh-token')).rejects.toThrow(
        'Tu sesión expiró. Iniciá sesión de nuevo.'
      );
    });
  });
});
