import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { apiClient, authService } from '../../src/features/auth/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { AuthTokens, User } from '../../src/types/auth';

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const user: User = {
  id: 'usr-1',
  handle: '@joaquin_dev',
  email: 'jleon@udesa.edu.ar',
  fullName: 'Joaquín León',
  isVerified: true,
};

const renewed: AuthTokens = {
  accessToken: 'access-token-2',
  refreshToken: 'refresh-token-2',
};

function apiSuccess<T>(config: InternalAxiosRequestConfig, data: T): AxiosResponse<T> {
  return { data, status: 200, statusText: 'OK', headers: {}, config };
}

// 401 with an RFC 9457 Problem Details body, the error shape of the platform APIs.
function unauthorized(config: InternalAxiosRequestConfig): AxiosError {
  const response: AxiosResponse<unknown> = {
    data: { title: 'Token expirado', detail: 'El access token expiró.' },
    status: 401,
    statusText: '',
    headers: {},
    config,
  };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, {}, response);
}

// Only the transport is replaced: the interceptors of apiClient run for real, so
// these tests see exactly the requests the app would put on the wire.
const adapter = jest.fn<Promise<AxiosResponse>, [InternalAxiosRequestConfig]>();
apiClient.defaults.adapter = adapter;

function requestsTo(url: string): InternalAxiosRequestConfig[] {
  return adapter.mock.calls.map(([config]) => config).filter((config) => config.url === url);
}

function authorizationOf(call: number): unknown {
  return new AxiosHeaders(adapter.mock.calls[call][0].headers).get('Authorization');
}

beforeEach(() => {
  adapter.mockReset();
  jest.clearAllMocks();
  useAuthStore.setState({
    user,
    accessToken: 'access-token-1',
    refreshToken: 'refresh-token-1',
    isInitialized: true,
  });
});

describe('T-52. Interceptores de Axios', () => {
  it('T-52 - every request carries the access token of the live session', async () => {
    adapter.mockImplementation((config) => Promise.resolve(apiSuccess(config, { items: [] })));

    await apiClient.get('/feed');

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(authorizationOf(0)).toBe('Bearer access-token-1');
  });

  it('T-52 - a 401 renews the tokens and the failed request goes out again', async () => {
    const failed = new Set<string>();
    adapter.mockImplementation((config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') return Promise.resolve(apiSuccess(config, { tokens: renewed }));
      if (!failed.has(url)) {
        failed.add(url);
        return Promise.reject(unauthorized(config));
      }
      return Promise.resolve(apiSuccess(config, { items: ['post-1'] }));
    });

    const response = await apiClient.get<{ items: string[] }>('/feed');

    expect(response.data.items).toEqual(['post-1']);
    expect(adapter).toHaveBeenCalledTimes(3);
    // The refresh travels with the refresh token in the body, never with the
    // expired access token in the header.
    expect(requestsTo('/auth/refresh')[0].data).toBe(
      JSON.stringify({ refreshToken: 'refresh-token-1' })
    );
    expect(authorizationOf(1)).toBeUndefined();
    // The replay is authenticated with the token the refresh just issued.
    expect(authorizationOf(2)).toBe(`Bearer ${renewed.accessToken}`);

    const state = useAuthStore.getState();
    expect(state.accessToken).toBe(renewed.accessToken);
    expect(state.refreshToken).toBe(renewed.refreshToken);
    // A refresh is not a new sign-in: the user stays exactly as it was.
    expect(state.user).toEqual(user);
  });

  it('T-52 - requests that fail at the same time share a single refresh', async () => {
    const failed = new Set<string>();
    adapter.mockImplementation((config) => {
      const url = String(config.url);
      if (url === '/auth/refresh') return Promise.resolve(apiSuccess(config, { tokens: renewed }));
      if (!failed.has(url)) {
        failed.add(url);
        return Promise.reject(unauthorized(config));
      }
      return Promise.resolve(apiSuccess(config, { ok: true }));
    });

    await Promise.all([apiClient.get('/feed'), apiClient.get('/notifications')]);

    // Two refreshes would spend the refresh token twice and the loser would drop
    // the session the winner had just renewed.
    expect(requestsTo('/auth/refresh')).toHaveLength(1);
  });

  it('T-52 - a rejected refresh clears the session and reports the original error', async () => {
    adapter.mockImplementation((config) => Promise.reject(unauthorized(config)));

    await expect(apiClient.get('/feed')).rejects.toMatchObject({
      response: { status: 401 },
    });

    // One 401, one refresh attempt, and nothing else: no retry loop.
    expect(adapter).toHaveBeenCalledTimes(2);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_refresh_token');
  });

  it('T-52 - a 401 without a stored refresh token ends the session right away', async () => {
    useAuthStore.setState({ refreshToken: null });
    adapter.mockImplementation((config) => Promise.reject(unauthorized(config)));

    await expect(apiClient.get('/feed')).rejects.toBeInstanceOf(AxiosError);

    // There is nothing to refresh with, so the endpoint is never called.
    expect(adapter).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('T-52 - a 401 on the refresh endpoint is never refreshed again', async () => {
    adapter.mockImplementation((config) => Promise.reject(unauthorized(config)));

    await expect(authService.refreshToken('refresh-token-1')).rejects.toThrow(
      'El access token expiró.'
    );

    expect(adapter).toHaveBeenCalledTimes(1);
    // The caller of refreshToken decides what to do: this path must not wipe the
    // session behind its back.
    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('E1-H3.CA2 - a 401 on logout is never refreshed or retried', async () => {
    adapter.mockImplementation((config) => Promise.reject(unauthorized(config)));

    // authService.logout is best effort and swallows this itself; what this
    // test guards is that the interceptor never turns it into a refresh call.
    await authService.logout();

    expect(adapter).toHaveBeenCalledTimes(1);
    expect(requestsTo('/auth/refresh')).toHaveLength(0);
  });
});
