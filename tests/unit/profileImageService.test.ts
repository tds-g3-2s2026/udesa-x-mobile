import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { postsApiClient } from '../../src/api/postsApiClient';
import { ApiError } from '../../src/api/apiClient';
import { checkPickedImage } from '../../src/features/posts/postImages';
import {
  PROFILE_IMAGE_MAX_BYTES,
  profileImageService,
} from '../../src/features/social/services/profileImageService';

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

const photo = { uri: 'file:///photo.jpg', name: 'photo.jpg', mimeType: 'image/jpeg' };

const put = jest.spyOn(postsApiClient, 'put');
const remove = jest.spyOn(postsApiClient, 'delete');

// Jest's FormData is not React Native's, so what would be sent is read from
// the calls to `append`.
let appendSpy: jest.SpyInstance | undefined;
function recordAppends() {
  const appended: [string, unknown][] = [];
  appendSpy = jest.spyOn(FormData.prototype, 'append').mockImplementation((name, value) => {
    appended.push([name, value]);
  });
  return appended;
}

afterEach(() => {
  put.mockReset();
  remove.mockReset();
  appendSpy?.mockRestore();
});

describe('E1-H8. Foto de Perfil', () => {
  it('E1-H8 - uploads the photo as a single multipart part and returns its new URL', async () => {
    const appended = recordAppends();
    put.mockResolvedValueOnce(apiSuccess({ avatarUrl: 'https://bucket.example/a.jpg?sig=1' }));

    const url = await profileImageService.upload('avatar', photo);

    const [path, , config] = put.mock.calls[0];
    expect(path).toBe('/users/me/avatar');
    expect(config).toMatchObject({ headers: { 'Content-Type': 'multipart/form-data' } });
    expect(config?.timeout).toBeGreaterThan(10000);
    expect(appended).toEqual([
      ['image', { uri: 'file:///photo.jpg', name: 'photo.jpg', type: 'image/jpeg' }],
    ]);
    expect(url).toBe('https://bucket.example/a.jpg?sig=1');
  });

  it('E1-H8 - uploads the cover to its own route and reads its own field', async () => {
    recordAppends();
    put.mockResolvedValueOnce(apiSuccess({ coverUrl: 'https://bucket.example/c.jpg?sig=1' }));

    const url = await profileImageService.upload('cover', photo);

    expect(put.mock.calls[0][0]).toBe('/users/me/cover');
    expect(url).toBe('https://bucket.example/c.jpg?sig=1');
  });

  it('E1-H8.CA6 - deleting goes to the route of that image', async () => {
    remove.mockResolvedValueOnce(apiSuccess(null, 204));

    await profileImageService.remove('avatar');

    expect(remove).toHaveBeenCalledWith('/users/me/avatar');
  });

  it('E1-H8.CA3 - propagates the message of a file the server refuses by its content', async () => {
    recordAppends();
    put.mockRejectedValueOnce(
      apiFailure(422, {
        type: 'https://udesa-x.dev/errors/image-format-not-supported',
        title: 'Formato no soportado',
        detail: 'La imagen tiene que ser JPG o PNG.',
      })
    );

    const failure = profileImageService.upload('avatar', photo);

    await expect(failure).rejects.toBeInstanceOf(ApiError);
    await expect(failure).rejects.toMatchObject({
      message: 'La imagen tiene que ser JPG o PNG.',
      code: 'image-format-not-supported',
    });
  });

  it('falls back to a message of its own when the server fails without one', async () => {
    recordAppends();
    put.mockRejectedValueOnce(apiFailure(500, {}));
    remove.mockRejectedValueOnce(apiFailure(500, {}));

    await expect(profileImageService.upload('cover', photo)).rejects.toMatchObject({
      message: 'No se pudo subir la portada. Intentalo de nuevo.',
    });
    await expect(profileImageService.remove('cover')).rejects.toMatchObject({
      message: 'No se pudo eliminar la portada. Intentalo de nuevo.',
    });
  });

  it('E1-H8.CA2 - the photo can weigh up to 5 MB and the cover up to 10 MB', () => {
    const avatarLimit = PROFILE_IMAGE_MAX_BYTES.avatar;
    const coverLimit = PROFILE_IMAGE_MAX_BYTES.cover;
    expect(avatarLimit).toBe(5 * 1024 * 1024);
    expect(coverLimit).toBe(10 * 1024 * 1024);

    const asset = (fileSize: number) => ({
      uri: 'file:///p.jpg',
      mimeType: 'image/jpeg',
      fileSize,
    });
    expect(checkPickedImage(asset(avatarLimit), avatarLimit)).toHaveProperty('image');
    expect(checkPickedImage(asset(avatarLimit + 1), avatarLimit)).toEqual({
      name: 'p.jpg',
      reason: 'size',
    });
    expect(checkPickedImage(asset(avatarLimit + 1), coverLimit)).toHaveProperty('image');
  });

  it('E1-H8.CA1 - only JPG and PNG are taken', () => {
    expect(
      checkPickedImage(
        { uri: 'file:///p.gif', mimeType: 'image/gif' },
        PROFILE_IMAGE_MAX_BYTES.avatar
      )
    ).toEqual({ name: 'p.gif', reason: 'format' });
    expect(
      checkPickedImage(
        { uri: 'file:///p.png', mimeType: 'image/png' },
        PROFILE_IMAGE_MAX_BYTES.avatar
      )
    ).toEqual({ image: { uri: 'file:///p.png', name: 'p.png', mimeType: 'image/png' } });
  });
});
