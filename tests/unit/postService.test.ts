import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { postService } from '../../src/features/posts/services/postService';
import { postsApiClient } from '../../src/api/postsApiClient';
import { FeedItem, Post, PostDetail, SuggestedAccount } from '../../src/types/post';

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
const put = jest.spyOn(postsApiClient, 'put');
const del = jest.spyOn(postsApiClient, 'delete');

describe('Post service', () => {
  afterEach(() => {
    post.mockReset();
    get.mockReset();
    put.mockReset();
    del.mockReset();
  });

  describe('E2-H1. Crear Post', () => {
    it('E2-H1.CA4 - posts the content and returns the created post as-is', async () => {
      const created: Post = {
        id: 'post-1',
        authorId: 'usr-1',
        parentId: null,
        content: 'Hola UdeSA-X',
        createdAt: '2026-09-22T15:00:00Z',
        images: [],
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

  describe('E2-H4. Responder a un Post', () => {
    const reply: FeedItem = {
      id: 'reply-1',
      authorId: 'usr-2',
      authorHandle: '@joaquin_dev',
      authorDisplayName: null,
      authorAvatarUrl: null,
      authorDeleted: false,
      deleted: false,
      content: 'Buenísimo',
      createdAt: '2026-09-22T15:05:00Z',
      images: [],
      likesCount: 0,
      likedByMe: false,
      retweetedByMe: false,
      retweetedBy: null,
      entryId: 'post:post-1',
      activityAt: '2026-09-22T15:00:00Z',
      retweetsCount: 0,
      repliesCount: 0,
    };

    it('E2-H4.CA1 - posts the reply under the original and returns it with its parentId', async () => {
      const created: Post = {
        id: 'reply-1',
        authorId: 'usr-1',
        parentId: 'post-1',
        content: 'Buenísimo',
        createdAt: '2026-09-22T15:05:00Z',
        images: [],
        likesCount: 0,
        retweetsCount: 0,
        repliesCount: 0,
      };
      post.mockResolvedValueOnce(apiSuccess(created));

      const result = await postService.createReply('post-1', 'Buenísimo');

      expect(post).toHaveBeenCalledWith('/posts/post-1/replies', { content: 'Buenísimo' });
      expect(result).toEqual(created);
    });

    it('E2-H4.CA1 - reads the original post with the id of the one it answers', async () => {
      const detail: PostDetail = { ...reply, id: 'post-2', parentId: 'post-1' };
      get.mockResolvedValueOnce(apiSuccess(detail, 200));

      const result = await postService.getPost('post-2');

      expect(get).toHaveBeenCalledWith('/posts/post-2');
      expect(result).toEqual(detail);
    });

    it('E2-H4.CA2 - propagates the API message when the reply is too long', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x.dev/errors/post-too-long',
          title: 'Post demasiado largo',
          detail: 'El post no puede superar los 280 caracteres.',
        })
      );

      await expect(postService.createReply('post-1', 'a'.repeat(281))).rejects.toMatchObject({
        message: 'El post no puede superar los 280 caracteres.',
        code: 'post-too-long',
      });
    });

    it('E2-H4.CA3 - keeps the code of the 404 so the screen can match on it', async () => {
      post.mockRejectedValueOnce(
        apiFailure(404, {
          type: 'https://udesa-x.dev/errors/post-not-found',
          title: 'Publicación no encontrada',
          detail: 'La publicación no existe.',
        })
      );

      await expect(postService.createReply('post-1', 'hola')).rejects.toMatchObject({
        code: 'post-not-found',
      });
    });

    it('E2-H4.CA4 - lists the replies with the cursor as an opaque query param', async () => {
      const page = { items: [reply], nextCursor: '20' };
      get.mockResolvedValueOnce(apiSuccess(page, 200));

      const result = await postService.getReplies('post-1', '10');

      expect(get).toHaveBeenCalledWith('/posts/post-1/replies', { params: { cursor: '10' } });
      expect(result).toEqual(page);
    });

    it('E2-H4.CA4 - the first page of replies sends no cursor at all', async () => {
      get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }, 200));

      await postService.getReplies('post-1');

      expect(get).toHaveBeenCalledWith('/posts/post-1/replies', { params: undefined });
    });

    it('reports a reply, post or replies failure with the generic message, not a raw axios error', async () => {
      post.mockRejectedValueOnce(networkFailure());
      get.mockRejectedValueOnce(networkFailure());
      get.mockRejectedValueOnce(networkFailure());
      const offline = { message: 'No se pudo conectar con el servidor. Revisá tu conexión.' };

      await expect(postService.createReply('post-1', 'hola')).rejects.toMatchObject(offline);
      await expect(postService.getPost('post-1')).rejects.toMatchObject(offline);
      await expect(postService.getReplies('post-1')).rejects.toMatchObject(offline);
    });
  });

  describe('E2-H6. Like a un Post', () => {
    it('E2-H6.CA1 - likes with a PUT on the post and sends no body', async () => {
      put.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await postService.likePost('post-1');

      expect(put).toHaveBeenCalledWith('/posts/post-1/like');
    });

    it('E2-H6.CA1 - removes the like with a DELETE on the same path', async () => {
      del.mockResolvedValueOnce(apiSuccess(undefined, 204));

      await postService.unlikePost('post-1');

      expect(del).toHaveBeenCalledWith('/posts/post-1/like');
    });

    it('propagates the API message when the post cannot be liked', async () => {
      put.mockRejectedValueOnce(
        apiFailure(404, {
          type: 'https://udesa-x.dev/errors/post-not-found',
          title: 'Publicación no encontrada',
          detail: 'La publicación no existe.',
        })
      );

      await expect(postService.likePost('post-1')).rejects.toMatchObject({
        message: 'La publicación no existe.',
        code: 'post-not-found',
      });
    });

    it('reports a like or unlike failure with the generic message, not a raw axios error', async () => {
      put.mockRejectedValueOnce(networkFailure());
      del.mockRejectedValueOnce(networkFailure());
      const offline = { message: 'No se pudo conectar con el servidor. Revisá tu conexión.' };

      await expect(postService.likePost('post-1')).rejects.toMatchObject(offline);
      await expect(postService.unlikePost('post-1')).rejects.toMatchObject(offline);
    });
  });

  describe('E2-H7. Post con Imagen', () => {
    const created: Post = {
      id: 'post-1',
      authorId: 'usr-1',
      parentId: null,
      content: '',
      images: [{ id: 'img-1', url: 'https://bucket.s3.amazonaws.com/posts/1.png', position: 0 }],
      createdAt: '2026-09-22T15:00:00Z',
      likesCount: 0,
      retweetsCount: 0,
      repliesCount: 0,
    };

    // Jest's FormData is not React Native's, so what would be sent is read from
    // the calls to `append`, which is also where the order of the parts is set.
    let appendSpy: jest.SpyInstance | undefined;
    afterEach(() => appendSpy?.mockRestore());

    function recordAppends() {
      const appended: [string, unknown][] = [];
      appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation((name, value) => {
        appended.push([name, value]);
      });
      return appended;
    }

    it('E2-H7.CA1 - sends the text and each image as multipart, in the order they were attached', async () => {
      const appended = recordAppends();
      post.mockResolvedValueOnce(apiSuccess(created));

      const result = await postService.createPost('Con fotos', [
        { uri: 'file:///1.jpg', name: '1.jpg', mimeType: 'image/jpeg' },
        { uri: 'file:///2.png', name: '2.png', mimeType: 'image/png' },
      ]);

      const [path, , config] = post.mock.calls[0];
      expect(path).toBe('/posts');
      expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } });
      expect(appended).toEqual([
        ['content', 'Con fotos'],
        ['images', { uri: 'file:///1.jpg', name: '1.jpg', type: 'image/jpeg' }],
        ['images', { uri: 'file:///2.png', name: '2.png', type: 'image/png' }],
      ]);
      expect(result).toEqual(created);
    });

    it('gives an upload more time than the default for small JSON bodies', async () => {
      post.mockResolvedValueOnce(apiSuccess(created));

      await postService.createPost('', [
        { uri: 'file:///1.jpg', name: '1.jpg', mimeType: 'image/jpeg' },
      ]);

      expect(post.mock.calls[0][2]?.timeout).toBeGreaterThan(10000);
    });

    it('a post without images still goes out as the same JSON as before', async () => {
      post.mockResolvedValueOnce(apiSuccess(created));

      await postService.createPost('Sin fotos', []);

      expect(post).toHaveBeenCalledWith('/posts', { content: 'Sin fotos' });
    });

    it('E2-H7.CA2 - propagates the API message when an image is too large', async () => {
      post.mockRejectedValueOnce(
        apiFailure(422, {
          type: 'https://udesa-x.dev/errors/image-too-large',
          title: 'Imagen demasiado pesada',
          detail: 'Cada imagen puede pesar hasta 1 MB.',
        })
      );

      await expect(
        postService.createPost('x', [
          { uri: 'file:///1.jpg', name: '1.jpg', mimeType: 'image/jpeg' },
        ])
      ).rejects.toMatchObject({
        message: 'Cada imagen puede pesar hasta 1 MB.',
        code: 'image-too-large',
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
            authorDeleted: false,
            deleted: false,
            content: 'Primer post',
            images: [],
            createdAt: '2026-09-22T15:00:00Z',
            likesCount: 0,
            likedByMe: false,
            retweetedByMe: false,
            retweetedBy: null,
            entryId: 'post:post-1',
            activityAt: '2026-09-22T15:00:00Z',
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
