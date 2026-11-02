import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { muteService } from '../../src/features/social/services/muteService';
import { postsApiClient } from '../../src/api/postsApiClient';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiSuccess<T>(data: T, status = 200): AxiosResponse<T> {
  return { data, status, statusText: 'OK', headers: {}, config: requestConfig };
}

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

describe('Mute service', () => {
  afterEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  describe('E3-H10. Silenciar Usuario', () => {
    it('mutes an account by its id', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await muteService.mute('usr-2');

      expect(post).toHaveBeenCalledWith('/users/usr-2/mute');
    });

    it('shows the server message when muting is refused', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x/problems/cannot-mute-yourself',
          title: 'No se pudo silenciar la cuenta',
          status: 409,
          detail: 'No podés silenciarte a vos mismo',
        })
      );

      await expect(muteService.mute('usr-1')).rejects.toMatchObject({
        message: 'No podés silenciarte a vos mismo',
      });
    });

    it('E3-H10.CA3 - unmutes an account by deleting its mute', async () => {
      del.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await muteService.unmute('usr-2');

      expect(del).toHaveBeenCalledWith('/users/usr-2/mute');
    });

    it('reports an unmute failure with the generic message', async () => {
      del.mockRejectedValueOnce(networkFailure());

      await expect(muteService.unmute('usr-2')).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('E3-H10.CA3 - reads the first page of muted accounts without a cursor', async () => {
      const page = {
        items: [{ id: 'usr-2', handle: '@persona2', createdAt: '2026-10-30T12:00:00Z' }],
        nextCursor: null,
      };
      get.mockResolvedValueOnce(apiSuccess(page));

      const result = await muteService.getMuted();

      expect(get).toHaveBeenCalledWith('/mutes', { params: undefined });
      expect(result).toEqual(page);
    });

    it('asks for the next page of muted accounts with the cursor it was given', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }));

      await muteService.getMuted('abc');

      expect(get).toHaveBeenCalledWith('/mutes', { params: { cursor: 'abc' } });
    });

    it('reports a load failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(muteService.getMuted()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });
  });
});
