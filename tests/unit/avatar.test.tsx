import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { Avatar } from '../../src/features/social/components/Avatar';
import { ProfileBanner } from '../../src/features/social/components/ProfileBanner';
import { useAuthStore } from '../../src/stores/authStore';
import { FeedItem } from '../../src/types/post';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const PHOTO = 'https://bucket.example/avatars/usr-2.jpg?sig=1';

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
  useAuthStore.setState({
    user: { id: 'usr-1', handle: '@demo', email: 'demo@udesa.edu.ar', isVerified: true },
  });
});

describe('E1-H8. Foto de Perfil', () => {
  // The tests wait with findBy* for what they read first: the icons load their
  // font after the first render, and that update has to land inside act.
  it('E1-H8.CA5 - shows the default avatar without a photo', async () => {
    // Without a photo on the profile...
    render(<ProfileBanner avatarUrl={null} coverUrl={null} />);
    expect(await screen.findByTestId('default-avatar')).toBeTruthy();
    expect(screen.getByTestId('default-cover')).toBeTruthy();
    expect(screen.queryByLabelText('Foto de perfil')).toBeNull();
    screen.unmount();

    // ...and on a post, the author's included.
    render(<PostCard item={post()} />);
    expect(await screen.findByTestId('default-avatar')).toBeTruthy();
    expect(screen.queryByLabelText('Foto de perfil')).toBeNull();
  });

  it("E1-H8.CA5 - a post shows its author's photo", async () => {
    render(<PostCard item={post({ authorAvatarUrl: PHOTO })} />);

    expect((await screen.findByLabelText('Foto de perfil')).props.source).toEqual({ uri: PHOTO });
    expect(screen.queryByTestId('default-avatar')).toBeNull();
  });

  it('E1-H8.CA5 - a photo that fails to load falls back to the default avatar', async () => {
    const { rerender } = render(<Avatar url={PHOTO} size={40} />);

    fireEvent(screen.getByLabelText('Foto de perfil'), 'error');
    expect(await screen.findByTestId('default-avatar')).toBeTruthy();

    // The next read brings a freshly signed URL, which is tried again.
    rerender(<Avatar url="https://bucket.example/avatars/usr-2.jpg?sig=2" size={40} />);
    expect(screen.getByLabelText('Foto de perfil')).toBeTruthy();
  });

  it('a cover that fails to load leaves the plain band', () => {
    render(<ProfileBanner avatarUrl={null} coverUrl="https://bucket.example/covers/usr-2.jpg" />);

    fireEvent(screen.getByLabelText('Portada'), 'error');

    expect(screen.getByTestId('default-cover')).toBeTruthy();
  });
});
