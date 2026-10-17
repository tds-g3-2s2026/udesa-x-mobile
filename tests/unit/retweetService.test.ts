import { AxiosError } from 'axios';
import { postService } from '../../src/features/posts/services/postService';
import { postsApiClient } from '../../src/api/postsApiClient';

afterEach(() => jest.restoreAllMocks());

test('E2-H5.CA2 - shares using POST without a body and accepts empty success responses', async () => {
  const post = jest.spyOn(postsApiClient, 'post').mockResolvedValue({ status: 201, data: '' });
  await expect(postService.retweet('post-1')).resolves.toBeUndefined();
  expect(post).toHaveBeenCalledWith('/posts/post-1/retweet');
  post.mockResolvedValue({ status: 204, data: '' });
  await expect(postService.retweet('post-1')).resolves.toBeUndefined();
});

test('E2-H5.CA3 - undoes with DELETE', async () => {
  const del = jest.spyOn(postsApiClient, 'delete').mockResolvedValue({ status: 204, data: '' });
  await expect(postService.undoRetweet('post-1')).resolves.toBeUndefined();
  expect(del).toHaveBeenCalledWith('/posts/post-1/retweet');
});

test('network errors have messages suitable for the screen', async () => {
  jest
    .spyOn(postsApiClient, 'post')
    .mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
  jest
    .spyOn(postsApiClient, 'delete')
    .mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
  await expect(postService.retweet('post-1')).rejects.toMatchObject({
    message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
  });
  await expect(postService.undoRetweet('post-1')).rejects.toMatchObject({
    message: 'No se pudo conectar con el servidor. Revisá tu conexión.',
  });
});
