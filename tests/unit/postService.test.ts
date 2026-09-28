import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { postService } from '../../src/features/posts/services/postService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { FeedItem, Post, SuggestedAccount } from '../../src/types/post';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiSuccess<T>(data: T, status = 201): AxiosResponse<T> {
  return { data, status, statusText: 'Created', headers: {}, config: requestConfig };
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

const post = jest.spyOn(postsApiClient, 'post');
const get = jest.spyOn(postsApiClient, 'get');

describe('Post service', () => {
  afterEach(() => {
    post.mockReset();
    get.mockReset();
  });

  describe('E2-H1. Crear Post', () => {
    it('E2-H1.CA4 - posts the content and returns the created post as-is', async () => {
      const created: Post = {
        id: 'post-1',
        authorId: 'usr-1',
        content: 'Hola UdeSA-X',
        createdAt: '2026-09-22T15:00:00Z',
        likesCount: 0,
        retweetsCount: 0,
        repliesCount: 0,
      };
      post.mockResolvedValueOnce(apiSuccess(created));

      const result = await postService.createPost('Hola UdeSA-X');

      expect(post).toHaveBeenCalledWith('/posts', { content: 'Hola UdeSA-X' });
      expect(result).toEqual(created);
    });

    it('E2-H1.CA1 - propagates the API message when the post is too long', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x.dev/errors/post-too-long',
          title: 'Post demasiado largo',
          detail: 'El post no puede superar los 280 caracteres.',
        })
      );

      await expect(postService.createPost('a'.repeat(281))).rejects.toMatchObject({
        message: 'El post no puede superar los 280 caracteres.',
        code: 'post-too-long',
      });
    });

    it('E2-H1.CA2 - propagates the API message when the post is blank', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x.dev/errors/post-is-blank',
          title: 'Post vacío',
          detail: 'El post no puede estar vacío.',
        })
      );

      await expect(postService.createPost('   ')).rejects.toMatchObject({
        message: 'El post no puede estar vacío.',
        code: 'post-is-blank',
      });
    });

    it('E2-H1.CA5 - propagates the API message when the hourly limit is reached', async () => {
      post.mockRejectedValueOnce(
        apiFailure(429, {
          type: 'https://udesa-x.dev/errors/too-many-posts',
          title: 'Demasiadas publicaciones',
          detail: 'Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.',
        })
      );

      await expect(postService.createPost('otro post')).rejects.toMatchObject({
        message: 'Alcanzaste el límite de 30 publicaciones por hora. Probá más tarde.',
        code: 'too-many-posts',
      });
    });

    it('reports a connection failure with the generic message, not a raw axios error', async () => {
      post.mockRejectedValueOnce(networkFailure());

      await expect(postService.createPost('hola')).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });
  });

  describe('E2-H2. Feed Principal', () => {
    it('E2-H2.CA2 - lists the feed with the cursor as an opaque query param', async () => {
      const page = {
        items: [
          {
            id: 'post-1',
            authorId: 'usr-2',
            authorHandle: '@joaquin_dev',
            authorDisplayName: null,
            authorAvatarUrl: null,
            content: 'Primer post',
            createdAt: '2026-09-22T15:00:00Z',
            likesCount: 0,
            retweetsCount: 0,
            repliesCount: 0,
          } satisfies FeedItem,
        ],
        nextCursor: '20',
      };
      get.mockResolvedValueOnce(apiSuccess(page, 200));

      const result = await postService.getFeed('10');

      expect(get).toHaveBeenCalledWith('/feed', { params: { cursor: '10' } });
      expect(result).toEqual(page);
    });

    it('E2-H2.CA2 - the first page sends no cursor at all', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }, 200));

      await postService.getFeed();

      expect(get).toHaveBeenCalledWith('/feed', { params: undefined });
    });

    it('reports a feed failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(postService.getFeed()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });

    it('E2-H2.CA4 - lists suggested accounts as a plain array, not a cursor page', async () => {
      const accounts: SuggestedAccount[] = [
        {
          id: 'usr-2',
          handle: '@joaquin_dev',
          displayName: null,
          avatarUrl: null,
          followersCount: 42,
        },
      ];
      get.mockResolvedValueOnce(apiSuccess(accounts, 200));

      const result = await postService.getSuggestedAccounts();

      expect(get).toHaveBeenCalledWith('/users/suggested');
      expect(result).toEqual(accounts);
    });

    it('reports a suggestions failure with the generic message, not a raw axios error', async () => {
      get.mockRejectedValueOnce(networkFailure());

      await expect(postService.getSuggestedAccounts()).rejects.toMatchObject({
        message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
      });
    });
  });
});
