import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  PRIVATE_ACCOUNT_CODE,
  profileService,
} from '../../src/features/social/services/profileService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { ApiError } from '../../src/api/apiClient';
import { UserProfile } from '../../src/types/social';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiSuccess<T>(data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config: requestConfig };
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

const profile: UserProfile = {
  id: 'usr-2',
  handle: '@ana',
  displayName: 'Ana Pérez',
  bio: 'Estudio en la UdeSA',
  avatarUrl: null,
  coverUrl: null,
  createdAt: '2026-09-01T12:00:00Z',
  followersCount: 10,
  followingCount: 3,
  isPrivate: false,
  isFollowedByMe: false,
};

const get = jest.spyOn(postsApiClient, 'get');

describe('Profile service', () => {
  afterEach(() => {
    get.mockReset();
  });

  describe('E2-H14. Visualización de Perfil de Usuario', () => {
    it('E2-H14.CA1 - reads the header of another account by its id', async () => {
      get.mockResolvedValueOnce(apiSuccess(profile));

      const read = await profileService.getProfile('usr-2');

      expect(get).toHaveBeenCalledWith('/users/usr-2');
      expect(read).toEqual(profile);
    });

    it('E2-H14.CA2 - reads the posts of the account starting from the newest page', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }));

      await profileService.getPosts('usr-2');

      expect(get).toHaveBeenCalledWith('/users/usr-2/posts', { params: undefined });
    });

    it('E2-H14.CA4 - sends the cursor back as-is for the next page of twenty', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }));

      await profileService.getPosts('usr-2', 'cursor-1');

      expect(get).toHaveBeenCalledWith('/users/usr-2/posts', { params: { cursor: 'cursor-1' } });
    });

    it('E2-H14.CA3 - keeps the code of a protected account the caller does not follow', async () => {
      get.mockRejectedValueOnce(
        apiFailure(403, {
          type: 'https://udesa-x.dev/errors/account-is-private',
          title: 'No se pudieron obtener las publicaciones',
          status: 403,
          detail: 'Esta cuenta es protegida y no la seguís',
        })
      );

      const failure = profileService.getPosts('usr-2');

      await expect(failure).rejects.toBeInstanceOf(ApiError);
      await expect(failure).rejects.toMatchObject({ code: PRIVATE_ACCOUNT_CODE });
    });

    it('shows the message of the API when the account does not exist', async () => {
      get.mockRejectedValueOnce(
        apiFailure(404, {
          type: 'https://udesa-x.dev/errors/user-not-found',
          title: 'No se pudo obtener el perfil',
          status: 404,
          detail: 'La cuenta no existe',
        })
      );

      await expect(profileService.getProfile('usr-9')).rejects.toThrow('La cuenta no existe');
    });
  });
});
