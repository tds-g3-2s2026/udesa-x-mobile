import React, { useEffect } from 'react';
import { Alert, StyleSheet } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { CurrentProfileContext } from '../../src/features/posts/currentProfile';
import { usePostInteractions } from '../../src/features/posts/usePostInteractions';
import { postService } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { useAuthStore } from '../../src/stores/authStore';
import { FeedItem } from '../../src/types/post';

const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

const loggedIn = {
  user: { id: 'usr-1', handle: '@demo', email: 'demo@udesa.edu.ar', isVerified: true },
  accessToken: 'jwt-access-token',
  refreshToken: 'jwt-refresh-token',
  isInitialized: true,
};

function post(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 'post-1',
    authorId: 'usr-2',
    authorHandle: '@ana',
    authorDisplayName: 'Ana Pérez',
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content: 'Hola',
    createdAt: '2026-10-17T12:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: 'post:post-1',
    activityAt: '2026-10-17T12:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
    ...overrides,
  };
}

beforeEach(() => {
  useAuthStore.setState(loggedIn);
});

afterEach(() => {
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isInitialized: false,
  });
});

const savable: FeedItem = {
  id: 'post-1',
  authorId: 'usr-2',
  authorHandle: '@ana',
  authorDisplayName: 'Ana Pérez',
  authorAvatarUrl: null,
  authorDeleted: false,
  deleted: false,
  content: 'Hola',
  createdAt: '2026-10-17T12:00:00Z',
  images: [],
  likesCount: 0,
  likedByMe: false,
  savedByMe: false,
  retweetedByMe: false,
  retweetedBy: null,
  entryId: 'post:post-1',
  activityAt: '2026-10-17T12:00:00Z',
  retweetsCount: 0,
  repliesCount: 0,
};

function BookmarkHarness() {
  const interactions = usePostInteractions();
  const { beginRead, acceptRead } = interactions;
  useEffect(() => {
    acceptRead(beginRead(), [savable]);
  }, [beginRead, acceptRead]);
  const current = interactions.forPost(savable);
  return (
    <PostCard
      item={current}
      onBookmark={() => interactions.toggleSave(savable)}
      bookmarkPending={interactions.isSavePending(savable.id)}
    />
  );
}

describe('E2-H12. Guardar Posts', () => {
  beforeEach(() => {
    jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('E2-H12.CA1 - saves and removes with one tap', async () => {
    const save = jest.spyOn(postService, 'saveBookmark').mockResolvedValue(undefined);
    const remove = jest.spyOn(postService, 'removeBookmark').mockResolvedValue(undefined);

    render(<BookmarkHarness />);
    await act(async () => undefined);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar post'), { stopPropagation: jest.fn() });
    });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('post-1');
    expect(screen.getByLabelText('Quitar de guardados')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Quitar de guardados'), {
        stopPropagation: jest.fn(),
      });
    });
    expect(remove).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith('post-1');
    expect(screen.getByLabelText('Guardar post')).toBeTruthy();
  });

  it('E2-H12.CA1 - a save the server confirms as saved keeps the saved label', async () => {
    jest.spyOn(postService, 'saveBookmark').mockResolvedValue(undefined);
    const fresh = jest
      .spyOn(postService, 'getPost')
      .mockResolvedValue({ ...post({ savedByMe: true }), parentId: null });

    render(<BookmarkHarness />);
    await act(async () => undefined);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar post'), { stopPropagation: jest.fn() });
    });
    await waitFor(() => expect(fresh).toHaveBeenCalledWith('post-1'));
    await act(async () => undefined);

    expect(screen.getByLabelText('Quitar de guardados')).toBeTruthy();
  });

  it('E2-H12.CA1 - the server state wins over an optimistic save it does not confirm', async () => {
    jest.spyOn(postService, 'saveBookmark').mockResolvedValue(undefined);
    const fresh = jest
      .spyOn(postService, 'getPost')
      .mockResolvedValue({ ...post({ savedByMe: false }), parentId: null });

    render(<BookmarkHarness />);
    await act(async () => undefined);
    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar post'), { stopPropagation: jest.fn() });
    });
    await waitFor(() => expect(fresh).toHaveBeenCalledWith('post-1'));
    await act(async () => undefined);

    expect(screen.getByLabelText('Guardar post')).toBeTruthy();
  });

  it('E2-H12.CA1 - a failed save rolls the button back and tells the user', async () => {
    jest
      .spyOn(postService, 'saveBookmark')
      .mockRejectedValue(new ApiError('No se pudo guardar el post. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<BookmarkHarness />);
    await act(async () => undefined);

    await act(async () => {
      fireEvent.press(screen.getByLabelText('Guardar post'), { stopPropagation: jest.fn() });
    });

    expect(screen.getByLabelText('Guardar post')).toBeTruthy();
    expect(alert).toHaveBeenCalledWith('Error', 'No se pudo guardar el post. Intentalo de nuevo.');
  });
});

