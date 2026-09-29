import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import {
  ALREADY_REPORTED_MESSAGE,
  reportService,
} from '../../src/features/social/services/reportService';
import { postsApiClient } from '../../src/api/postsApiClient';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiSuccess<T>(data: T, status = 201): AxiosResponse<T> {
  return { data, status, statusText: 'Created', headers: {}, config: requestConfig };
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

const post = jest.spyOn(postsApiClient, 'post');

describe('Report service', () => {
  afterEach(() => {
    post.mockReset();
  });

  describe('E3-H5. Denunciar Usuario', () => {
    it('E3-H5.CA1 - reports an account with the reason from the closed list', async () => {
      post.mockResolvedValueOnce(apiSuccess({}));

      await reportService.report({ userId: 'usr-2' }, 'harassment');

      expect(post).toHaveBeenCalledWith('/reports', { userId: 'usr-2', reason: 'harassment' });
    });

    it('E3-H5.CA1 - reports a post by its id, never sending the account too', async () => {
      post.mockResolvedValueOnce(apiSuccess({}));

      await reportService.report({ postId: 'post-7' }, 'spam');

      expect(post).toHaveBeenCalledWith('/reports', { postId: 'post-7', reason: 'spam' });
    });

    it('E3-H5.CA3 - a second report within 24 hours says so in plain words', async () => {
      post.mockRejectedValueOnce(
        apiFailure(409, {
          type: 'https://udesa-x.dev/errors/already-reported',
          title: 'No se pudo enviar la denuncia',
          status: 409,
          detail: 'Ya denunciaste esta cuenta en las últimas 24 horas',
        })
      );

      await expect(reportService.report({ userId: 'usr-2' }, 'spam')).rejects.toMatchObject({
        code: 'already-reported',
        message: ALREADY_REPORTED_MESSAGE,
      });
    });

    it('any other refusal keeps the message the API sent', async () => {
      post.mockRejectedValueOnce(
        apiFailure(404, {
          type: 'https://udesa-x.dev/errors/post-not-found',
          detail: 'El post no existe',
        })
      );

      await expect(reportService.report({ postId: 'post-7' }, 'spam')).rejects.toMatchObject({
        code: 'post-not-found',
        message: 'El post no existe',
      });
    });
  });
});
