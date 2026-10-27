import { AxiosError, AxiosHeaders, CanceledError } from 'axios';
import { AppState } from 'react-native';
import React from 'react';
import { act, render } from '@testing-library/react-native';
import { focusManager } from '@tanstack/react-query';
import { apiClient } from '../../src/api/apiClient';
import { postsApiClient } from '../../src/api/postsApiClient';
import { search } from '../../src/features/search/searchService';
import { SearchQueryProvider } from '../../src/features/search/SearchQueryProvider';

const page = { items: [], nextCursor: null };
const response = {
  data: page,
  status: 200,
  statusText: 'OK',
  headers: {},
  config: { headers: new AxiosHeaders() },
};

afterEach(() => {
  jest.restoreAllMocks();
  focusManager.setFocused(undefined);
});

it.each(['posts', 'users'] as const)(
  'E2-H10.CA4 sends query, cursor and cancellation to the %s client',
  async (kind) => {
    const get = jest
      .spyOn(kind === 'posts' ? postsApiClient : apiClient, 'get')
      .mockResolvedValue(response);
    const controller = new AbortController();
    await expect(search(kind, '@ana', 'next-page', controller.signal)).resolves.toEqual(page);
    expect(get).toHaveBeenCalledWith(`/search/${kind}`, {
      params: { q: '@ana', cursor: 'next-page' },
      signal: controller.signal,
    });
  }
);

it('E2-H10.CA1 omits the cursor on the first request', async () => {
  const get = jest.spyOn(postsApiClient, 'get').mockResolvedValue(response);
  const signal = new AbortController().signal;
  await search('posts', 'universidad', null, signal);
  expect(get).toHaveBeenCalledWith('/search/posts', { params: { q: 'universidad' }, signal });
});

it('E2-H10.CA1 preserves cancellation instead of showing a connection error', async () => {
  const cancelled = new CanceledError('cancelled');
  jest.spyOn(apiClient, 'get').mockRejectedValue(cancelled);
  await expect(search('users', 'universidad', null, new AbortController().signal)).rejects.toBe(
    cancelled
  );
});

it('E2-H10.CA1 presents a network failure as a retryable error', async () => {
  jest.spyOn(apiClient, 'get').mockRejectedValue(new AxiosError('Network Error', 'ERR_NETWORK'));
  await expect(
    search('users', 'universidad', null, new AbortController().signal)
  ).rejects.toMatchObject({ message: 'No se pudo conectar con el servidor. Revisá tu conexión.' });
});

it('E2-H10.CA2 updates query focus when the native application resumes', () => {
  const events = jest.spyOn(AppState, 'addEventListener');
  render(React.createElement(SearchQueryProvider));
  const handler = events.mock.calls.find(([name]) => name === 'change')![1];
  act(() => handler('background'));
  expect(focusManager.isFocused()).toBe(false);
  act(() => handler('active'));
  expect(focusManager.isFocused()).toBe(true);
});
