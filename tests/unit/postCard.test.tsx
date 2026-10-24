import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { CurrentProfileContext } from '../../src/features/posts/currentProfile';
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
    deleted: false,
    content: 'Hola',
    createdAt: '2026-10-17T12:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
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
