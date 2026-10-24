import React from 'react';
import { Alert, type AlertButton } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import DeleteAccountScreen from '../../app/(app)/delete-account';
import { ApiError } from '../../src/api/apiClient';
import { authService } from '../../src/features/auth/services/authService';
import { useAuthStore } from '../../src/stores/authStore';

const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: mockBack }),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

const loggedIn = {
  user: {
    id: 'usr-1',
    handle: '@joaquin_dev',
    email: 'jleon@udesa.edu.ar',
    isVerified: true,
  },
  accessToken: 'jwt-access-token',
  refreshToken: 'jwt-refresh-token',
  isInitialized: true,
};

const SUBMIT = 'Eliminar mi cuenta';

function renderScreen() {
  return render(
    <SafeAreaProvider initialMetrics={initialMetrics}>
      <DeleteAccountScreen />
    </SafeAreaProvider>
  );
}

function typePassword(value: string) {
  fireEvent.changeText(screen.getByPlaceholderText('••••••••'), value);
}

async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText(label));
  });
}

// The deletion only goes out when the user accepts the final alert, so the
// tests answer it the way a person would: by pressing one of its buttons.
function answerAlert(alert: jest.SpyInstance, buttonText: string): Promise<void> {
  const buttons = alert.mock.calls[0][2] as AlertButton[];
  const button = buttons.find((candidate) => candidate.text === buttonText);
  return act(async () => {
    button?.onPress?.();
  });
}

function isDisabled(label: string): boolean {
  return Boolean(screen.getByRole('button', { name: label }).props.accessibilityState?.disabled);
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

describe('E1-H4. Eliminación de Cuenta', () => {
  it('E1-H4.CA3 pide la contraseña antes de confirmar', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const deleteAccount = jest.spyOn(authService, 'deleteAccount').mockResolvedValue(undefined);
    renderScreen();

    expect(isDisabled(SUBMIT)).toBe(true);
    await press(SUBMIT);
    expect(alert).not.toHaveBeenCalled();
    expect(deleteAccount).not.toHaveBeenCalled();

    typePassword('Secreta123');
    expect(isDisabled(SUBMIT)).toBe(false);
  });

  it('E1-H4.CA3 contraseña incorrecta no cierra sesión', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValue(
        new ApiError('La contraseña actual no es correcta', 'invalid-current-password')
      );
    renderScreen();

    typePassword('Equivocada1');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    await waitFor(() =>
      expect(screen.getByText('La contraseña actual no es correcta')).toBeTruthy()
    );
    // A typing error must not sign the user out nor wipe the device.
    expect(useAuthStore.getState().user).not.toBeNull();
    expect(SecureStore.deleteItemAsync).not.toHaveBeenCalled();
  });

  it('E1-H4.CA1 tras la baja la sesión queda borrada', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const deleteAccount = jest.spyOn(authService, 'deleteAccount').mockResolvedValue(undefined);
    const logout = jest.spyOn(authService, 'logout');
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    expect(deleteAccount).toHaveBeenCalledWith('Secreta123');
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_access_token');
    // The backend already revoked the session: logging out would only fail.
    expect(logout).not.toHaveBeenCalled();
  });

  it('E1-H4.CA1 - still tells the user the account is gone when the device wipe fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(authService, 'deleteAccount').mockResolvedValue(undefined);
    (SecureStore.deleteItemAsync as jest.Mock).mockRejectedValueOnce(new Error('keystore'));
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    // The server already deleted the account and revoked its tokens, so a
    // leftover on the device is not worth telling the user the deletion failed.
    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Cuenta eliminada', expect.any(String))
    );
  });

  it('E1-H4.CA3 - asks for a last confirmation and sends nothing until it is accepted', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const deleteAccount = jest.spyOn(authService, 'deleteAccount').mockResolvedValue(undefined);
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);

    expect(alert).toHaveBeenCalledWith(
      '¿Eliminar la cuenta definitivamente?',
      expect.any(String),
      expect.any(Array)
    );
    expect(deleteAccount).not.toHaveBeenCalled();

    await answerAlert(alert, 'Cancelar');

    expect(deleteAccount).not.toHaveBeenCalled();
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('E1-H4.CA1 - wipes the local session when it was already revoked', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValue(new ApiError('Tu sesión se cerró', 'session-revoked'));
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });

  it('E1-H4.CA3 - shows the attempt limit under the field without closing the session', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValue(
        new ApiError('Erraste la contraseña demasiadas veces.', 'too-many-password-attempts')
      );
    renderScreen();

    typePassword('Equivocada1');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    await waitFor(() => expect(screen.getByText(/demasiadas veces/)).toBeTruthy());
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('shows a failure that is not about the password as a general error, keeping the session', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith(
        'Error',
        'No se pudo conectar con el servidor. Revisá tu conexión.'
      )
    );
    expect(
      screen.queryByText('No se pudo conectar con el servidor. Revisá tu conexión.')
    ).toBeNull();
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('shows the server message when the account cannot be deleted from its state', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'deleteAccount')
      .mockRejectedValue(new ApiError('Tu cuenta está en revisión.', 'account-under-review'));
    renderScreen();

    typePassword('Secreta123');
    await press(SUBMIT);
    await answerAlert(alert, 'Eliminar');

    await waitFor(() =>
      expect(alert).toHaveBeenLastCalledWith('Error', 'Tu cuenta está en revisión.')
    );
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('submits from the keyboard and returns to the previous screen on cancel', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    renderScreen();

    fireEvent(screen.getByPlaceholderText('••••••••'), 'submitEditing');
    expect(alert).not.toHaveBeenCalled();

    typePassword('Secreta123');
    fireEvent(screen.getByPlaceholderText('••••••••'), 'submitEditing');
    expect(alert).toHaveBeenCalledTimes(1);

    await press('Cancelar');
    expect(mockBack).toHaveBeenCalled();
  });
});
