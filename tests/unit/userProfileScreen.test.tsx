import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import UserProfileScreen from '../../app/(app)/user/[id]';
import { postService } from '../../src/features/posts/services/postService';
import { profileService } from '../../src/features/social/services/profileService';
import { followService } from '../../src/features/social/services/followService';
import { muteService } from '../../src/features/social/services/muteService';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError } from '../../src/api/apiClient';
import { FeedItem } from '../../src/types/post';
import { UserProfile } from '../../src/types/social';

const mockBack = jest.fn();
const mockPush = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack, push: mockPush }),
  useLocalSearchParams: () => ({ id: 'usr-2' }),
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <UserProfileScreen />
    </SafeAreaProvider>
  );
}

const loggedIn = {
  user: { id: 'usr-1', handle: '@demo', email: 'demo@udesa.edu.ar', isVerified: true },
  accessToken: 'jwt-access-token',
  refreshToken: 'jwt-refresh-token',
  isInitialized: true,
};

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    id: 'usr-2',
    handle: '@ana',
    displayName: 'Ana Pérez',
    bio: 'Estudio en la UdeSA',
    avatarUrl: null,
    coverUrl: null,
    createdAt: '2026-09-01T12:00:00Z',
    followersCount: 10,
    followingCount: 3,
    isPrivate: false,
    isFollowedByMe: false,
    isMutedByMe: false,
    ...overrides,
  };
}

function post(id: string, content: string): FeedItem {
  return {
    id,
    authorId: 'usr-2',
    authorHandle: '@ana',
    authorDisplayName: 'Ana Pérez',
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content,
    createdAt: '2026-10-17T12:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:${id}`,
    activityAt: '2026-10-17T12:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
  };
}

beforeEach(() => {
  useAuthStore.setState(loggedIn);
});

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useAuthStore.setState({
    user: null,
    accessToken: null,
    refreshToken: null,
    isInitialized: false,
  });
});

