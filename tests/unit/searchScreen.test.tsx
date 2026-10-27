import React from 'react';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SearchScreen from '../../app/(app)/(tabs)/search';
import { SearchQueryProvider } from '../../src/features/search/SearchQueryProvider';
import { searchQueryClient } from '../../src/features/search/queryClient';
import * as service from '../../src/features/search/searchService';
import { useAuthStore } from '../../src/stores/authStore';
import { SearchPage } from '../../src/features/search/types';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: React.EffectCallback) => {
    const React = jest.requireActual('react');
    React.useEffect(callback, [callback]);
  },
}));

const metrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};
const post = {
  id: 'post-1',
  authorId: 'owner',
  authorHandle: '@ana',
  createdAt: '2026-10-25T12:00:00Z',
  parentId: null,
  snippet: [
    { text: 'En la ', highlighted: false },
    { text: 'UdeSA', highlighted: true },
  ],
};
const search = jest.spyOn(service, 'search');

function renderSearch() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchQueryProvider>
        <SearchScreen />
      </SearchQueryProvider>
    </SafeAreaProvider>
  );
}
function type(text: string) {
  fireEvent.changeText(screen.getByLabelText('Buscar personas y publicaciones'), text);
}

beforeEach(() => {
  searchQueryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  searchQueryClient.clear();
  useAuthStore.setState({
    user: { id: 'viewer', handle: '@viewer', email: 'viewer@example.com', isVerified: true },
  });
  search.mockReset();
  search.mockResolvedValue({ items: [post], nextCursor: null });
});
afterEach(() => {
  searchQueryClient.clear();
  jest.clearAllMocks();
});

it('E2-H10.CA1 validates three normalized characters including at mode', async () => {
  renderSearch();
  type('ab');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(search).not.toHaveBeenCalled();
  fireEvent.press(screen.getByRole('tab', { name: 'Usuarios' }));
  type('@ab');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 350));
  });
  expect(search).not.toHaveBeenCalled();
  type('@ana');
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith('users', '@ana', null, expect.any(AbortSignal))
  );
});

it('E2-H10.CA1 preserves handle-only search as a distinct query from regular account search', async () => {
  renderSearch();
  fireEvent.press(screen.getByRole('tab', { name: 'Usuarios' }));
  type('@ana');
  await waitFor(() =>
    expect(search).toHaveBeenCalledWith('users', '@ana', null, expect.any(AbortSignal))
  );

  type('ana');

  await waitFor(() =>
    expect(search).toHaveBeenLastCalledWith('users', 'ana', null, expect.any(AbortSignal))
  );
  expect(search).toHaveBeenCalledTimes(2);
});

it('E2-H10.CA2 switches a single field between posts and users', async () => {
  renderSearch();
  type('udesa');
  await screen.findByText('UdeSA');
  expect(search).toHaveBeenLastCalledWith('posts', 'udesa', null, expect.any(AbortSignal));
  search.mockResolvedValue({
    items: [{ id: 'new-user', handle: '@udesa', displayName: 'Universidad', isPrivate: true }],
    nextCursor: null,
  });
  fireEvent.press(screen.getByRole('tab', { name: 'Usuarios' }));
  await screen.findByText('Universidad');
  expect(screen.getAllByLabelText('Buscar personas y publicaciones')).toHaveLength(1);
  fireEvent.press(screen.getByLabelText('Abrir perfil de @udesa'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'new-user' } });
});

it('E2-H10.CA3 renders native highlighted snippets and opens the post', async () => {
  renderSearch();
  type('udesa');
  const match = await screen.findByText('UdeSA');
  expect(match.props.style).toEqual(expect.objectContaining({ fontWeight: '700' }));
  fireEvent.press(screen.getByLabelText('Abrir publicación'));
  expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-1' } });
});

it('E2-H10.CA4 keeps existing results after a next page error and retries its cursor', async () => {
  search.mockResolvedValueOnce({ items: [post], nextCursor: 'next' });
  search.mockRejectedValueOnce(new Error('Sin conexión'));
  renderSearch();
  type('udesa');
  await screen.findByText('UdeSA');
  fireEvent(screen.getByTestId('search-results'), 'onEndReached');
  await screen.findByText('Reintentar resultados');
  expect(screen.getByText('UdeSA')).toBeTruthy();
  fireEvent(screen.getByTestId('search-results'), 'onEndReached');
  expect(search).toHaveBeenCalledTimes(2);
  search.mockResolvedValueOnce({
    items: [
      { ...post, id: 'post-2', snippet: [{ text: 'Otra coincidencia', highlighted: false }] },
    ],
    nextCursor: null,
  });
  fireEvent.press(screen.getByText('Reintentar resultados'));
  await screen.findByText('Otra coincidencia');
  expect(search).toHaveBeenLastCalledWith('posts', 'udesa', 'next', expect.any(AbortSignal));
});

it('E2-H10.CA1 discards a slow response for an earlier text', async () => {
  let finish!: (page: SearchPage) => void;
  search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderSearch();
  type('primera');
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  type('segunda');
  search.mockResolvedValueOnce({
    items: [{ ...post, snippet: [{ text: 'Resultado actual', highlighted: true }] }],
    nextCursor: null,
  });
  await screen.findByText('Resultado actual');
  await act(async () => finish({ items: [post], nextCursor: null }));
  expect(screen.queryByText('UdeSA')).toBeNull();
});

it('E2-H10.CA1 shows an initial error with a manual retry', async () => {
  search.mockRejectedValueOnce(new Error('Servicio no disponible'));
  renderSearch();
  type('udesa');
  await screen.findByText('Servicio no disponible');
  fireEvent.press(screen.getByText('Reintentar búsqueda'));
  await screen.findByText('UdeSA');
});

it('E2-H10.CA5 clears cached pages when the session changes', async () => {
  renderSearch();
  type('udesa');
  await screen.findByText('UdeSA');
  await act(async () => useAuthStore.setState({ user: null }));
  expect(
    searchQueryClient.getQueryCache().findAll({ queryKey: ['search', 'viewer'] })
  ).toHaveLength(0);
  expect(screen.queryByText('UdeSA')).toBeNull();
});

it('E2-H10.CA1 keeps an in-flight query when only outer whitespace changes', async () => {
  let finish!: (page: SearchPage) => void;
  search.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      })
  );
  renderSearch();
  type('udesa');
  await waitFor(() => expect(search).toHaveBeenCalledTimes(1));
  const signal = search.mock.calls[0][3];
  type('udesa ');
  expect(signal.aborted).toBe(false);
  await act(async () => finish({ items: [post], nextCursor: null }));
  await screen.findByText('UdeSA');
});
