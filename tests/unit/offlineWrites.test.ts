import { AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { onlineManager } from '@tanstack/react-query';
import { apiClient } from '../../src/api/apiClient';
import { postsApiClient } from '../../src/api/postsApiClient';
import { postService } from '../../src/features/posts/services/postService';

// Only the transport is replaced: the interceptors run for real, so a refused
// write is one that never reaches the adapter.
const adapter = jest.fn<Promise<AxiosResponse>, [InternalAxiosRequestConfig]>();
apiClient.defaults.adapter = adapter;
postsApiClient.defaults.adapter = adapter;

beforeEach(() => {
  adapter.mockReset();
  adapter.mockImplementation((config) =>
    Promise.resolve({ data: {}, status: 200, statusText: 'OK', headers: {}, config })
  );
});

afterEach(() => {
  onlineManager.setOnline(true);
});

describe('T-57. Escrituras sin conexión', () => {
  it('T-57 - does not publish without connection and says why', async () => {
    onlineManager.setOnline(false);

    await expect(postService.createPost('hola', [])).rejects.toThrow('Sin conexión');

    expect(adapter).not.toHaveBeenCalled();
  });

  it('T-57 - every write is refused without connection, whatever its verb', async () => {
    onlineManager.setOnline(false);

    for (const call of [
      () => postsApiClient.post('/posts/1/likes'),
      () => postsApiClient.put('/lists/1'),
      () => apiClient.patch('/me', {}),
      () => apiClient.delete('/me'),
    ]) {
      await expect(call()).rejects.toThrow('Sin conexión');
    }

    expect(adapter).not.toHaveBeenCalled();
  });

  it('T-57 - reads and auth calls still go out without connection', async () => {
    onlineManager.setOnline(false);

    await postsApiClient.get('/feed');
    await apiClient.post('/auth/refresh', {});
    await apiClient.post('/auth/logout', {});
    await apiClient.post('/auth/login', {});

    expect(adapter).toHaveBeenCalledTimes(4);
  });

  it('T-57 - writes go out as usual with connection', async () => {
    await postsApiClient.post('/posts/1/likes');

    expect(adapter).toHaveBeenCalledTimes(1);
  });
});