describe('E2-H14. Visualización de Perfil de Usuario', () => {
  it('E2-H14.CA1 - shows the name, handle, biography, join date and counts', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(screen.getByText('@ana')).toBeTruthy();
    expect(screen.getByText('Estudio en la UdeSA')).toBeTruthy();
    expect(screen.getByText('Se unió en septiembre de 2026')).toBeTruthy();
    expect(screen.getByText('3 Siguiendo')).toBeTruthy();
    expect(screen.getByText('10 Seguidores')).toBeTruthy();
  });

  it('E2-H14.CA1 - stands in a default avatar while there are no profile photos', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByTestId('default-avatar')).toBeTruthy();
    expect(screen.getByTestId('default-cover')).toBeTruthy();
  });

  it('E1-H8 - shows the photo and the cover of an account that has them', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(
      profile({
        avatarUrl: 'https://bucket.example/avatar.jpg?sig=1',
        coverUrl: 'https://bucket.example/cover.jpg?sig=1',
      })
    );
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect((await screen.findByLabelText('Foto de perfil')).props.source).toEqual({
      uri: 'https://bucket.example/avatar.jpg?sig=1',
    });
    expect(screen.getByLabelText('Portada').props.source).toEqual({
      uri: 'https://bucket.example/cover.jpg?sig=1',
    });
    expect(screen.queryByTestId('default-avatar')).toBeNull();
  });

  it('E2-H14.CA2 - lists the posts of the account', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({
      items: [post('post-2', 'Segundo'), post('post-1', 'Primero')],
      nextCursor: null,
    });

    renderScreen();

    expect(await screen.findByText('Segundo')).toBeTruthy();
    expect(screen.getByText('Primero')).toBeTruthy();
  });

  it('E2-H14.CA2 - shows a post and its retweet by the same account as two rows', async () => {
    const written = post('post-1', 'Mío');
    const retweeted = { ...written, entryId: 'retweet:usr-2:post-1', retweetedBy: '@ana' };
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest
      .spyOn(profileService, 'getPosts')
      .mockResolvedValue({ items: [retweeted, written], nextCursor: null });

    renderScreen();

    expect(await screen.findAllByText('Mío')).toHaveLength(2);
    expect(screen.getByText('Retweeteado por @ana')).toBeTruthy();
  });

  it('E2-H14.CA4 - asks for the next page of twenty at the end of the list', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    const getPosts = jest
      .spyOn(profileService, 'getPosts')
      .mockResolvedValueOnce({ items: [post('post-1', 'Primero')], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [post('post-0', 'Anterior')], nextCursor: null });

    renderScreen();
    await screen.findByText('Primero');
    fireEvent(screen.getByTestId('profile-posts'), 'onEndReached');

    expect(await screen.findByText('Anterior')).toBeTruthy();
    expect(getPosts).toHaveBeenLastCalledWith('usr-2', 'cursor-1');
  });

  it('E2-H14.CA3 - says the account is private instead of listing its posts', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ isPrivate: true }));
    jest
      .spyOn(profileService, 'getPosts')
      .mockRejectedValue(
        new ApiError('Esta cuenta es protegida y no la seguís', 'account-is-private')
      );

    renderScreen();

    expect(await screen.findByText('Esta cuenta es privada')).toBeTruthy();
    expect(screen.getByText('Seguila para ver sus publicaciones.')).toBeTruthy();
    // The header still shows: CA.3 hides the posts, not the account.
    expect(screen.getByText('Ana Pérez')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
  });

  it('starts the follow button from the current relationship', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ isFollowedByMe: true }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByLabelText('Siguiendo')).toBeTruthy();
  });

  it('adds the new follower to the count after following', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(followService, 'follow').mockResolvedValue('following');

    renderScreen();
    fireEvent.press(await screen.findByLabelText('Seguir'));

    expect(await screen.findByText('11 Seguidores')).toBeTruthy();
  });

  it('hides the posts of a protected account as soon as it is unfollowed', async () => {
    jest
      .spyOn(profileService, 'getProfile')
      .mockResolvedValue(profile({ isPrivate: true, isFollowedByMe: true }));
    jest
      .spyOn(profileService, 'getPosts')
      .mockResolvedValue({ items: [post('post-1', 'Solo para seguidores')], nextCursor: null });
    jest.spyOn(followService, 'unfollow').mockResolvedValue();

    renderScreen();
    fireEvent.press(await screen.findByLabelText('Siguiendo'));

    expect(await screen.findByText('Esta cuenta es privada')).toBeTruthy();
    expect(screen.queryByText('Solo para seguidores')).toBeNull();
    expect(screen.getByText('9 Seguidores')).toBeTruthy();
  });

  it('shows no follow button on your own profile', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ id: 'usr-1' }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    await screen.findByText('Ana Pérez');
    expect(screen.queryByLabelText('Seguir')).toBeNull();
  });

  it('says why when the profile cannot be opened', async () => {
    jest
      .spyOn(profileService, 'getProfile')
      .mockRejectedValue(new ApiError('La cuenta no existe', 'user-not-found'));
    jest
      .spyOn(profileService, 'getPosts')
      .mockRejectedValue(new ApiError('La cuenta no existe', 'user-not-found'));

    renderScreen();

    expect(await screen.findByText('No se pudo abrir el perfil')).toBeTruthy();
    expect(screen.getByText('La cuenta no existe')).toBeTruthy();
  });

  it('goes back from the top of the screen', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('Ana Pérez');
    fireEvent.press(screen.getByText(/Volver/));

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
  });

  it('opens, answers and reports a post from the list, like the feed', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest
      .spyOn(profileService, 'getPosts')
      .mockResolvedValue({ items: [post('post-1', 'Primero')], nextCursor: null });

    renderScreen();
    fireEvent.press(await screen.findByLabelText('Abrir la publicación de @ana'));
    fireEvent.press(screen.getByLabelText('Responder a @ana'));
    fireEvent.press(screen.getByLabelText('Denunciar post de @ana'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-1' } });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/compose',
      params: { parentId: 'post-1' },
    });
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/report',
      params: { postId: 'post-1', handle: '@ana' },
    });
  });

  it('warns when the posts cannot be loaded and keeps the header', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest
      .spyOn(profileService, 'getPosts')
      .mockRejectedValue(new ApiError('No se pudieron cargar las publicaciones.'));

    renderScreen();

    expect(await screen.findByText('Ana Pérez')).toBeTruthy();
    expect(alert).toHaveBeenCalledWith('Error', 'No se pudieron cargar las publicaciones.');
  });

  it('warns when the next page cannot be loaded', async () => {
    const alert = jest.spyOn(Alert, 'alert');
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest
      .spyOn(profileService, 'getPosts')
      .mockResolvedValueOnce({ items: [post('post-1', 'Primero')], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(new ApiError('Sin conexión.'));

    renderScreen();
    await screen.findByText('Primero');
    fireEvent(screen.getByTestId('profile-posts'), 'onEndReached');

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Sin conexión.'));
  });
});

