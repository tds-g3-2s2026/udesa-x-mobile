import { useEffect as mockUseEffect } from 'react';
import { Alert } from 'react-native';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import ListFeedScreen from '../../app/(app)/lists/[id]';
import { listService } from '../../src/features/lists/services/listService';
import { ApiError } from '../../src/api/apiClient';
import { useAuthStore } from '../../src/stores/authStore';
import { FeedItem } from '../../src/types/post';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => ({ id: 'lst-1', name: 'Taller' }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(() => effect(), []);
  },
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <ListFeedScreen />
    </SafeAreaProvider>
  );
}

function item(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    authorId: `usr-${id}`,
    authorHandle: `@${id}`,
    authorDisplayName: null,
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content: `contenido de ${id}`,
    createdAt: '2026-11-12T15:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:${id}`,
    activityAt: '2026-11-12T15:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useAuthStore.setState({
    user: { id: 'usr-1', handle: '@demo', email: 'demo@udesa.edu.ar', isVerified: true },
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    isInitialized: true,
  });
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H8. Listas Personalizadas', () => {
  it('E3-H8.CA2 - shows what the accounts of the list posted, under its name', async () => {
    const getFeed = jest.spyOn(listService, 'getFeed').mockResolvedValue({
      items: [item('post-2'), item('post-1', { retweetedBy: '@ana' })],
      nextCursor: null,
    });

    renderScreen();

    expect(await screen.findByText('contenido de post-2')).toBeTruthy();
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
    expect(screen.getByText('Taller')).toBeTruthy();
    expect(getFeed).toHaveBeenCalledWith('lst-1', null);
  });

  it('opens a post of the list', async () => {
    jest
      .spyOn(listService, 'getFeed')
      .mockResolvedValue({ items: [item('post-1')], nextCursor: null });

    renderScreen();
    fireEvent.press(await screen.findByText('contenido de post-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-1' } });
  });

  it('asks for the next page with the cursor it was given', async () => {
    const getFeed = jest
      .spyOn(listService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-2')], nextCursor: 'abc' })
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: null });

    renderScreen();
    await screen.findByText('contenido de post-2');
    fireEvent(screen.getByTestId('list-feed'), 'onEndReached');

    expect(await screen.findByText('contenido de post-1')).toBeTruthy();
    expect(getFeed).toHaveBeenLastCalledWith('lst-1', 'abc');
  });

  it('says how to fill a list that has nothing yet', async () => {
    jest.spyOn(listService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('Todavía no hay publicaciones')).toBeTruthy();
  });

  it('says why a list that no longer exists cannot be opened', async () => {
    jest.spyOn(listService, 'getFeed').mockRejectedValue(new ApiError('La lista no existe'));

    renderScreen();

    expect(await screen.findByText('No se pudo abrir la lista')).toBeTruthy();
    expect(screen.getByText('La lista no existe')).toBeTruthy();
  });

  it('reports a failure loading more without losing what is shown', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(listService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-2')], nextCursor: 'abc' })
      .mockRejectedValueOnce(new ApiError('No se pudo cargar la lista. Intentalo de nuevo.'));

    renderScreen();
    await screen.findByText('contenido de post-2');
    fireEvent(screen.getByTestId('list-feed'), 'onEndReached');

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'No se pudo cargar la lista. Intentalo de nuevo.')
    );
    expect(screen.getByText('contenido de post-2')).toBeTruthy();
  });
});
