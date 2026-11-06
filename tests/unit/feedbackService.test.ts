import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient } from '../../src/api/apiClient';
import { feedbackService } from '../../src/features/feedback/feedbackService';

// The real module freezes what it reads from the build.
jest.mock('expo-constants', () => ({
  __esModule: true,
  default: { expoConfig: { version: '1.3.0' } },
}));
const constants = Constants as unknown as { expoConfig: { version: string } | null };

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

const post = jest.spyOn(apiClient, 'post');
const originalPlatform = {
  OS: Platform.OS,
  Version: Platform.Version,
  constants: Platform.constants,
};

// The test renderer runs as one platform, so the other ones are set by hand.
function runningOn(os: string, version: unknown, constants: unknown = {}) {
  Object.defineProperty(Platform, 'OS', { value: os, configurable: true });
  Object.defineProperty(Platform, 'Version', { value: version, configurable: true });
  Object.defineProperty(Platform, 'constants', { value: constants, configurable: true });
}

function sentBody() {
  return post.mock.calls[0][1];
}

beforeEach(() => {
  post.mockReset().mockResolvedValue(apiSuccess({ id: 'feedback-1' }));
  constants.expoConfig = { version: '1.3.0' };
});

afterEach(() => {
  runningOn(originalPlatform.OS, originalPlatform.Version, originalPlatform.constants);
});

describe('E1-H11. Enviar Feedback o Reportar Error', () => {
  it('E1-H11.CA3 - names Android by its release, not by its API level', async () => {
    runningOn('android', 35, { Release: '15' });

    await feedbackService.send('Hola');

    expect(post.mock.calls[0][0]).toBe('/me/feedback');
    expect(sentBody()).toEqual({
      message: 'Hola',
      device_os: 'Android 15',
      app_version: '1.3.0',
    });
  });

  it('E1-H11.CA3 - names iOS by its version', async () => {
    runningOn('ios', '18.1');

    await feedbackService.send('Hola');

    expect(sentBody()).toMatchObject({ device_os: 'iOS 18.1' });
  });

  it('E1-H11.CA3 - the web build has no version to report', async () => {
    runningOn('web', undefined);

    await feedbackService.send('Hola');

    expect(sentBody()).toMatchObject({ device_os: 'Web' });
  });

  it('still sends the comment when the app cannot read its own version', async () => {
    constants.expoConfig = null;

    await feedbackService.send('Hola');

    expect(sentBody()).toMatchObject({ app_version: 'desconocida' });
  });

  it('E1-H11.CA4 - hands over the message and the code of the hourly limit', async () => {
    post.mockRejectedValueOnce(
      apiFailure(429, {
        type: 'https://udesa-x.dev/errors/too-many-feedback-messages',
        title: 'Demasiados mensajes',
        detail: 'Ya enviaste 2 mensajes. Esperá 60 minutos',
      })
    );

    await expect(feedbackService.send('Hola')).rejects.toMatchObject({
      message: 'Ya enviaste 2 mensajes. Esperá 60 minutos',
      code: 'too-many-feedback-messages',
    });
  });

  it('falls back to a message of its own when the server fails without one', async () => {
    post.mockRejectedValueOnce(apiFailure(500, {}));

    await expect(feedbackService.send('Hola')).rejects.toMatchObject({
      message: 'No se pudo enviar el comentario. Intentalo de nuevo.',
    });
  });
});
