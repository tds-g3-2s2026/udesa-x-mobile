import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import NotificationPreferencesScreen from '../../app/(app)/notification-preferences';
import { ApiError } from '../../src/api/apiClient';
import { notificationService } from '../../src/features/notifications/notificationService';
import { NotificationPreferences } from '../../src/features/notifications/types';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const allOn: NotificationPreferences = {
  like: true,
  retweet: true,
  reply: true,
  mention: true,
  follow: true,
  direct_message: true,
};

const LABELS = [
  'Me gusta',
  'Retweets',
  'Respuestas',
  'Menciones',
  'Nuevos seguidores',
  'Mensajes directos',
];

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
});

describe('E4-H5. Preferencias de Notificación', () => {
  it('E4-H5.CA1 - shows one switch per type', async () => {
    jest.spyOn(notificationService, 'getPreferences').mockResolvedValue(allOn);

    render(<NotificationPreferencesScreen />);

    expect(await screen.findAllByRole('switch')).toHaveLength(6);
    for (const label of LABELS) {
      expect(screen.getByLabelText(label)).toBeTruthy();
    }
  });

  it('shows each switch as the account saved it', async () => {
    jest
      .spyOn(notificationService, 'getPreferences')
      .mockResolvedValue({ ...allOn, retweet: false, direct_message: false });

    render(<NotificationPreferencesScreen />);

    expect((await screen.findByLabelText('Me gusta')).props.value).toBe(true);
    expect(screen.getByLabelText('Retweets').props.value).toBe(false);
    expect(screen.getByLabelText('Mensajes directos').props.value).toBe(false);
  });

  it('saves only the type that was tapped, and shows what the server answers', async () => {
    jest.spyOn(notificationService, 'getPreferences').mockResolvedValue(allOn);
    const update = jest
      .spyOn(notificationService, 'updatePreferences')
      .mockResolvedValue({ ...allOn, mention: false });

    render(<NotificationPreferencesScreen />);
    const mentions = await screen.findByLabelText('Menciones');
    await act(async () => {
      fireEvent(mentions, 'valueChange', false);
    });

    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith({ mention: false });
    await waitFor(() => expect(screen.getByLabelText('Menciones').props.value).toBe(false));
    expect(screen.getByLabelText('Me gusta').props.value).toBe(true);
  });

  it('says direct messages do not exist yet, and saves their switch like the others', async () => {
    jest.spyOn(notificationService, 'getPreferences').mockResolvedValue(allOn);
    const update = jest
      .spyOn(notificationService, 'updatePreferences')
      .mockResolvedValue({ ...allOn, direct_message: false });

    render(<NotificationPreferencesScreen />);
    expect(await screen.findByText(/Todavía no hay mensajes directos/)).toBeTruthy();
    await act(async () => {
      fireEvent(screen.getByLabelText('Mensajes directos'), 'valueChange', false);
    });

    expect(update).toHaveBeenCalledWith({ direct_message: false });
  });

  it('a failed save keeps the switch as it was and shows an alert', async () => {
    jest.spyOn(notificationService, 'getPreferences').mockResolvedValue(allOn);
    jest
      .spyOn(notificationService, 'updatePreferences')
      .mockRejectedValue(new ApiError('No se pudo guardar la preferencia. Intentalo de nuevo.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<NotificationPreferencesScreen />);
    const replies = await screen.findByLabelText('Respuestas');
    await act(async () => {
      fireEvent(replies, 'valueChange', false);
    });

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo guardar la preferencia. Intentalo de nuevo.'
      )
    );
    expect(screen.getByLabelText('Respuestas').props.value).toBe(true);
  });

  it('goes back with an alert when the preferences cannot be loaded', async () => {
    const message = 'No se pudieron cargar las preferencias. Intentalo de nuevo.';
    jest.spyOn(notificationService, 'getPreferences').mockRejectedValue(new ApiError(message));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    render(<NotificationPreferencesScreen />);

    await waitFor(() => expect(mockBack).toHaveBeenCalled());
    expect(alert).toHaveBeenCalledWith('Error', message);
    expect(screen.queryAllByRole('switch')).toHaveLength(0);
  });
});