describe('E2-H7. Post con Imagen', () => {
  const attached = [
    { id: 'img-0', url: 'https://bucket.s3.amazonaws.com/posts/0.jpg', position: 0 },
    { id: 'img-1', url: 'https://bucket.s3.amazonaws.com/posts/1.png', position: 1 },
  ];

  it('E2-H7.CA4 - a post with images shows them under its text', async () => {
    render(<PostCard item={post({ images: attached })} />);

    expect(await screen.findByTestId('post-image-grid')).toBeTruthy();
    expect(screen.getByLabelText('Imagen 2 de 2')).toBeTruthy();
  });

  it('a post without images shows no grid', async () => {
    render(<PostCard item={post()} />);

    await screen.findByText('Hola');
    expect(screen.queryByTestId('post-image-grid')).toBeNull();
  });

  it('a deleted post shows no images even if some came with it', async () => {
    render(<PostCard item={post({ deleted: true, content: null, images: attached })} />);

    await screen.findByText('[Post eliminado]');
    expect(screen.queryByTestId('post-image-grid')).toBeNull();
  });
});

describe('E1-H4. Eliminación de Cuenta', () => {
  const deletedAuthor = {
    authorHandle: null,
    authorDisplayName: null,
    authorDeleted: true,
    content: 'Una respuesta de antes',
  };

  it('E1-H4.CA5 - a reply from a deleted account shows [Usuario eliminado] and keeps its text', async () => {
    render(<PostCard item={post(deletedAuthor)} />);

    expect(await screen.findByText('[Usuario eliminado]')).toBeTruthy();
    expect(screen.getByText('Una respuesta de antes')).toBeTruthy();
  });

  it('E1-H4.CA5 - the deleted author does not open a profile that no longer exists', async () => {
    render(<PostCard item={post(deletedAuthor)} />);

    fireEvent.press(await screen.findByText('[Usuario eliminado]'));

    expect(mockPush).not.toHaveBeenCalled();
    expect(screen.queryByLabelText(/Ver el perfil de/)).toBeNull();
  });

  it('E1-H4.CA5 - does not show a stale name next to the deleted author marker', async () => {
    render(
      <PostCard item={post({ ...deletedAuthor, authorHandle: '@ana', authorDisplayName: 'Ana' })} />
    );

    await screen.findByText('[Usuario eliminado]');

    expect(screen.queryByText('@ana')).toBeNull();
    expect(screen.queryByText('Ana')).toBeNull();
  });

  it('an author that is not deleted still shows the name and opens the profile', async () => {
    render(<PostCard item={post()} />);

    fireEvent.press(await screen.findByLabelText('Ver el perfil de @ana'));

    expect(screen.queryByText('[Usuario eliminado]')).toBeNull();
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'usr-2' } });
  });
});

describe('E2-H14. Visualización de Perfil de Usuario', () => {
  // Every test waits on a find: the icons load their font after the first
  // render, and a test that ends before that leaves the update outside act().
  it('opens the profile of the author from a card', async () => {
    render(<PostCard item={post()} />);

    fireEvent.press(await screen.findByLabelText('Ver el perfil de @ana'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'usr-2' } });
  });

  it('does not link your own posts, your profile is a tab of its own', async () => {
    render(<PostCard item={post({ authorId: 'usr-1', authorHandle: '@demo' })} />);

    await screen.findByText('Hola');
    expect(screen.queryByLabelText('Ver el perfil de @demo')).toBeNull();
  });

  it('does not link the author of the profile already on display', async () => {
    render(
      <CurrentProfileContext.Provider value="usr-2">
        <PostCard item={post()} />
      </CurrentProfileContext.Provider>
    );

    await screen.findByText('Hola');
    expect(screen.queryByLabelText('Ver el perfil de @ana')).toBeNull();
  });
});

describe('E2-H8. Hashtags', () => {
  it('E2-H8.CA2 - a hashtag is a different, tappable link', () => {
    render(<PostCard item={post({ content: 'Hola #UdeSA, qué tal' })} />);

    const hashtag = screen.getByText('#UdeSA');

    expect(hashtag.props.accessibilityRole).toBe('link');
    expect(StyleSheet.flatten(hashtag.props.style)).toEqual(
      expect.objectContaining({ fontWeight: '600' })
    );
    expect(screen.getByText(/Hola/)).toBeTruthy();
    expect(screen.queryAllByRole('link', { name: /UdeSA/ })).toHaveLength(1);
  });

  it('E2-H8.CA3 - tapping a hashtag opens its search', () => {
    render(<PostCard item={post({ content: 'Hola #UdeSA y #tds' })} />);

    fireEvent.press(screen.getByText('#tds'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/search', params: { q: '#tds' } });
  });

  it('E2-H8.CA2 - a deleted post shows no hashtags', () => {
    render(<PostCard item={post({ deleted: true, content: '#UdeSA' })} />);

    expect(screen.queryByText('#UdeSA')).toBeNull();
    expect(screen.getByText('[Post eliminado]')).toBeTruthy();
  });
});
