import React from 'react';
import { StyleSheet } from 'react-native';
import { fireEvent, render, screen, waitFor, act } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SearchScreen from '../../app/(app)/(tabs)/search';
import { SearchQueryProvider } from '../../src/features/search/SearchQueryProvider';
import { searchQueryClient } from '../../src/features/search/queryClient';
import * as service from '../../src/features/search/searchService';
import { useAuthStore } from '../../src/stores/authStore';
import { SearchPage } from '../../src/features/search/types';

const mockPush = jest.fn();
const mockSetParams = jest.fn();
let mockParams: { q?: string } = {};
const mockRouter = { push: mockPush, setParams: mockSetParams };
jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
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
const fetchTrending = jest.spyOn(service, 'fetchTrending');
const trending = [
  { tag: 'udesa', count: 42 },
  { tag: 'tds', count: 30 },
  { tag: 'ios', count: 25 },
  { tag: 'expo', count: 20 },
  { tag: 'api', count: 15 },
  { tag: 'sprint', count: 12 },
  { tag: 'parcial', count: 9 },
  { tag: 'defensa', count: 6 },
  { tag: 'catedra', count: 3 },
  { tag: 'unpost', count: 1 },
];

function searchTree() {
  return (
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchQueryProvider>
        <SearchScreen />
      </SearchQueryProvider>
    </SafeAreaProvider>
  );
}
function renderSearch() {
  return render(searchTree());
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
  fetchTrending.mockResolvedValue(trending);
});
afterEach(() => {
  searchQueryClient.clear();
  jest.clearAllMocks();
  mockParams = {};
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

it('E2-H8.CA3 - a hashtag from the route opens a search for it at once', async () => {
  mockParams = { q: '#UdeSA' };
  renderSearch();

  await screen.findByText('UdeSA');
  expect(search).toHaveBeenCalledWith('posts', '#UdeSA', null, expect.anything());
  expect(screen.getByLabelText('Buscar personas y publicaciones').props.value).toBe('#UdeSA');
  expect(mockSetParams).toHaveBeenCalledWith({ q: undefined });
});

it('E2-H11.CA2 shows the trending section instead of the prompt when there is no query', async () => {
  renderSearch();
  await screen.findByText('Tendencias');
  expect(screen.queryByText('Empezá a buscar')).toBeNull();
  expect(search).not.toHaveBeenCalled();
});

it('T-48 - the trending topics start apart from the tabs above them', async () => {
  renderSearch();
  await screen.findByText('Tendencias');

  const list = StyleSheet.flatten(screen.getByTestId('search-results').props.contentContainerStyle);
  expect(list.paddingTop).toBeGreaterThanOrEqual(16);
});

it('T-48 - both tabs keep one text size, and only the selected one changes color', async () => {
  renderSearch();
  await screen.findByText('Tendencias');

  const labels = () =>
    ['Posts', 'Usuarios'].map((tab) => StyleSheet.flatten(screen.getByText(tab).props.style));
  const [posts, users] = labels();
  expect(posts.fontSize).toBe(users.fontSize);
  expect(posts.paddingVertical).toBe(users.paddingVertical);
  expect(posts.color).not.toBe(users.color);

  fireEvent.press(screen.getByRole('tab', { name: 'Usuarios' }));
  const [postsAfter, usersAfter] = labels();
  expect(postsAfter.fontSize).toBe(posts.fontSize);
  expect(usersAfter.fontSize).toBe(users.fontSize);
  expect(usersAfter.color).toBe(posts.color);
});

it('keeps the empty prompt when there are no trending topics', async () => {
  fetchTrending.mockResolvedValueOnce([]);
  renderSearch();
  await screen.findByText('Empezá a buscar');
  expect(screen.queryByText('Tendencias')).toBeNull();
});

it('E2-H11.CA2 lists the top ten topics with their counts in server order', async () => {
  renderSearch();
  await screen.findByText('Tendencias');
  const labels = screen.getAllByLabelText(/^Buscar #/).map((row) => row.props.accessibilityLabel);
  expect(labels).toEqual(
    trending.map(
      (topic) => `Buscar #${topic.tag}, ${topic.count === 1 ? '1 post' : `${topic.count} posts`}`
    )
  );
  expect(screen.getByLabelText(/^Buscar #udesa,/)).toBeTruthy();
  expect(screen.getByText('42 posts')).toBeTruthy();
});

it('E2-H11.CA2 uses the singular for a topic with one post', async () => {
  renderSearch();
  await screen.findByText('1 post');
  expect(screen.getByText('#unpost')).toBeTruthy();
});

it('tapping a topic runs the same hashtag search as a tapped hashtag', async () => {
  const view = renderSearch();
  fireEvent.press(await screen.findByLabelText(/^Buscar #udesa,/));
  expect(mockSetParams).toHaveBeenCalledWith({ q: '#udesa' });

  mockParams = { q: '#udesa' };
  view.rerender(searchTree());
  await screen.findByText('UdeSA');
  expect(search).toHaveBeenCalledWith('posts', '#udesa', null, expect.any(AbortSignal));
  expect(screen.getByLabelText('Buscar personas y publicaciones').props.value).toBe('#udesa');
});

it('shows a non-blocking message when trending fails and search still works', async () => {
  fetchTrending.mockRejectedValueOnce(new Error('Servicio no disponible'));
  renderSearch();
  await screen.findByText('No pudimos cargar las tendencias.');
  type('udesa');
  await screen.findByText('UdeSA');
});
