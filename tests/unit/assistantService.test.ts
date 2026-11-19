import { AxiosError, AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { assistantApiClient } from '../../src/api/assistantApiClient';
import {
  AssistantUnavailableError,
  assistantService,
} from '../../src/features/assistant/assistantService';

const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;

function apiFailure(status: number, data: unknown, headers = {}): AxiosError {
  const response: AxiosResponse<unknown> = {
    data,
    status,
    statusText: '',
    headers,
    config: requestConfig,
  };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', requestConfig, {}, response);
}

const post = jest.spyOn(assistantApiClient, 'post');
const BODY = { request: 'dale like', screen: { screen: 'feed' as const, posts: [] }, steps: [] };

describe('assistantService.takeTurn', () => {
  afterEach(() => post.mockReset());

  it('asks the gateway for the next action and reads the answer as it comes', async () => {
    const turn = {
      action: 'like_post',
      arguments: { ref: 'p2' },
      needsConfirmation: false,
      finished: false,
    };
    post.mockResolvedValueOnce({ data: turn });
    const { signal } = new AbortController();

    expect(await assistantService.takeTurn(BODY, signal)).toEqual(turn);
    expect(post).toHaveBeenCalledWith('/assistant/turns', BODY, { signal });
  });

  it('says how long to wait when the hourly limit is reached', async () => {
    post.mockRejectedValueOnce(apiFailure(429, {}, { 'retry-after': '125' }));

    await expect(assistantService.takeTurn(BODY)).rejects.toEqual(
      new AssistantUnavailableError(
        'Llegaste al límite de pedidos por hora. Probá de nuevo en 3 minutos.'
      )
    );
  });

  it('reads one minute in the singular, and a limit without a wait as later', async () => {
    post.mockRejectedValueOnce(apiFailure(429, {}, { 'retry-after': '20' }));
    await expect(assistantService.takeTurn(BODY)).rejects.toThrow('en 1 minuto.');

    post.mockRejectedValueOnce(apiFailure(429, {}));
    await expect(assistantService.takeTurn(BODY)).rejects.toThrow('Probá de nuevo más tarde.');
  });

  it('tells a switched off assistant apart from one that did not answer', async () => {
    post.mockRejectedValueOnce(
      apiFailure(503, { type: 'https://udesa-x.dev/errors/assistant-off', title: 'Apagado' })
    );
    await expect(assistantService.takeTurn(BODY)).rejects.toThrow(
      'El asistente está apagado por ahora.'
    );

    post.mockRejectedValueOnce(
      apiFailure(503, { type: 'https://udesa-x.dev/errors/model-unavailable', title: 'No' })
    );
    await expect(assistantService.takeTurn(BODY)).rejects.toThrow(
      'El asistente no está disponible. Probá de nuevo en un rato.'
    );
  });

  it('keeps the connection message of the app when there is no network', async () => {
    post.mockRejectedValueOnce(new AxiosError('Network Error', 'ERR_NETWORK', requestConfig, {}));

    await expect(assistantService.takeTurn(BODY)).rejects.not.toBeInstanceOf(
      AssistantUnavailableError
    );
  });

  it('lets a cancelled request through as it is', async () => {
    const cancelled = new AxiosError('canceled', AxiosError.ERR_CANCELED);
    Object.defineProperty(cancelled, '__CANCEL__', { value: true });
    post.mockRejectedValueOnce(cancelled);

    await expect(assistantService.takeTurn(BODY)).rejects.toBe(cancelled);
  });
});
