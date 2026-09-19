import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { followService } from '../../src/features/social/services/followService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { FollowRequestSummary } from '../../src/types/social';

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

function networkFailure(): AxiosError {
  return new AxiosError('Network Error', 'ERR_NETWORK', requestConfig, {});
}

const get = jest.spyOn(postsApiClient, 'get');
const post = jest.spyOn(postsApiClient, 'post');
const del = jest.spyOn(postsApiClient, 'delete');

describe('Follow service', () => {
  afterEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  describe('E3-H1. Seguir a un Usuario', () => {
    it('E3-H1.CA1 - follows a user by their id, not their handle', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined, 204));

      const reached = await followService.follow('usr-2');

      expect(post).toHaveBeenCalledWith('/users/usr-2/follow');
      // 204: the relationship is established, nothing is waiting.
      expect(reached).toBe('following');
    });

    it('E3-H1.CA2 - a 202 means the account is protected and the ask is waiting', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined, 202));

      const reached = await followService.follow('usr-2');

      expect(reached).toBe('pending');
    });

    it('E3-H1.CA3 - propagates the self-follow refusal from the API', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x.dev/errors/cannot-follow-yourself',
          title: 'No se pudo seguir la cuenta',
          detail: 'No podés seguirte a vos mismo',
        })
      );

      await expect(followService.follow('usr-1')).rejects.toMatchObject({
        message: 'No podés seguirte a vos mismo',
        code: 'cannot-follow-yourself',
      });
    });

    it('E3-H1.CA5 - propagates the rate limit reported by the API', async () => {
      post.mockRejectedValueOnce(
        apiFailure(429, {
          type: 'https://udesa-x.dev/errors/too-many-follows',
          title: 'Demasiadas solicitudes de seguimiento',
          detail: 'Alcanzaste el límite de 50 por hora. Probá más tarde.',
        })
      );

      await expect(followService.follow('usr-2')).rejects.toMatchObject({
        message: 'Alcanzaste el límite de 50 por hora. Probá más tarde.',
        code: 'too-many-follows',
      });
    });

    it('unfollows a user with a DELETE to the same route', async () => {
      del.mockResolvedValueOnce(apiSuccess(undefined));

      await followService.unfollow('usr-2');

      expect(del).toHaveBeenCalledWith('/users/usr-2/follow');
    });

    it('reports an unfollow failure with the generic message', async () => {
      del.mockRejectedValueOnce(networkFailure());

      await expect(followService.unfollow('usr-2')).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('E3-H1.CA2 - lists the follow requests aimed at the current user', async () => {
      const requests: FollowRequestSummary[] = [
        { id: 'freq-1', requesterHandle: '@joaquin_dev', createdAt: '2026-09-10T12:00:00Z' },
      ];
      get.mockResolvedValueOnce(apiSuccess(requests));

      const result = await followService.getFollowRequests();

      expect(get).toHaveBeenCalledWith('/follow-requests');
      expect(result).toEqual(requests);
    });

    it('reports a connection failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(followService.getFollowRequests()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('E3-H1.CA2 - approves a request by posting to its approve endpoint', async () => {
      post.mockResolvedValueOnce(apiSuccess({ id: 'freq-1', status: 'approved' }));

      await followService.approveFollowRequest('freq-1');

      expect(post).toHaveBeenCalledWith('/follow-requests/freq-1/approve');
    });

    it('E3-H1.CA2 - rejects a request by posting to its reject endpoint', async () => {
      post.mockResolvedValueOnce(apiSuccess({ id: 'freq-1', status: 'rejected' }));

      await followService.rejectFollowRequest('freq-1');

      expect(post).toHaveBeenCalledWith('/follow-requests/freq-1/reject');
    });

    it('reports a reject failure with the generic message', async () => {
      post.mockRejectedValueOnce(networkFailure());

      await expect(followService.rejectFollowRequest('freq-1')).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('propagates the API message when a request was already resolved', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x.dev/errors/follow-request-already-resolved',
          title: 'Solicitud ya resuelta',
          detail: 'Esta solicitud ya fue aprobada o rechazada.',
        })
      );

      await expect(followService.approveFollowRequest('freq-1')).rejects.toMatchObject({
        message: 'Esta solicitud ya fue aprobada o rechazada.',
        code: 'follow-request-already-resolved',
      });
    });
  });
});
