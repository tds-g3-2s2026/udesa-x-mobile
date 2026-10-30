import {
  AxiosError,
  AxiosHeaders,
  AxiosResponse,
  CanceledError,
  InternalAxiosRequestConfig,
} from 'axios';
import { notificationsApiClient } from '../../src/api/notificationsApiClient';
import { notificationService } from '../../src/features/notifications/notificationService';
import { AppNotification, NotificationPage } from '../../src/features/notifications/types';

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

const get = jest.spyOn(notificationsApiClient, 'get');
const post = jest.spyOn(notificationsApiClient, 'post');
const del = jest.spyOn(notificationsApiClient, 'delete');

const notification: AppNotification = {
  id: 'ntf-1',
  type: 'like',
  actor: { id: 'usr-2', handle: 'juanperez' },
  postId: 'post-1',
  replyId: null,
  createdAt: '2026-10-30T12:00:00.000Z',
  readAt: null,
};

afterEach(() => {
  get.mockReset();
  post.mockReset();
  del.mockReset();
});

describe('E4-H3. Centro de Notificaciones In-App', () => {
  it('E4-H3.CA3 - asks for the first page without a cursor and returns it as it comes', async () => {
    const page: NotificationPage = { items: [notification], nextCursor: 'next' };
    get.mockResolvedValueOnce(apiSuccess(page));

    await expect(notificationService.list(null)).resolves.toEqual(page);

    // The server fixes the page at 20: the app never sends a size.
    expect(get).toHaveBeenCalledWith('/notifications', { params: {}, signal: undefined });
  });

  it('E4-H3.CA3 - continues from the cursor of the previous page', async () => {
    get.mockResolvedValueOnce(apiSuccess({ items: [], nextCursor: null }));
    const signal = new AbortController().signal;

    await notificationService.list('next', signal);

    expect(get).toHaveBeenCalledWith('/notifications', { params: { cursor: 'next' }, signal });
  });

  it('turns a failed page into a message the screen can show', async () => {
    get.mockRejectedValueOnce(
      apiFailure(400, {
        type: 'https://udesa-x.dev/errors/invalid-cursor',
        detail: 'El cursor no es válido.',
      })
    );

    await expect(notificationService.list('broken')).rejects.toMatchObject({
      code: 'invalid-cursor',
      message: 'El cursor no es válido.',
    });
  });

  it('lets a cancelled page through untouched, so it is not reported as an error', async () => {
    const cancelled = new CanceledError();
    get.mockRejectedValueOnce(cancelled);

    await expect(notificationService.list(null)).rejects.toBe(cancelled);
  });

  it('E4-H3.CA2 - marks every notification as read with one call', async () => {
    post.mockResolvedValueOnce(apiSuccess(undefined, 204));

    await notificationService.markAllAsRead();

    expect(post).toHaveBeenCalledWith('/notifications/read-all');
  });

  it('E4-H3.CA2 - reports a failed read-all with its own fallback message', async () => {
    post.mockRejectedValueOnce(apiFailure(500, 'not problem details'));

    await expect(notificationService.markAllAsRead()).rejects.toMatchObject({
      message: 'No se pudieron marcar como leídas. Intentalo de nuevo.',
    });
  });

  it('E4-H3.CA4 - deletes one notification by its id', async () => {
    del.mockResolvedValueOnce(apiSuccess(undefined, 204));

    await notificationService.remove('ntf-1');

    expect(del).toHaveBeenCalledWith('/notifications/ntf-1');
  });

  it('E4-H3.CA4 - returns the server reason when a notification cannot be deleted', async () => {
    del.mockRejectedValueOnce(
      apiFailure(404, {
        type: 'https://udesa-x.dev/errors/notification-not-found',
        detail: 'La notificación no existe.',
      })
    );

    await expect(notificationService.remove('ntf-9')).rejects.toMatchObject({
      code: 'notification-not-found',
      message: 'La notificación no existe.',
    });
  });
});
