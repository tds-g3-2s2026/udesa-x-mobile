import { useEffect as mockUseEffect } from 'react';
import { Alert, RefreshControl } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import SavedScreen from '../../app/(app)/saved';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { useAuthStore } from '../../src/stores/authStore';
import { FeedItem } from '../../src/types/post';

const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
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
      <SavedScreen />
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
    savedByMe: true,
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

describe('E2-H12. Guardar Posts', () => {
  it('E2-H12.CA3 - shows the saved posts in the order the server gave them', async () => {
    const getBookmarks = jest
      .spyOn(postService, 'getBookmarks')
      .mockResolvedValue({ items: [item('post-2'), item('post-1')], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('contenido de post-2')).toBeTruthy();
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
    expect(getBookmarks).toHaveBeenNthCalledWith(1, null);
  });

  // Privacy (E2-H12.CA2) is enforced by the server: the client only asks for the caller's own list.
  it('E2-H12.CA2 - reads only the caller list: the request carries no user id', async () => {
    const getBookmarks = jest
      .spyOn(postService, 'getBookmarks')
      .mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('Todavía no guardaste nada');

    expect(getBookmarks).toHaveBeenCalledWith(null);
    expect(getBookmarks.mock.calls[0]).toHaveLength(1);
  });

  it('says so when nothing is saved yet', async () => {
    jest.spyOn(postService, 'getBookmarks').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('Todavía no guardaste nada')).toBeTruthy();
  });

  it('says why the saved posts cannot be opened when loading fails', async () => {
    jest
      .spyOn(postService, 'getBookmarks')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));

    renderScreen();

    expect(await screen.findByText('No se pudieron abrir tus guardados')).toBeTruthy();
  });

  it('E2-H12.CA3 - asks for the next page with the cursor it was given and shows each saved post once', async () => {
    const getBookmarks = jest
      .spyOn(postService, 'getBookmarks')
      .mockResolvedValueOnce({ items: [item('post-2')], nextCursor: 'abc' })
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: null });

    renderScreen();
    await screen.findByText('contenido de post-2');

    await act(async () => {
      fireEvent(screen.getByTestId('saved-list'), 'onEndReached');
    });

    expect(await screen.findByText('contenido de post-1')).toBeTruthy();
    expect(screen.getAllByText('contenido de post-2')).toHaveLength(1);
    expect(screen.getAllByText('contenido de post-1')).toHaveLength(1);
    expect(getBookmarks).toHaveBeenNthCalledWith(2, 'abc');
  });

  it('E2-H12.CA3 - a failed reload keeps the saved posts on screen and shows an alert', async () => {
    const getBookmarks = jest
      .spyOn(postService, 'getBookmarks')
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: null })
      .mockRejectedValueOnce(
        new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('contenido de post-1');

    await act(async () => {
      fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    });

    expect(getBookmarks).toHaveBeenCalledTimes(2);
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
    expect(screen.queryByText('No se pudieron abrir tus guardados')).toBeNull();
    expect(alert).toHaveBeenCalledWith(
      'Error',
      'No se pudo conectar con el servidor. Revisá tu conexión.'
    );
  });

  it('a failed next page shows an alert and keeps the saved posts on screen', async () => {
    jest
      .spyOn(postService, 'getBookmarks')
      .mockResolvedValueOnce({ items: [item('post-2')], nextCursor: 'abc' })
      .mockRejectedValueOnce(new ApiError('Sin conexión.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('contenido de post-2');

    await act(async () => {
      fireEvent(screen.getByTestId('saved-list'), 'onEndReached');
    });

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Sin conexión.'));
    expect(screen.getByText('contenido de post-2')).toBeTruthy();
  });

  it('Volver goes back', async () => {
    jest.spyOn(postService, 'getBookmarks').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('Todavía no guardaste nada');
    fireEvent.press(screen.getByText(/Volver/));

    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});

describe('E2-H12. Guardados: acciones de la tarjeta', () => {
  // The saved list itself shows every post as saved; these tests need one not yet saved.
  const notSaved = item('post-1', { savedByMe: false });

  // Actions reconcile with getPost after each mutation; these tests only check the call.
  beforeEach(() => {
    jest.spyOn(postService, 'getBookmarks').mockResolvedValue({
      items: [notSaved],
      nextCursor: null,
    });
    jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  });

  async function renderWithPost() {
    renderScreen();
    await screen.findByText('contenido de post-1');
  }

  async function press(label: string) {
    await act(async () => {
      fireEvent.press(screen.getByLabelText(label), { stopPropagation: jest.fn() });
    });
  }

  it('the bookmark saves an unsaved post', async () => {
    const save = jest.spyOn(postService, 'saveBookmark').mockResolvedValue(undefined);
    await renderWithPost();

    await press('Guardar post');

    expect(save).toHaveBeenCalledWith('post-1');
  });

  it('the like button likes the post', async () => {
    const like = jest.spyOn(postService, 'likePost').mockResolvedValue(undefined);
    await renderWithPost();

    await press('Dar me gusta');

    expect(like).toHaveBeenCalledWith('post-1');
  });

  it('the retweet button retweets the post', async () => {
    const retweet = jest.spyOn(postService, 'retweet').mockResolvedValue(undefined);
    await renderWithPost();

    await press('Retweetear');

    expect(retweet).toHaveBeenCalledWith('post-1');
  });

  it('tapping the card opens the post', async () => {
    await renderWithPost();

    fireEvent.press(screen.getByLabelText('Abrir la publicación de @post-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-1' } });
  });

  it('Responder opens the composer with the post as parent', async () => {
    await renderWithPost();

    fireEvent.press(screen.getByLabelText('Responder a @post-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/compose', params: { parentId: 'post-1' } });
  });

  it('your own saved post has no flag', async () => {
    jest.spyOn(postService, 'getBookmarks').mockResolvedValue({
      items: [item('own', { authorId: 'usr-1', savedByMe: false })],
      nextCursor: null,
    });

    renderScreen();
    await screen.findByText('contenido de own');

    expect(screen.queryByLabelText(/Denunciar post de/)).toBeNull();
  });

  it('the flag on someone else post opens the report', async () => {
    await renderWithPost();

    await press('Denunciar post de @post-1');

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/report',
      params: { postId: 'post-1', handle: '@post-1' },
    });
  });
});
