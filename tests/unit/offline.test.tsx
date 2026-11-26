import { useEffect as mockUseEffect } from 'react';
import { act, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FeedScreen from '../../app/(app)/(tabs)/index';
import { OfflineNotice } from '../../src/features/connectivity/OfflineNotice';
import { SearchQueryProvider } from '../../src/features/search/SearchQueryProvider';
import { postService } from '../../src/features/posts/services/postService';
import { FeedItem } from '../../src/types/post';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), navigate: jest.fn() }),
  useFocusEffect: (effect: () => void | (() => void)) => {
    mockUseEffect(() => effect(), []);
  },
}));

const netInfo = jest.requireMock('@react-native-community/netinfo').default as {
  __emit: (state: { isConnected: boolean | null; isInternetReachable: boolean | null }) => void;
};

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderWithConnection(children: React.ReactNode) {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <SearchQueryProvider>{children}</SearchQueryProvider>
    </SafeAreaProvider>
  );
}

function item(id: string): FeedItem {
  return {
    id,
    authorId: `usr-${id}`,
    authorHandle: `@${id}`,
    authorDisplayName: null,
    authorAvatarUrl: null,
    authorDeleted: false,
    deleted: false,
    content: `contenido de ${id}`,
    createdAt: '2026-09-22T15:00:00Z',
    images: [],
    likesCount: 0,
    likedByMe: false,
    savedByMe: false,
    retweetedByMe: false,
    retweetedBy: null,
    entryId: `post:${id}`,
    activityAt: '2026-09-22T15:00:00Z',
    retweetsCount: 0,
    repliesCount: 0,
  };
}

const offline = { isConnected: false, isInternetReachable: false };
const online = { isConnected: true, isInternetReachable: true };

afterEach(() => {
  act(() => netInfo.__emit(online));
  jest.restoreAllMocks();
});

describe('T-57. Manejo de estado sin conexión', () => {
  it('T-57 - shows the offline notice when the connection drops', () => {
    renderWithConnection(<OfflineNotice />);
    expect(screen.queryByText('Sin conexión')).toBeNull();

    act(() => netInfo.__emit(offline));
    expect(screen.getByText('Sin conexión')).toBeTruthy();

    act(() => netInfo.__emit(online));
    expect(screen.queryByText('Sin conexión')).toBeNull();
  });

  it('T-57 - a connection that is joined but cannot reach the internet counts as offline', () => {
    renderWithConnection(<OfflineNotice />);

    act(() => netInfo.__emit({ isConnected: true, isInternetReachable: false }));

    expect(screen.getByText('Sin conexión')).toBeTruthy();
  });

  it('T-57 - refetches the feed when the connection comes back', async () => {
    const getFeed = jest
      .spyOn(postService, 'getFeed')
      .mockResolvedValueOnce({ items: [item('post-1')], nextCursor: null })
      .mockResolvedValueOnce({ items: [item('post-1'), item('post-2')], nextCursor: null });
    renderWithConnection(<FeedScreen />);
    expect(await screen.findByText('contenido de post-1')).toBeTruthy();

    act(() => netInfo.__emit(offline));
    expect(screen.getByText('contenido de post-1')).toBeTruthy();
    expect(getFeed).toHaveBeenCalledTimes(1);

    act(() => netInfo.__emit(online));

    expect(await screen.findByText('contenido de post-2')).toBeTruthy();
    expect(getFeed).toHaveBeenCalledTimes(2);
  });
});