test('E2-H6.CA1 - profile posts preserve liking and undo after sharing card state', async () => {
  jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
  jest
    .spyOn(profileService, 'getPosts')
    .mockResolvedValue({ items: [post('post-1', 'Hola')], nextCursor: null });
  jest.spyOn(postService, 'getPost').mockRejectedValue(new Error('offline'));
  const like = jest.spyOn(postService, 'likePost').mockResolvedValue(undefined);
  const unlike = jest.spyOn(postService, 'unlikePost').mockResolvedValue(undefined);
  renderScreen();
  await screen.findByText('Hola');
  await act(async () =>
    fireEvent.press(screen.getByLabelText('Dar me gusta'), { stopPropagation: jest.fn() })
  );
  expect(like).toHaveBeenCalledWith('post-1');
  await act(async () =>
    fireEvent.press(screen.getByLabelText('Quitar me gusta'), { stopPropagation: jest.fn() })
  );
  expect(unlike).toHaveBeenCalledWith('post-1');
});

describe('E3-H10. Silenciar Usuario', () => {
  async function openMutePrompt() {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    fireEvent.press(await screen.findByLabelText('Silenciar'));
    const buttons = alert.mock.calls[0][2] as AlertButton[];
    return { alert, buttons };
  }

  it('E3-H10.CA2 - mutes from the profile and keeps following', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ isFollowedByMe: true }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
    const mute = jest.spyOn(muteService, 'mute').mockResolvedValue(undefined);
    const unfollow = jest.spyOn(followService, 'unfollow');

    renderScreen();
    const { alert, buttons } = await openMutePrompt();

    expect(alert.mock.calls[0][0]).toBe('¿Silenciar a @ana?');
    expect(alert.mock.calls[0][1]).toContain('La seguís siguiendo y no se entera');
    await act(async () => {
      buttons.find((button) => button.text === 'Silenciar')?.onPress?.();
    });

    expect(mute).toHaveBeenCalledWith('usr-2');
    expect(await screen.findByLabelText('Dejar de silenciar')).toBeTruthy();
    expect(screen.getByLabelText('Siguiendo')).toBeTruthy();
    expect(screen.getByText('10 Seguidores')).toBeTruthy();
    expect(unfollow).not.toHaveBeenCalled();
  });

  it('does not mute when the prompt is cancelled', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ handle: null }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
    const mute = jest.spyOn(muteService, 'mute');

    renderScreen();
    const { alert, buttons } = await openMutePrompt();
    buttons.find((button) => button.text === 'Cancelar')?.onPress?.();

    expect(alert.mock.calls[0][0]).toBe('¿Silenciar a esta cuenta?');
    expect(mute).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Silenciar')).toBeTruthy();
  });

  it('unmutes from the profile without asking', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ isMutedByMe: true }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
    const unmute = jest.spyOn(muteService, 'unmute').mockResolvedValue(undefined);
    const alert = jest.spyOn(Alert, 'alert');

    renderScreen();
    const button = await screen.findByLabelText('Dejar de silenciar');
    await act(async () => fireEvent.press(button));

    expect(unmute).toHaveBeenCalledWith('usr-2');
    expect(await screen.findByLabelText('Silenciar')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();
  });

  it('keeps the button as it was when muting fails', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile());
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });
    jest
      .spyOn(muteService, 'mute')
      .mockRejectedValue(new ApiError('No se pudo silenciar la cuenta. Intentalo de nuevo.'));

    renderScreen();
    const { alert, buttons } = await openMutePrompt();
    await act(async () => {
      buttons.find((button) => button.text === 'Silenciar')?.onPress?.();
    });

    expect(alert).toHaveBeenLastCalledWith(
      'Error',
      'No se pudo silenciar la cuenta. Intentalo de nuevo.'
    );
    expect(screen.getByLabelText('Silenciar')).toBeTruthy();
  });

  it('shows no mute button on your own profile', async () => {
    jest.spyOn(profileService, 'getProfile').mockResolvedValue(profile({ id: 'usr-1' }));
    jest.spyOn(profileService, 'getPosts').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    await screen.findByText('Ana Pérez');
    expect(screen.queryByLabelText('Silenciar')).toBeNull();
  });
});
