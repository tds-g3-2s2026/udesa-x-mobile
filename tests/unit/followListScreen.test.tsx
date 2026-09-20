import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FollowListScreen from '../../app/(app)/follow-list';
import { followService } from '../../src/features/social/services/followService';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError } from '../../src/api/apiClient';
import { FollowListItem } from '../../src/types/social';

const mockBack = jest.fn();
const mockUseLocalSearchParams = jest.fn<{ tab?: string }, []>(() => ({}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
  useLocalSearchParams: () => mockUseLocalSearchParams(),
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <FollowListScreen />
    </SafeAreaProvider>
  );
}

const loggedIn = {
  user: {
    id: 'usr-1',
    handle: '@demo',
    email: 'demo@udesa.edu.ar',
    isVerified: true,
  },
  accessToken: 'jwt-access-token',
  refreshToken: 'jwt-refresh-token',
  isInitialized: true,
};

function item(id: string, overrides: Partial<FollowListItem> = {}): FollowListItem {
  return {
    id,
    handle: `@${id}`,
    displayName: null,
    avatarUrl: null,
    following: false,
    createdAt: '2026-09-10T12:00:00Z',
    ...overrides,
  };
}

beforeEach(() => {
  useAuthStore.setState(loggedIn);
  mockUseLocalSearchParams.mockReturnValue({});
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

describe('E3-H3. Listado de Seguidores y Seguidos', () => {
  it('opens on the followers tab by default', async () => {
    const getFollowers = jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValue({ items: [item('usr-2')], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('@usr-2')).toBeTruthy();
    expect(getFollowers).toHaveBeenCalledWith('usr-1', null);
  });

  it('a tab param opens straight on Siguiendo', async () => {
    mockUseLocalSearchParams.mockReturnValue({ tab: 'following' });
    jest.spyOn(followService, 'getFollowers').mockResolvedValue({ items: [], nextCursor: null });
    const getFollowing = jest
      .spyOn(followService, 'getFollowing')
      .mockResolvedValue({ items: [item('usr-3')], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('@usr-3')).toBeTruthy();
    expect(getFollowing).toHaveBeenCalledWith('usr-1', null);
  });

  it('E3-H3.CA3 - each list has its own empty state text', async () => {
    jest.spyOn(followService, 'getFollowers').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('Todavía no te sigue nadie')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getByText('Siguiendo'));
    });

    expect(await screen.findByText('Todavía no seguís a nadie')).toBeTruthy();
  });

  it('E3-H3.CA1 - a row shows its display name, its handle and the follow button together', async () => {
    jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValue({ items: [item('usr-2', { displayName: 'Joaco' })], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('Joaco')).toBeTruthy();
    expect(screen.getByText('@usr-2')).toBeTruthy();
    expect(screen.getByText('Seguir')).toBeTruthy();
  });

  it('E3-H3.CA1 - a row already followed opens its button on Siguiendo, without a call per row', async () => {
    jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValue({ items: [item('usr-2', { following: true })], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });
    const follow = jest.spyOn(followService, 'follow');

    renderScreen();

    await screen.findByText('@usr-2');
    // Two matches on purpose: the Siguiendo tab itself, and this row's button
    // already painted the same way, both from the tab bar and from the "true"
    // already in the response — not from a follow call.
    expect(screen.getAllByText('Siguiendo')).toHaveLength(2);
    expect(follow).not.toHaveBeenCalled();
  });

  it('E3-H3.CA2 - reaching the end of the list asks for the next page with its cursor', async () => {
    const getFollowers = jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValueOnce({ items: [item('usr-2')], nextCursor: '20' })
      .mockResolvedValueOnce({ items: [item('usr-3')], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('follow-list'), 'endReached');
    });

    expect(getFollowers).toHaveBeenLastCalledWith('usr-1', '20');
    expect(await screen.findByText('@usr-3')).toBeTruthy();
    // The first page's row is still there: a next page appends, it does not replace.
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('E3-H3.CA2 - there is no next page once nextCursor comes back null', async () => {
    const getFollowers = jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValue({ items: [item('usr-2')], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('follow-list'), 'endReached');
    });

    expect(getFollowers).toHaveBeenCalledTimes(1);
  });

  it('a next-page failure shows an alert and keeps the rows already on screen', async () => {
    const getFollowers = jest
      .spyOn(followService, 'getFollowers')
      .mockResolvedValueOnce({ items: [item('usr-2')], nextCursor: '20' })
      .mockRejectedValueOnce(
        new ApiError('No se pudieron cargar los seguidores. Intentalo de nuevo.')
      );
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('follow-list'), 'endReached');
    });

    expect(getFollowers).toHaveBeenCalledTimes(2);
    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar los seguidores. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('a load failure shows an alert instead of an empty or stuck screen', async () => {
    jest
      .spyOn(followService, 'getFollowers')
      .mockRejectedValue(new ApiError('No se pudieron cargar los seguidores. Intentalo de nuevo.'));
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar los seguidores. Intentalo de nuevo.'
      )
    );
  });

  it('the back link returns to whatever screen pushed this one', async () => {
    jest.spyOn(followService, 'getFollowers').mockResolvedValue({ items: [], nextCursor: null });
    jest.spyOn(followService, 'getFollowing').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('Todavía no te sigue nadie');

    fireEvent.press(screen.getByText(/Volver/));

    expect(mockBack).toHaveBeenCalled();
  });
});
