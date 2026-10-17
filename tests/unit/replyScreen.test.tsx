import { useEffect as mockUseEffect } from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import PostDetailScreen from '../../app/(app)/post/[id]';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { FeedItem, PostDetail } from '../../src/types/post';
import { useAuthStore } from '../../src/stores/authStore';

const mockPush = jest.fn();
const mockRouter = { push: mockPush };

jest.mock('expo-router', () => ({
  useRouter: () => mockRouter,
  useLocalSearchParams: () => ({ id: 'post-1' }),
  // Runs the focus effect once on mount, like a screen already focused when
  // it appeared. `mock`-prefixed so jest lets the factory reach it.
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(() => effect(), [effect]);
  },
}));

function reply(id: string, overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id,
    authorId: `usr-${id}`,
    authorHandle: `@${id}`,
    authorDisplayName: null,
    authorAvatarUrl: null,
    deleted: false,
    content: `contenido de ${id}`,
    createdAt: '2026-09-22T15:00:00Z',
    likesCount: 0,
    likedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:${id}`,
    activityAt: '2026-09-22T15:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

function original(overrides: Partial<PostDetail> = {}): PostDetail {
  return { ...reply('post-1'), parentId: null, ...overrides };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useAuthStore.setState({ user: null });
});

describe('E2-H4. Responder a un Post', () => {
  it('E2-H4.CA1 - shows the original post on top and its replies below', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    const getReplies = jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValue({ items: [reply('reply-1'), reply('reply-2')], nextCursor: null });

    render(<PostDetailScreen />);

    expect(await screen.findByText('contenido de post-1')).toBeTruthy();
    expect(screen.getByText('contenido de reply-1')).toBeTruthy();
    expect(screen.getByText('contenido de reply-2')).toBeTruthy();
    expect(getReplies).toHaveBeenCalledWith('post-1', null);
  });

  it('E2-H4.CA4 - reaching the end of the replies asks for the next page with its cursor', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    const getReplies = jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValueOnce({ items: [reply('reply-1')], nextCursor: '20' })
      .mockResolvedValueOnce({ items: [reply('reply-2')], nextCursor: null });

    render(<PostDetailScreen />);
    await screen.findByText('contenido de reply-1');

    await act(async () => {
      fireEvent(screen.getByTestId('replies-list'), 'endReached');
    });

    expect(getReplies).toHaveBeenLastCalledWith('post-1', '20');
    expect(await screen.findByText('contenido de reply-2')).toBeTruthy();
    expect(screen.getByText('contenido de reply-1')).toBeTruthy();
  });

  it('E2-H4.CA4 - there is no next page once nextCursor comes back null', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    const getReplies = jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValue({ items: [reply('reply-1')], nextCursor: null });

    render(<PostDetailScreen />);
    await screen.findByText('contenido de reply-1');

    await act(async () => {
      fireEvent(screen.getByTestId('replies-list'), 'endReached');
    });

    expect(getReplies).toHaveBeenCalledTimes(1);
  });

  it('E2-H4.CA4 - a next-page failure shows an alert and keeps the replies already on screen', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValueOnce({ items: [reply('reply-1')], nextCursor: '20' })
      .mockRejectedValueOnce(new ApiError('No se pudieron cargar las respuestas.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<PostDetailScreen />);
    await screen.findByText('contenido de reply-1');

    await act(async () => {
      fireEvent(screen.getByTestId('replies-list'), 'endReached');
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar las respuestas.')
    );
    expect(screen.getByText('contenido de reply-1')).toBeTruthy();
  });

  it('says so when nobody has replied yet', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest.spyOn(postService, 'getReplies').mockResolvedValue({ items: [], nextCursor: null });

    render(<PostDetailScreen />);

    expect(await screen.findByText('Todavía no hay respuestas.')).toBeTruthy();
  });

  it('E2-H4.CA1 - Responder on the original opens the composer with that post id', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest.spyOn(postService, 'getReplies').mockResolvedValue({ items: [], nextCursor: null });

    render(<PostDetailScreen />);
    fireEvent.press(await screen.findByLabelText('Responder a @post-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/compose', params: { parentId: 'post-1' } });
  });

  it('E2-H4.CA1 - Responder on a reply answers that reply, not the original', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValue({ items: [reply('reply-1')], nextCursor: null });

    render(<PostDetailScreen />);
    fireEvent.press(await screen.findByLabelText('Responder a @reply-1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/compose',
      params: { parentId: 'reply-1' },
    });
  });

  it('opening a reply shows its own thread', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest
      .spyOn(postService, 'getReplies')
      .mockResolvedValue({ items: [reply('reply-1')], nextCursor: null });

    render(<PostDetailScreen />);
    fireEvent.press(await screen.findByLabelText('Abrir la publicación de @reply-1'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'reply-1' } });
  });

  it('your own posts have no flag, since reporting yourself is refused', async () => {
    useAuthStore.setState({
      user: { id: 'usr-reply-1', handle: '@reply-1', email: 'a@udesa.edu.ar', isVerified: true },
    });
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest.spyOn(postService, 'getReplies').mockResolvedValue({
      items: [reply('reply-1'), reply('reply-2')],
      nextCursor: null,
    });

    render(<PostDetailScreen />);

    expect(await screen.findByLabelText('Denunciar post de @reply-2')).toBeTruthy();
    expect(screen.queryByLabelText('Denunciar post de @reply-1')).toBeNull();
  });

  it('the flag opens the report for that post', async () => {
    jest.spyOn(postService, 'getPost').mockResolvedValue(original());
    jest.spyOn(postService, 'getReplies').mockResolvedValue({ items: [], nextCursor: null });

    render(<PostDetailScreen />);
    fireEvent.press(await screen.findByLabelText('Denunciar post de @post-1'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/report',
      params: { postId: 'post-1', handle: '@post-1' },
    });
  });

  it('a post that cannot be loaded shows an alert and an unavailable state', async () => {
    jest
      .spyOn(postService, 'getPost')
      .mockRejectedValue(new ApiError('No se pudo cargar la publicación. Intentalo de nuevo.'));
    jest.spyOn(postService, 'getReplies').mockResolvedValue({ items: [], nextCursor: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<PostDetailScreen />);

    expect(await screen.findByText('Publicación no disponible')).toBeTruthy();
    expect(alert).toHaveBeenCalledWith(
      'Error',
      'No se pudo cargar la publicación. Intentalo de nuevo.'
    );
  });
});

test.each([
  ['post-1', 0],
  ['reply-1', 1],
] as const)('detail reactions target %s', async (id, index) => {
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValueOnce(original())
    .mockRejectedValue(new Error('offline'));
  jest
    .spyOn(postService, 'getReplies')
    .mockResolvedValue({ items: [reply('reply-1')], nextCursor: null });
  const share = jest.spyOn(postService, 'retweet').mockResolvedValue(undefined);
  const like = jest.spyOn(postService, 'likePost').mockResolvedValue(undefined);
  render(<PostDetailScreen />);
  await screen.findByText('contenido de reply-1');
  await act(async () =>
    fireEvent.press(screen.getAllByLabelText('Retweetear')[index], { stopPropagation: jest.fn() })
  );
  await act(async () =>
    fireEvent.press(screen.getAllByLabelText('Dar me gusta')[index], { stopPropagation: jest.fn() })
  );
  expect(share).toHaveBeenCalledWith(id);
  expect(like).toHaveBeenCalledWith(id);
});

test('E2-H3.CA4 - own deletion keeps the thread marker if the following refresh fails', async () => {
  const own = original();
  useAuthStore.setState({
    user: { id: own.authorId } as NonNullable<ReturnType<typeof useAuthStore.getState>['user']>,
  });
  jest
    .spyOn(postService, 'getPost')
    .mockResolvedValueOnce(own)
    .mockRejectedValue(new Error('offline'));
  jest
    .spyOn(postService, 'getReplies')
    .mockResolvedValue({ items: [reply('child')], nextCursor: null });
  jest.spyOn(postService, 'deletePost').mockResolvedValue(undefined);
  jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  render(<PostDetailScreen />);
  await screen.findByText(own.content as string);
  fireEvent.press(screen.getByLabelText('Eliminar publicación'), { stopPropagation: jest.fn() });
  await act(async () =>
    fireEvent.press(screen.getByText('Eliminar'), { stopPropagation: jest.fn() })
  );
  expect(await screen.findByText('[Post eliminado]')).toBeTruthy();
  expect(screen.getByText('contenido de child')).toBeTruthy();
  expect(screen.queryByText(own.content as string)).toBeNull();
});
