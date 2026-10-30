import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import NotificationsScreen from '../../app/(app)/(tabs)/notifications';
import { ApiError } from '../../src/api/apiClient';
import { SearchQueryProvider } from '../../src/features/search/SearchQueryProvider';
import { searchQueryClient } from '../../src/features/search/queryClient';
import { notificationService } from '../../src/features/notifications/notificationService';
import { AppNotification } from '../../src/features/notifications/types';
import { useAuthStore } from '../../src/stores/authStore';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useFocusEffect: (callback: React.EffectCallback) => {
    const React = jest.requireActual('react');
    React.useEffect(callback, [callback]);
  },
}));

const metrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function notification(index: number, overrides: Partial<AppNotification> = {}): AppNotification {
  return {
    id: `ntf-${index}`,
    type: 'follow',
    actor: { id: `usr-${index}`, handle: `cuenta${index}` },
    postId: null,
    replyId: null,
    createdAt: '2026-10-30T12:00:00.000Z',
    readAt: null,
    ...overrides,
  };
}

function page(from: number, count: number, nextCursor: string | null) {
  return {
    items: Array.from({ length: count }, (_, offset) => notification(from + offset)),
    nextCursor,
  };
}

const list = jest.spyOn(notificationService, 'list');
const markAllAsRead = jest.spyOn(notificationService, 'markAllAsRead');
const remove = jest.spyOn(notificationService, 'remove');
// Module level like the service spies: restoring mocks between tests would undo
// the service spies too, and later tests would reach the real client.
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <SearchQueryProvider>
        <NotificationsScreen />
      </SearchQueryProvider>
    </SafeAreaProvider>
  );
}

// The test renderer has no real touch system, so a drag is fed to the row's
// PanResponder the way React Native would: the responder handlers are called
// directly with a touch history holding where the finger is now, where it was
// on the previous event and when. fireEvent cannot do it: it only delivers
// responder events to a view that claims the touch when it starts, and the row
// only claims it once the finger moves. A single finger that started at x = 300.
function touches(x: number, previousX: number, time: number, dy = 0) {
  return {
    numberActiveTouches: 1,
    indexOfSingleActiveTouch: 0,
    mostRecentTimeStamp: time,
    touchBank: [
      {
        touchActive: true,
        startPageX: 300,
        startPageY: 40,
        startTimeStamp: 0,
        currentPageX: x,
        currentPageY: 40 + dy,
        currentTimeStamp: time,
        previousPageX: previousX,
        previousPageY: 40,
        previousTimeStamp: time - 10,
      },
    ],
  };
}

// Puts a finger down and moves it dx and dy points, then asks the row whether
// the drag is its to handle. The calls follow React Native's order: touching
// down resets the gesture, and the capture phase updates it before the
// bubbling phase reads it.
function claimsDrag(row: ReturnType<typeof screen.getByTestId>, dx: number, dy: number) {
  row.props.onStartShouldSetResponderCapture({
    nativeEvent: { touches: [{}] },
    touchHistory: touches(300, 300, 10),
  });
  const move = { touchHistory: touches(300 + dx, 300, 20, dy) };
  row.props.onMoveShouldSetResponderCapture(move);
  return row.props.onMoveShouldSetResponder(move);
}

// Puts the finger down at x = 300 and moves it dx points over `duration` ms.
// Then the finger is lifted, or the system cancels the gesture.
function swipe(
  row: ReturnType<typeof screen.getByTestId>,
  dx: number,
  { duration = 200, cancelled = false } = {}
) {
  act(() => {
    row.props.onResponderGrant({ touchHistory: touches(300, 300, 10) });
    row.props.onResponderMove({ touchHistory: touches(300 + dx, 300, 10 + duration) });
    const end = { touchHistory: touches(300 + dx, 300 + dx, 20 + duration) };
    if (cancelled) row.props.onResponderTerminate(end);
    else row.props.onResponderRelease(end);
  });
}

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
}

beforeEach(() => {
  searchQueryClient.setDefaultOptions({ queries: { retry: false, gcTime: Infinity } });
  searchQueryClient.clear();
  useAuthStore.setState({
    user: { id: 'viewer', handle: '@viewer', email: 'viewer@example.com', isVerified: true },
  });
  list.mockReset();
  markAllAsRead.mockReset();
  remove.mockReset();
});

afterEach(() => {
  searchQueryClient.clear();
  jest.clearAllMocks();
});

