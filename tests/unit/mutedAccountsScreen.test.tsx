import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import MutedAccountsScreen from '../../app/(app)/muted-accounts';
import { muteService } from '../../src/features/social/services/muteService';
import { ApiError } from '../../src/api/apiClient';
import { MutedAccount } from '../../src/types/social';

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
      <MutedAccountsScreen />
    </SafeAreaProvider>
  );
}

function account(id: string): MutedAccount {
  return { id, handle: `@${id}`, createdAt: '2026-10-30T12:00:00Z' };
}

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E3-H10. Silenciar Usuario', () => {
  it('E3-H10.CA3 - lists the muted accounts and unmutes one', async () => {
    jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValue({ items: [account('usr-2'), account('usr-3')], nextCursor: null });
    const unmute = jest.spyOn(muteService, 'unmute').mockResolvedValue(undefined);

    renderScreen();
    expect(await screen.findByText('@usr-2')).toBeTruthy();
    expect(screen.getByText('@usr-3')).toBeTruthy();

    await act(async () => {
      fireEvent.press(screen.getAllByText('Dejar de silenciar')[0]);
    });

    expect(unmute).toHaveBeenCalledWith('usr-2');
    await waitFor(() => expect(screen.queryByText('@usr-2')).toBeNull());
    expect(screen.getByText('@usr-3')).toBeTruthy();
  });

  it('E3-H10.CA3 - says when nobody is muted', async () => {
    jest.spyOn(muteService, 'getMuted').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();

    expect(await screen.findByText('No silenciaste a nadie')).toBeTruthy();
  });

  it('a failed unmute keeps the row and shows an alert', async () => {
    jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });
    jest
      .spyOn(muteService, 'unmute')
      .mockRejectedValue(
        new ApiError('No se pudo dejar de silenciar la cuenta. Intentalo de nuevo.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent.press(screen.getByText('Dejar de silenciar'));
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo dejar de silenciar la cuenta. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('the row says it is unmuting while the call is in flight', async () => {
    jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });
    let finish: () => void = () => undefined;
    jest.spyOn(muteService, 'unmute').mockReturnValue(
      new Promise<void>((resolve) => {
        finish = resolve;
      })
    );

    renderScreen();
    await screen.findByText('@usr-2');
    fireEvent.press(screen.getByText('Dejar de silenciar'));

    expect(await screen.findByText('Quitando…')).toBeTruthy();
    await act(async () => finish());
  });

  it('reaching the end of the list appends the next page, asked for with its cursor', async () => {
    const getMuted = jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockResolvedValueOnce({ items: [account('usr-3')], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('muted-list'), 'endReached');
    });

    expect(getMuted).toHaveBeenLastCalledWith('cursor-1');
    expect(await screen.findByText('@usr-3')).toBeTruthy();
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('the footer shows a spinner while the next page loads', async () => {
    let finish: (page: { items: MutedAccount[]; nextCursor: null }) => void = () => undefined;
    jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockReturnValueOnce(
        new Promise((resolve) => {
          finish = resolve;
        })
      );

    renderScreen();
    await screen.findByText('@usr-2');
    fireEvent(screen.getByTestId('muted-list'), 'endReached');

    expect(await screen.findByTestId('muted-list-footer-loading')).toBeTruthy();
    await act(async () => finish({ items: [], nextCursor: null }));
  });

  it('there is no next page to ask for once nextCursor comes back null', async () => {
    const getMuted = jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValue({ items: [account('usr-2')], nextCursor: null });

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('muted-list'), 'endReached');
    });

    expect(getMuted).toHaveBeenCalledTimes(1);
  });

  it('a next-page failure shows an alert and keeps the rows already on screen', async () => {
    jest
      .spyOn(muteService, 'getMuted')
      .mockResolvedValueOnce({ items: [account('usr-2')], nextCursor: 'cursor-1' })
      .mockRejectedValueOnce(
        new ApiError('No se pudieron cargar las cuentas silenciadas. Intentalo de nuevo.')
      );
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen();
    await screen.findByText('@usr-2');

    await act(async () => {
      fireEvent(screen.getByTestId('muted-list'), 'endReached');
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudieron cargar las cuentas silenciadas. Intentalo de nuevo.'
      )
    );
    expect(screen.getByText('@usr-2')).toBeTruthy();
  });

  it('a load failure shows an alert instead of an empty or stuck screen', async () => {
    jest
      .spyOn(muteService, 'getMuted')
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
    jest.spyOn(muteService, 'getMuted').mockResolvedValue({ items: [], nextCursor: null });

    renderScreen();
    await screen.findByText('No silenciaste a nadie');

    fireEvent.press(screen.getByText(/Volver/));

    expect(mockBack).toHaveBeenCalled();
  });
});
