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
        authService.register({
          handle: '@joaquin_dev',
          email: 'jleon@udesa.edu.ar',
          fullName: 'Joaquín León',
          password: 'Password123',
        })
      ).rejects.toThrow('El correo ya está registrado');
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