describe('E4-H3. Centro de Notificaciones In-App', () => {
  it('E4-H3.CA3 pide páginas de 20 y pide la siguiente al llegar al final', async () => {
    list.mockResolvedValueOnce(page(0, 20, 'cursor-2')).mockResolvedValueOnce(page(20, 5, null));
    renderScreen();

    expect(await screen.findByText('@cuenta0 empezó a seguirte')).toBeTruthy();
    expect(list).toHaveBeenCalledWith(null, expect.any(AbortSignal));

    await act(async () => {
      fireEvent(screen.getByTestId('notifications-list'), 'endReached');
    });

    await waitFor(() => expect(list).toHaveBeenCalledWith('cursor-2', expect.any(AbortSignal)));
    // The list is virtualized and only draws its first rows, so the second
    // page is checked where the screen keeps it rather than on screen.
    await waitFor(() =>
      expect(searchQueryClient.getQueryData(['notifications', 'viewer'])).toMatchObject({
        pages: [{ nextCursor: 'cursor-2' }, { nextCursor: null }],
      })
    );

    // Once the server says there is no more, reaching the end asks for nothing.
    list.mockClear();
    await act(async () => {
      fireEvent(screen.getByTestId('notifications-list'), 'endReached');
    });
    expect(list).not.toHaveBeenCalled();
  });

  it('E4-H3.CA1 las no leídas se ven distintas', async () => {
    list.mockResolvedValueOnce({
      items: [notification(1), notification(2, { readAt: '2026-10-30T13:00:00.000Z' })],
      nextCursor: null,
    });
    renderScreen();

    expect(await screen.findByLabelText('No leída. @cuenta1 empezó a seguirte')).toBeTruthy();
    expect(screen.getByLabelText('@cuenta2 empezó a seguirte')).toBeTruthy();
    expect(screen.queryByLabelText('No leída. @cuenta2 empezó a seguirte')).toBeNull();

    const unreadRow = screen.getByTestId('notification-ntf-1');
    const readRow = screen.getByTestId('notification-ntf-2');
    expect(unreadRow.props.style).not.toEqual(readRow.props.style);
  });

  it('E4-H3.CA2 el botón marca todas como leídas', async () => {
    list.mockResolvedValueOnce({ items: [notification(1), notification(2)], nextCursor: null });
    markAllAsRead.mockResolvedValueOnce(undefined);
    renderScreen();
    await screen.findByLabelText('No leída. @cuenta1 empezó a seguirte');

    await press('Marcar todas como leídas');

    expect(markAllAsRead).toHaveBeenCalledTimes(1);
    expect(await screen.findByLabelText('@cuenta1 empezó a seguirte')).toBeTruthy();
    expect(screen.getByLabelText('@cuenta2 empezó a seguirte')).toBeTruthy();
    expect(screen.queryByLabelText(/^No leída/)).toBeNull();
  });

  it('E4-H3.CA2 - the button is disabled when everything is already read', async () => {
    list.mockResolvedValueOnce({
      items: [notification(1, { readAt: '2026-10-30T13:00:00.000Z' })],
      nextCursor: null,
    });
    renderScreen();
    await screen.findByLabelText('@cuenta1 empezó a seguirte');

    expect(
      screen.getByRole('button', { name: 'Marcar todas como leídas' }).props.accessibilityState
    ).toMatchObject({ disabled: true });
  });

  it('E4-H3.CA2 - a failed read-all leaves the rows unread and says why', async () => {
    list.mockResolvedValueOnce({ items: [notification(1)], nextCursor: null });
    markAllAsRead.mockRejectedValueOnce(new ApiError('Sin conexión.'));
    renderScreen();
    await screen.findByLabelText('No leída. @cuenta1 empezó a seguirte');

    await press('Marcar todas como leídas');

    expect(alert).toHaveBeenCalledWith('Error', 'Sin conexión.');
    expect(screen.getByLabelText('No leída. @cuenta1 empezó a seguirte')).toBeTruthy();
  });

  it('E4-H3.CA4 swipe o tacho borran la notificación', async () => {
    list.mockResolvedValueOnce({
      items: [notification(1), notification(2), notification(3)],
      nextCursor: null,
    });
    remove.mockResolvedValue(undefined);
    renderScreen();
    await screen.findByText('@cuenta1 empezó a seguirte');

    // The trash icon.
    await act(async () => {
      fireEvent.press(screen.getAllByRole('button', { name: 'Borrar notificación' })[0]);
    });

    expect(remove).toHaveBeenCalledWith('ntf-1');
    // The query cache tells the screen on the next tick, not synchronously.
    await waitFor(() => expect(screen.queryByText('@cuenta1 empezó a seguirte')).toBeNull());

    // The swipe: a drag 150 points to the left, past the delete distance.
    swipe(screen.getByTestId('swipe-ntf-2'), -150);

    await waitFor(() => expect(remove).toHaveBeenCalledWith('ntf-2'));
    await waitFor(() => expect(screen.queryByText('@cuenta2 empezó a seguirte')).toBeNull());
    expect(screen.getByText('@cuenta3 empezó a seguirte')).toBeTruthy();
  });

  it('E4-H3.CA4 - a short or vertical drag does not delete', async () => {
    list.mockResolvedValueOnce({ items: [notification(1)], nextCursor: null });
    renderScreen();
    await screen.findByText('@cuenta1 empezó a seguirte');
    const row = screen.getByTestId('swipe-ntf-1');

    // A vertical or diagonal drag is left to the list, which keeps scrolling,
    // and so is a drag to the right.
    expect(claimsDrag(row, 0, 60)).toBe(false);
    expect(claimsDrag(row, -40, 30)).toBe(false);
    expect(claimsDrag(row, 40, 0)).toBe(false);
    // A drag to the left becomes a swipe, and the list cannot take it back.
    expect(claimsDrag(row, -40, 0)).toBe(true);
    expect(row.props.onResponderTerminationRequest()).toBe(false);

    // Released 50 points to the left, slower than a flick: the row goes back.
    swipe(row, -50, { duration: 400 });
    // Cancelled by the system past the delete distance: the row goes back too.
    swipe(row, -150, { cancelled: true });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 300));
    });
    expect(remove).not.toHaveBeenCalled();
    expect(screen.getByText('@cuenta1 empezó a seguirte')).toBeTruthy();
  });

  it('E4-H3.CA4 - a failed delete reloads the list from the server and says why', async () => {
    list.mockResolvedValue({ items: [notification(1)], nextCursor: null });
    remove.mockRejectedValueOnce(new ApiError('No se pudo borrar la notificación.'));
    renderScreen();
    await screen.findByText('@cuenta1 empezó a seguirte');

    await act(async () => {
      fireEvent.press(screen.getByRole('button', { name: 'Borrar notificación' }));
    });

    expect(alert).toHaveBeenCalledWith('Error', 'No se pudo borrar la notificación.');
    expect(await screen.findByText('@cuenta1 empezó a seguirte')).toBeTruthy();
  });

  it('opens the profile of a new follower and the post of a like', async () => {
    list.mockResolvedValueOnce({
      items: [notification(1), notification(2, { type: 'like', postId: 'post-9' })],
      nextCursor: null,
    });
    renderScreen();

    fireEvent.press(await screen.findByText('@cuenta1 empezó a seguirte'));
    fireEvent.press(screen.getByText('@cuenta2 le dio me gusta a tu publicación'));

    expect(mockPush).toHaveBeenCalledWith({ pathname: '/user/[id]', params: { id: 'usr-1' } });
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/post/[id]', params: { id: 'post-9' } });
  });

  it('a notification with nowhere to go does not navigate', async () => {
    list.mockResolvedValueOnce({ items: [notification(1, { type: 'mention' })], nextCursor: null });
    renderScreen();

    fireEvent.press(await screen.findByText('Tenés una notificación nueva'));

    expect(mockPush).not.toHaveBeenCalled();
  });

  it('shows the empty state when there are no notifications', async () => {
    list.mockResolvedValueOnce({ items: [], nextCursor: null });
    renderScreen();

    expect(await screen.findByText('No tenés notificaciones')).toBeTruthy();
  });

  it('shows why the first page failed and retries it', async () => {
    list
      .mockRejectedValueOnce(new ApiError('No se pudieron cargar las notificaciones.'))
      .mockResolvedValueOnce({ items: [notification(1)], nextCursor: null });
    renderScreen();

    expect(await screen.findByText('No se pudieron cargar las notificaciones.')).toBeTruthy();
    await press('Reintentar');

    expect(await screen.findByText('@cuenta1 empezó a seguirte')).toBeTruthy();
  });

  it('shows why the next page failed and retries only that page', async () => {
    list
      .mockResolvedValueOnce(page(0, 20, 'cursor-2'))
      .mockRejectedValueOnce(new ApiError('Se cortó la conexión.'))
      .mockResolvedValueOnce(page(20, 1, null));
    renderScreen();
    await screen.findByText('@cuenta0 empezó a seguirte');

    await act(async () => {
      fireEvent(screen.getByTestId('notifications-list'), 'endReached');
    });
    expect(await screen.findByText('Se cortó la conexión.')).toBeTruthy();

    await press('Reintentar');

    await waitFor(() =>
      expect(searchQueryClient.getQueryData(['notifications', 'viewer'])).toMatchObject({
        pages: [{ nextCursor: 'cursor-2' }, { nextCursor: null }],
      })
    );
    expect(list).toHaveBeenLastCalledWith('cursor-2', expect.any(AbortSignal));
    await waitFor(() => expect(screen.queryByText('Se cortó la conexión.')).toBeNull());
  });
});
