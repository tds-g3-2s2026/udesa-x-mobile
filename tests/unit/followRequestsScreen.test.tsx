import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FollowRequestsScreen from '../../app/(app)/follow-requests';
import { followService } from '../../src/features/social/services/followService';
import { ApiError } from '../../src/api/apiClient';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <FollowRequestsScreen />
    </SafeAreaProvider>
  );
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H1. Seguir a un Usuario', () => {
  it('E3-H1.CA2 - lists the pending requests once they load', async () => {
    jest.spyOn(followService, 'getFollowRequests').mockResolvedValue([
      { id: 'freq-1', requesterHandle: '@joaquin_dev', createdAt: '2026-09-10T12:00:00Z' },
      { id: 'freq-2', requesterHandle: '@ana_garcia', createdAt: '2026-09-10T12:00:00Z' },
    ]);

    renderScreen();

    expect(await screen.findByText('@joaquin_dev')).toBeTruthy();
    expect(screen.getByText('@ana_garcia')).toBeTruthy();
  });

  it('shows a friendly empty state when there is nothing pending', async () => {
    jest.spyOn(followService, 'getFollowRequests').mockResolvedValue([]);

    renderScreen();

    expect(await screen.findByText('No tenés solicitudes pendientes')).toBeTruthy();
  });

  it('a load failure shows an alert instead of an empty or stuck screen', async () => {
    jest
      .spyOn(followService, 'getFollowRequests')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo conectar con el servidor. Revisá tu conexión.'
      )
    );
  });

  it('E3-H1.CA2 - approving a request removes it from the list', async () => {
    jest
      .spyOn(followService, 'getFollowRequests')
      .mockResolvedValue([
        { id: 'freq-1', requesterHandle: '@joaquin_dev', createdAt: '2026-09-10T12:00:00Z' },
      ]);
    const approve = jest.spyOn(followService, 'approveFollowRequest').mockResolvedValue(undefined);

    renderScreen();
    await screen.findByText('@joaquin_dev');

    await act(async () => {
      fireEvent.press(screen.getByText('Aprobar'));
    });

    expect(approve).toHaveBeenCalledWith('freq-1');
    await waitFor(() => expect(screen.queryByText('@joaquin_dev')).toBeNull());
  });

  it('E3-H1.CA2 - rejecting a request removes it from the list', async () => {
    jest
      .spyOn(followService, 'getFollowRequests')
      .mockResolvedValue([
        { id: 'freq-1', requesterHandle: '@joaquin_dev', createdAt: '2026-09-10T12:00:00Z' },
      ]);
    const reject = jest.spyOn(followService, 'rejectFollowRequest').mockResolvedValue(undefined);

    renderScreen();
    await screen.findByText('@joaquin_dev');

    await act(async () => {
      fireEvent.press(screen.getByText('Rechazar'));
    });

    expect(reject).toHaveBeenCalledWith('freq-1');
    await waitFor(() => expect(screen.queryByText('@joaquin_dev')).toBeNull());
  });

  it('a failed resolution keeps the row and shows an alert instead of silently dropping it', async () => {
    jest
      .spyOn(followService, 'getFollowRequests')
      .mockResolvedValue([
        { id: 'freq-1', requesterHandle: '@joaquin_dev', createdAt: '2026-09-10T12:00:00Z' },
      ]);
    jest
      .spyOn(followService, 'approveFollowRequest')
      .mockRejectedValue(new ApiError('No se pudo aprobar la solicitud. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@joaquin_dev');

    await act(async () => {
      fireEvent.press(screen.getByText('Aprobar'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo aprobar la solicitud. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@joaquin_dev')).toBeTruthy();
  });

  it('the back link returns to whatever screen pushed this one', async () => {
    jest.spyOn(followService, 'getFollowRequests').mockResolvedValue([]);

    renderScreen();
    await screen.findByText('No tenés solicitudes pendientes');

    fireEvent.press(screen.getByText(/Volver/));

    expect(mockBack).toHaveBeenCalled();
  });
});
