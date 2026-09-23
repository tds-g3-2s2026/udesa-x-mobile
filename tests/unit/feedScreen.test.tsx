import { useEffect as mockUseEffect } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FeedScreen from '../../app/(app)/(tabs)/index';
import { postService } from '../../src/features/posts/services/postService';
import { followService } from '../../src/features/social/services/followService';
import { ApiError } from '../../src/api/apiClient';
import { FeedItem, SuggestedAccount } from '../../src/types/post';

const mockPush = jest.fn();
const mockNavigate = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, navigate: mockNavigate }),
  // No real navigator in this isolated render: runs the focus effect once on
  // mount, the same as a screen that was already focused when it appeared.
  // Imported as `mockUseEffect`: jest's mock factories refuse any other
  // out-of-scope reference, `mock`-prefixed ones are the one exception.
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
      <FeedScreen />
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
    content: `contenido de ${id}`,
    createdAt: '2026-09-22T15:00:00Z',
    likesCount: 0,
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E2-H2. Feed Principal', () => {
  it('E2-H2.CA1 - shows the feed once it loads, most recent first as the API returns it', async () => {
    jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValue({ items: [item('post-1'), item('post-2')], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('contenido de post-1')).toBeTruthy();
    expect(screen.getByText('contenido de post-2')).toBeTruthy();
  });

  it('E2-H2.CA3 - a row shows the author, the content and the three counters', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({
      items: [
        item('post-1', {
          authorDisplayName: 'Joaco',
          likesCount: 3,
          retweetsCount: 1,
          repliesCount: 2,
        }),
      ],
      nextCursor: null,
    });

    renderScreen();

    expect(await screen.findByText('Joaco')).toBeTruthy();
    expect(screen.getByText('@post-1')).toBeTruthy();
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('E2-H2.CA4 - an empty feed shows suggested accounts with a follow button each', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
    const suggestions: SuggestedAccount[] = [
      {
        id: 'usr-2',
        handle: '@joaquin_dev',
        displayName: null,
        avatarUrl: null,
        followersCount: 42,
      },
    ];
    jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue(suggestions);

    renderScreen();

    expect(await screen.findByText('Todavía no hay publicaciones')).toBeTruthy();
    expect(screen.getByText('@joaquin_dev · 42 seguidores')).toBeTruthy();
    expect(screen.getByText('Seguir')).toBeTruthy();
  });

  it('E2-H2.CA4 - a feed with posts never asks for suggestions', async () => {
    jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValue({ items: [item('post-1')], nextCursor: null });
    const suggested = jest.spyOn(postService, 'getSuggestedAccounts');

    renderScreen();
    await screen.findByText('contenido de post-1');

    expect(suggested).not.toHaveBeenCalled();
  });

  it('E2-H2.CA2 - reaching the end of the list asks for the next page with its cursor', async () => {
    const getFeed = jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: '20' })
      .mockResolvedValueOnce({ items: [item('post-2')], nextCursor: null });

    renderScreen();
    await screen.findByText('contenido de post-1');

    await act(async () => {
      fireEvent(screen.getByTestId('feed-list'), 'endReached');
    });

    expect(getFeed).toHaveBeenLastCalledWith('20');
    expect(await screen.findByText('contenido de post-2')).toBeTruthy();
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
  });

  it('E2-H2.CA2 - there is no next page once nextCursor comes back null', async () => {
    const getFeed = jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValue({ items: [item('post-1')], nextCursor: null });

    renderScreen();
    await screen.findByText('contenido de post-1');

    await act(async () => {
      fireEvent(screen.getByTestId('feed-list'), 'endReached');
    });

    expect(getFeed).toHaveBeenCalledTimes(1);
  });

  it('pulling to refresh reloads the feed from the first page', async () => {
    const getFeed = jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: '20' })
      .mockResolvedValueOnce({ items: [item('post-3')], nextCursor: null });

    renderScreen();
    await screen.findByText('contenido de post-1');

    await act(async () => {
      screen.getByTestId('feed-list').props.refreshControl.props.onRefresh();
    });

    expect(getFeed).toHaveBeenLastCalledWith(null);
    expect(await screen.findByText('contenido de post-3')).toBeTruthy();
    expect(screen.queryByText('contenido de post-1')).toBeNull();
  });

  it('a load failure shows an alert instead of an empty or stuck screen', async () => {
    jest
      .spyOn(postService, 'getFeed')
      .mockRejectedValue(new ApiError('No se pudo cargar el feed. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el feed. Intentalo de nuevo.')
    );
  });

  it('a suggestions failure shows its own alert once the feed comes back empty', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
    jest
      .spyOn(postService, 'getSuggestedAccounts')
      .mockRejectedValue(
        new ApiError('No se pudieron cargar las sugerencias. Intentalo de nuevo.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar las sugerencias. Intentalo de nuevo.'
      )
    );
  });

  it('a next-page failure shows an alert and keeps the rows already on screen', async () => {
    const getFeed = jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: '20' })
      .mockRejectedValueOnce(new ApiError('No se pudo cargar el feed. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('contenido de post-1');

    await act(async () => {
      fireEvent(screen.getByTestId('feed-list'), 'endReached');
    });

    expect(getFeed).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'No se pudo cargar el feed. Intentalo de nuevo.')
    );
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
  });

  it('the search shortcut opens the Buscar tab', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue([]);

    renderScreen();
    await screen.findByText('Todavía no hay publicaciones');

    fireEvent.press(screen.getByLabelText('Buscar en UdeSA-X'));

    expect(mockNavigate).toHaveBeenCalledWith('/search');
  });

  it('the compose shortcut opens the post screen', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue([]);

    renderScreen();
    await screen.findByText('Todavía no hay publicaciones');

    fireEvent.press(screen.getByLabelText('Escribir un post nuevo'));

    expect(mockPush).toHaveBeenCalledWith('/compose');
  });

  it('following a suggested account calls the follow service with its id', async () => {
    jest.spyOn(postService, 'getFeed').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(postService, 'getSuggestedAccounts').mockResolvedValue([
      {
        id: 'usr-2',
        handle: '@joaquin_dev',
        displayName: null,
        avatarUrl: null,
        followersCount: 42,
      },
    ]);
    const follow = jest.spyOn(followService, 'follow').mockResolvedValue('following');

    renderScreen();
    await screen.findByText('@joaquin_dev · 42 seguidores');

    await act(async () => {
      fireEvent.press(screen.getByText('Seguir'));
    });

    expect(follow).toHaveBeenCalledWith('usr-2');
  });
});
