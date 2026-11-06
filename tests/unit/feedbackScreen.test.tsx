import React from 'react';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { AxiosHeaders, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import FeedbackScreen from '../../app/(app)/feedback';
import { ApiError, apiClient } from '../../src/api/apiClient';
import { feedbackService } from '../../src/features/feedback/feedbackService';
import { useAuthStore } from '../../src/stores/authStore';

const mockBack = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

const metrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};
const requestConfig = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
const created: AxiosResponse<{ id: string }> = {
  data: { id: 'feedback-1' },
  status: 201,
  statusText: 'Created',
  headers: {},
  config: requestConfig,
};

const FIELD = 'Escribí acá';
const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
const realSend = feedbackService.send;
const send = jest.spyOn(feedbackService, 'send');

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <FeedbackScreen />
    </SafeAreaProvider>
  );
}

function sendButton() {
  return screen.getByRole('button', { name: 'Enviar' });
}

async function pressSend() {
  await act(async () => {
    fireEvent.press(sendButton());
  });
}

beforeEach(() => {
  send.mockReset();
  alert.mockClear();
  mockBack.mockClear();
});

describe('E1-H11. Enviar Feedback o Reportar Error', () => {
  it('E1-H11.CA3 - sends the device metadata without showing it', async () => {
    send.mockImplementationOnce(realSend);
    const post = jest.spyOn(apiClient, 'post').mockResolvedValueOnce(created);
    renderScreen();

    fireEvent.changeText(await screen.findByPlaceholderText(FIELD), 'La app se cierra');
    await pressSend();

    const body = post.mock.calls[0][1] as Record<string, string>;
    expect(post.mock.calls[0][0]).toBe('/me/feedback');
    expect(body.message).toBe('La app se cierra');
    expect(body.device_os).toEqual(expect.any(String));
    expect(body.app_version).toEqual(expect.any(String));
    // The account comes from the session, not from anything the app sends.
    expect(Object.keys(body).sort()).toEqual(['app_version', 'device_os', 'message']);
    // What went out about the device appears nowhere on the form.
    expect(screen.queryByText(body.device_os, { exact: false })).toBeNull();
    expect(screen.queryByText(body.app_version, { exact: false })).toBeNull();

    post.mockRestore();
  });

  it('E1-H11.CA5 - keeps send disabled with only spaces', async () => {
    renderScreen();
    const field = await screen.findByPlaceholderText(FIELD);

    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: true });

    fireEvent.changeText(field, '   \n  ');
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: true });
    await pressSend();
    expect(send).not.toHaveBeenCalled();

    fireEvent.changeText(field, ' Hola ');
    expect(sendButton().props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('E1-H11.CA1 - counts the characters and stops at 500', async () => {
    renderScreen();
    const field = await screen.findByPlaceholderText(FIELD);

    expect(screen.getByText('0/500')).toBeTruthy();
    expect(field.props.maxLength).toBe(500);

    fireEvent.changeText(field, 'Hola');
    expect(screen.getByText('4/500')).toBeTruthy();
  });

  it('sends the text without its surrounding spaces, thanks and goes back', async () => {
    send.mockResolvedValueOnce(undefined);
    renderScreen();

    fireEvent.changeText(await screen.findByPlaceholderText(FIELD), '  Hola  ');
    await pressSend();

    expect(send).toHaveBeenCalledWith('Hola');
    expect(alert).toHaveBeenCalledWith('¡Gracias!', 'Recibimos tu comentario.');
    expect(mockBack).toHaveBeenCalledTimes(1);
  });

  it('E1-H11.CA4 - shows the message of the hourly limit and keeps the text', async () => {
    send.mockRejectedValueOnce(
      new ApiError('Ya enviaste 2 mensajes. Esperá 60 minutos', 'too-many-feedback-messages')
    );
    renderScreen();
    const field = await screen.findByPlaceholderText(FIELD);

    fireEvent.changeText(field, 'Hola');
    await pressSend();

    expect(alert).toHaveBeenCalledWith('Error', 'Ya enviaste 2 mensajes. Esperá 60 minutos');
    expect(mockBack).not.toHaveBeenCalled();
    expect(field.props.value).toBe('Hola');
  });

  it('E1-H11.CA5 - marks the field when the server rejects the text, until it changes', async () => {
    send.mockRejectedValueOnce(
      new ApiError('Datos inválidos', 'validation-error', {
        message: 'El mensaje no puede quedar vacío',
      })
    );
    renderScreen();
    const field = await screen.findByPlaceholderText(FIELD);

    fireEvent.changeText(field, 'Hola');
    await pressSend();

    expect(screen.getByText('El mensaje no puede quedar vacío')).toBeTruthy();
    expect(alert).not.toHaveBeenCalled();

    fireEvent.changeText(field, 'Hola de nuevo');
    expect(screen.queryByText('El mensaje no puede quedar vacío')).toBeNull();
  });

  it('a session that ended while sending signs the user out', async () => {
    const clearSession = jest.fn().mockResolvedValue(undefined);
    useAuthStore.setState({ clearSession });
    send.mockRejectedValueOnce(new ApiError('Tu sesión expiró.', 'session-revoked'));
    renderScreen();

    fireEvent.changeText(await screen.findByPlaceholderText(FIELD), 'Hola');
    await pressSend();

    await waitFor(() => expect(clearSession).toHaveBeenCalledTimes(1));
    expect(alert).toHaveBeenCalledWith('Tu sesión se cerró', 'Tu sesión expiró.');
  });

  it('cancels back without sending', async () => {
    renderScreen();

    fireEvent.press(await screen.findByText('Cancelar'));

    expect(mockBack).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });
});
