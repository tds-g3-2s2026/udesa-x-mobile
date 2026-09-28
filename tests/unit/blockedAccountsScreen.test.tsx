import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import BlockedAccountsScreen from '../../app/(app)/blocked-accounts';
import { blockService } from '../../src/features/social/services/blockService';
import { ApiError } from '../../src/api/apiClient';
import { BlockedAccount } from '../../src/types/social';

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
      <BlockedAccountsScreen />
    </SafeAreaProvider>
  );
}

function account(id: string): BlockedAccount {
  return { id, handle: `@${id}`, createdAt: '2026-09-27T12:00:00Z' };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H4. Bloquear Usuario', () => {
  it('E3-H4.CA2 - lists the blocked accounts once they load', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValue({ items: [account('usr-2'), account('usr-3')], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('@usr-2')).toBeTruthy();
    expect(screen.getByText('@usr-3')).toBeTruthy();
  });

  it('shows a friendly empty state when nobody is blocked', async () => {
    jest.spyOn(blockService, 'getBlocked').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('No bloqueaste a nadie')).toBeTruthy();
  });

  it('E3-H4.CA2 - unblocking removes the account from the list', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });
    const unblock = jest.spyOn(blockService, 'unblock').mockResolvedValue(undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent.press(screen.getByText('Desbloquear'));
    });

    expect(unblock).toHaveBeenCalledWith('usr-2');
    await waitFor(() => expect(screen.queryByText('@usr-2')).toBeNull());
  });

  it('a failed unblock keeps the row and shows an alert', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });
    jest
      .spyOn(blockService, 'unblock')
      .mockRejectedValue(new ApiError('No se pudo desbloquear la cuenta. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent.press(screen.getByText('Desbloquear'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo desbloquear la cuenta. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('reaching the end of the list appends the next page, asked for with its cursor', async () => {
    const getBlocked = jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [account('usr-3')], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('blocked-list'), 'endReached');
    });

    expect(getBlocked).toHaveBeenLastCalledWith('cursor-1');
    expect(await screen.findByText('@usr-3')).toBeTruthy();
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('the row says it is unblocking while the call is in flight', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });
    let finish: () => void = () => undefined;
    jest.spyOn(blockService, 'unblock').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    renderScreen();
    await screen.findByText('@usr-2');
    fireEvent.press(screen.getByText('Desbloquear'));

    expect(await screen.findByText('Desbloqueando…')).toBeTruthy();
    await act(async () => finish());
  });

  it('the footer shows a spinner while the next page loads', async () => {
    let finish: (page: { items: BlockedAccount[]; nextCursor: null }) => void = () => undefined;
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );

    renderScreen();
    await screen.findByText('@usr-2');
    fireEvent(screen.getByTestId('blocked-list'), 'endReached');

    expect(await screen.findByTestId('blocked-list-footer-loading')).toBeTruthy();
    await act(async () => finish({ items: [], nextCursor: null }));
  });

  it('there is no next page to ask for once nextCursor comes back null', async () => {
    const getBlocked = jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('blocked-list'), 'endReached');
    });

    expect(getBlocked).toHaveBeenCalledTimes(1);
  });

  it('a next-page failure shows an alert and keeps the rows already on screen', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(
        new ApiError('No se pudieron cargar las cuentas bloqueadas. Intentalo de nuevo.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('blocked-list'), 'endReached');
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar las cuentas bloqueadas. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('a load failure shows an alert instead of an empty or stuck screen', async () => {
    jest
      .spyOn(blockService, 'getBlocked')
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

  it('the back link returns to whatever screen pushed this one', async () => {
    jest.spyOn(blockService, 'getBlocked').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('No bloqueaste a nadie');

    fireEvent.press(screen.getByText(/Volver/));

    expect(mockBack).toHaveBeenCalled();
  });
});
