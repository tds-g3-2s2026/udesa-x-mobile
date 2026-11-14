import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { listService } from '../../src/features/lists/services/listService';
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

const taller = {
  id: 'lst-1',
  name: 'Taller',
  membersCount: 2,
  createdAt: '2026-11-12T12:00:00Z',
};

describe('List service', () => {
  afterEach(() => {
    get.mockReset();
    post.mockReset();
    del.mockReset();
  });

  describe('E3-H8. Listas Personalizadas', () => {
    it('reads the lists of the caller', async () => {
      get.mockResolvedValueOnce(apiSuccess([taller]));

      expect(await listService.getLists()).toEqual([taller]);
      expect(get).toHaveBeenCalledWith('/lists');
    });

    it('creates a list with its name', async () => {
      post.mockResolvedValueOnce(apiSuccess({ ...taller, membersCount: 0 }, 201));

      const created = await listService.createList('Taller');

      expect(post).toHaveBeenCalledWith('/lists', { name: 'Taller' });
      expect(created.id).toBe('lst-1');
    });

    it('shows the server message when the caller already has twenty lists', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x/problems/too-many-lists',
          title: 'No se pudo crear la lista',
          status: 422,
          detail: 'Podés tener hasta 20 listas',
        })
      );

      await expect(listService.createList('Otra')).rejects.toMatchObject({
        message: 'Podés tener hasta 20 listas',
      });
    });

    it('E3-H8.CA1 - adds and takes out an account by the ids of the list and the account', async () => {
      post.mockResolvedValueOnce(apiSuccess(undefined, 204));
      del.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await listService.addMember('lst-1', 'usr-2');
      await listService.removeMember('lst-1', 'usr-2');

      expect(post).toHaveBeenCalledWith('/lists/lst-1/members/usr-2');
      expect(del).toHaveBeenCalledWith('/lists/lst-1/members/usr-2');
    });

    it('shows why an account the caller does not follow cannot be added', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x/problems/not-following',
          title: 'No se pudo sumar la cuenta',
          status: 409,
          detail: 'Solo podés sumar cuentas que seguís',
        })
      );

      await expect(listService.addMember('lst-1', 'usr-9')).rejects.toMatchObject({
        message: 'Solo podés sumar cuentas que seguís',
      });
    });

    it('reads the members of a list', async () => {
      const members = [{ id: 'usr-2', handle: '@ana', addedAt: '2026-11-12T13:00:00Z' }];
      get.mockResolvedValueOnce(apiSuccess(members));

      expect(await listService.getMembers('lst-1')).toEqual(members);
      expect(get).toHaveBeenCalledWith('/lists/lst-1/members');
    });

    it('E3-H8.CA4 - deletes a list by its id', async () => {
      del.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await listService.deleteList('lst-1');

      expect(del).toHaveBeenCalledWith('/lists/lst-1');
    });

    it('E3-H8.CA2 - reads the feed of a list, and its next page with the cursor', async () => {
      get.mockResolvedValue(apiSuccess({ items: [], nextCursor: null }));

      await listService.getFeed('lst-1');
      await listService.getFeed('lst-1', 'abc');

      expect(get).toHaveBeenNthCalledWith(1, '/lists/lst-1/feed', { params: undefined });
      expect(get).toHaveBeenNthCalledWith(2, '/lists/lst-1/feed', { params: { cursor: 'abc' } });
    });

    it('reports a failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(listService.getLists()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it.each([
      ['getMembers', () => listService.getMembers('lst-1')],
      ['getFeed', () => listService.getFeed('lst-1')],
      ['deleteList', () => listService.deleteList('lst-1')],
      ['removeMember', () => listService.removeMember('lst-1', 'usr-2')],
    ])('%s says what failed when the server does not answer with a reason', async (_, call) => {
      const failure = apiFailure(500, 'Internal Server Error');
      get.mockRejectedValueOnce(failure);
      del.mockRejectedValueOnce(failure);

      await expect(call()).rejects.toMatchObject({ message: expect.stringMatching(/^No se pud/) });
    });
  });
});
