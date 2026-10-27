import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { blockService } from '../../src/features/social/services/blockService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { searchQueryClient } from '../../src/features/search/queryClient';
import { useAuthStore } from '../../src/stores/authStore';

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

describe('Block service', () => {
  afterEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
    searchQueryClient.clear();
  });

  describe('E3-H4. Bloquear Usuario', () => {
    it('blocks an account by its id', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await blockService.block('usr-2');

      expect(post).toHaveBeenCalledWith('/users/usr-2/block');
    });

    it('does not update another account search cache when a pending block finishes after sign-in changes', async () => {
      useAuthStore.setState({
        user: { id: 'viewer-a', handle: '@a', email: 'a@example.com', isVerified: true },
      });
      const key = ['search', 'viewer-b', 'users', 'target'];
      const data = { pages: [{ items: [{ id: 'usr-2' }], nextCursor: null }], pageParams: [null] };
      searchQueryClient.setQueryData(key, data);
      let finish!: (response: AxiosResponse<void>) => void;
      post.mockReturnValueOnce(new Promise((resolve) => (finish = resolve)));

      const pendingBlock = blockService.block('usr-2');
      useAuthStore.setState({ user: null });
      searchQueryClient.clear();
      useAuthStore.setState({
        user: { id: 'viewer-b', handle: '@b', email: 'b@example.com', isVerified: true },
      });
      searchQueryClient.setQueryData(key, data);
      finish(apiSuccess(undefined, 204));
      await pendingBlock;

      expect(searchQueryClient.getQueryData(key)).toEqual(data);
      expect(searchQueryClient.getQueryState(key)?.isInvalidated).toBe(false);
      useAuthStore.setState({ user: null });
    });

    it('shows the server message when blocking is refused', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x/problems/cannot-block-yourself',
          title: 'No se pudo bloquear la cuenta',
          status: 409,
          detail: 'No podés bloquearte a vos mismo',
        })
      );

      await expect(blockService.block('usr-1')).rejects.toMatchObject({
        message: 'No podés bloquearte a vos mismo',
      });
    });

    it('E3-H4.CA2 - unblocks an account by deleting its block', async () => {
      del.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await blockService.unblock('usr-2');

      expect(del).toHaveBeenCalledWith('/users/usr-2/block');
    });

    it('reports an unblock failure with the generic message', async () => {
      del.mockRejectedValueOnce(networkFailure());

      await expect(blockService.unblock('usr-2')).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('E3-H4.CA2 - reads the first page of blocked accounts without a cursor', async () => {
      const page = {
        items: [{ id: 'usr-2', handle: '@persona2', createdAt: '2026-09-27T12:00:00Z' }],
        nextCursor: null,
      };
      get.mockResolvedValueOnce(apiSuccess(page));

      const result = await blockService.getBlocked();

      expect(get).toHaveBeenCalledWith('/blocks', { params: undefined });
      expect(result).toEqual(page);
    });

    it('asks for the next page of blocked accounts with the cursor it was given', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }));

      await blockService.getBlocked('abc');

      expect(get).toHaveBeenCalledWith('/blocks', { params: { cursor: 'abc' } });
    });

    it('reports a load failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(blockService.getBlocked()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });
  });
});
