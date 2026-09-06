import React from 'react';
import { Alert, Keyboard, StyleSheet, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import * as SecureStore from 'expo-secure-store';
import ProfileScreen from '../../app/(app)/(tabs)/profile';
import LoginScreen from '../../app/(auth)/login';
import RegisterNameScreen from '../../app/(auth)/register/index';
import RegisterHandleScreen from '../../app/(auth)/register/handle';
import RegisterPasswordScreen from '../../app/(auth)/register/password';
import RegisterEmailScreen from '../../app/(auth)/register/email';
import VerifyEmailScreen from '../../app/(auth)/verify-email';
import TermsScreen from '../../app/(auth)/terms';
import PrivacyScreen from '../../app/(auth)/privacy';
import ChangePasswordScreen from '../../app/(app)/change-password';
import EditProfileScreen from '../../app/(app)/edit-profile';
import ForgotPasswordScreen from '../../app/(auth)/forgot-password';
import ResetPasswordScreen from '../../app/(auth)/reset-password';
import { ApiError } from '../../src/api/apiClient';
import { apiClient, authService } from '../../src/features/auth/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { useRegisterDraft } from '../../src/stores/registerDraftStore';
import { AUTH_SCREEN_BODY } from '../../src/features/auth/components/AuthScreen';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();
const mockDismissAll = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
    back: mockBack,
    dismissAll: mockDismissAll,
    canDismiss: () => true,
  }),
  useLocalSearchParams: () => ({ email: 'jleon@udesa.edu.ar' }),
}));

jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(() => Promise.resolve()),
  getItemAsync: jest.fn(() => Promise.resolve(null)),
  deleteItemAsync: jest.fn(() => Promise.resolve()),
}));

const HANDLE_PLACEHOLDER = 'ej. @joaquin_dev';
const IDENTIFIER_PLACEHOLDER = 'ej. @joaquin_dev o jleon@udesa.edu.ar';
const initialMetrics = {
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  frame: { x: 0, y: 0, width: 390, height: 844 },
};

function renderScreen(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={initialMetrics}>{ui}</SafeAreaProvider>);
}

// Presses inside act so the button animation settles before the assertions.
async function press(label: string): Promise<void> {
  await act(async () => {
    fireEvent.press(screen.getByText(label));
  });
}
// Draft the wizard would hold after walking every step.
const COMPLETE_DRAFT = {
  fullName: 'Joaquín León',
  email: 'jleon@udesa.edu.ar',
  handle: '@joaquin_dev',
  password: 'Password123',
};

afterEach(() => {
  jest.restoreAllMocks();
  jest.clearAllMocks();
  useRegisterDraft.getState().reset();
});

describe('E1-H1. Registro de Usuarios', () => {
  it('E1-H1.CA5 - the first step only moves on once the name is filled', async () => {
    renderScreen(<RegisterNameScreen />);
    await press('Continuar');

    expect(screen.getByText(/al menos 2 caracteres/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();

    fireEvent.changeText(screen.getByPlaceholderText('Joaquín León'), 'Joaquín León');
    await press('Continuar');

    expect(mockPush).toHaveBeenCalledWith('/(auth)/register/email');
  });

  it('E1-H1.CA3 - the handle step adds the leading @ and stores the normalized handle', async () => {
    renderScreen(<RegisterHandleScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(HANDLE_PLACEHOLDER), 'joaquin_dev');

    expect(screen.getByPlaceholderText(HANDLE_PLACEHOLDER).props.value).toBe('@joaquin_dev');

    await press('Continuar');

    expect(useRegisterDraft.getState().values.handle).toBe('@joaquin_dev');
    expect(mockPush).toHaveBeenCalledWith('/(auth)/register/password');
  });

  it('E1-H1.CA3 - shows the handle rule and stays on the step', async () => {
    renderScreen(<RegisterHandleScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(HANDLE_PLACEHOLDER), 'ab');
    await press('Continuar');

    expect(screen.getByText(/debe comenzar con @/)).toBeTruthy();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('the last step registers the whole draft, pops the wizard and opens the verification', async () => {
    const register = jest.spyOn(authService, 'register').mockResolvedValue({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: false,
      },
      message: 'Registro exitoso',
      requireVerification: true,
    });
    useRegisterDraft.setState({ values: COMPLETE_DRAFT, termsAccepted: true });

    renderScreen(<RegisterPasswordScreen />);
    await press('Crear cuenta');

    expect(register).toHaveBeenCalledWith(COMPLETE_DRAFT, true);
    expect(mockDismissAll).toHaveBeenCalled();
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/(auth)/verify-email',
      params: { email: 'jleon@udesa.edu.ar' },
    });
    expect(useRegisterDraft.getState().values.password).toBe('');
  });

  it('E1-H1.CA2 - shows the error message returned by the API on a duplicated email', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'register')
      .mockRejectedValue(new Error('El correo ya está registrado'));
    useRegisterDraft.setState({ values: COMPLETE_DRAFT, termsAccepted: true });

    renderScreen(<RegisterPasswordScreen />);
    await press('Crear cuenta');

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith('Error', 'El correo ya está registrado')
    );
  });

  it('E1-H1.CA6 - shows the verification code rule when the code is not 6 digits', async () => {
    const verifyEmail = jest.spyOn(authService, 'verifyEmail');

    renderScreen(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('123456'), '123');
    await press('Verificar cuenta');

    expect(screen.getByText('El código debe tener exactamente 6 dígitos')).toBeTruthy();
    expect(verifyEmail).not.toHaveBeenCalled();
  });

  it('E1-H1.CA6 - shows the expiration error returned by the API', async () => {
    jest.spyOn(authService, 'verifyEmail').mockRejectedValue(new Error('El código expiró'));

    renderScreen(<VerifyEmailScreen />);
    fireEvent.changeText(screen.getByPlaceholderText('123456'), '123456');
    await press('Verificar cuenta');

    await waitFor(() => expect(screen.getByText('El código expiró')).toBeTruthy());
  });
  it('E1-H1.CA6 - renders 6 OTP slots and updates displayed digits as user types', () => {
    renderScreen(<VerifyEmailScreen />);
    const input = screen.getByPlaceholderText('123456');
    fireEvent.changeText(input, '123456');

    expect(screen.getByText('1')).toBeTruthy();
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('4')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });
});

describe('E1-H12. Aceptación de Términos y Política de Privacidad', () => {
  it('E1-H12.CA1 - Crear cuenta is blocked until the terms checkbox is checked', async () => {
    const register = jest.spyOn(authService, 'register').mockResolvedValue({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: false,
      },
      message: 'Registro exitoso',
      requireVerification: true,
    });
    useRegisterDraft.setState({ values: COMPLETE_DRAFT, termsAccepted: false });

    renderScreen(<RegisterPasswordScreen />);
    await press('Crear cuenta');
    expect(register).not.toHaveBeenCalled();

    // "go" on the keyboard reaches the same submit path as the button and has
    // to be blocked the same way (see the comment in RegisterStep.tsx).
    fireEvent(screen.getByPlaceholderText('••••••••'), 'submitEditing');
    expect(register).not.toHaveBeenCalled();

    await act(async () => {
      fireEvent.press(screen.getByRole('checkbox'));
    });
    await press('Crear cuenta');

    expect(register).toHaveBeenCalledWith(COMPLETE_DRAFT, true);
  });

  it('E1-H12.CA1 - the policy links open their screen without checking the box', async () => {
    useRegisterDraft.setState({ values: COMPLETE_DRAFT, termsAccepted: false });

    renderScreen(<RegisterPasswordScreen />);
    await act(async () => {
      fireEvent.press(screen.getByText('Términos y Condiciones'));
    });

    expect(mockPush).toHaveBeenCalledWith('/(auth)/terms');
    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false);
  });

  it('E1-H12.CA1 - renders the static terms and privacy screens', () => {
    renderScreen(<TermsScreen />);
    expect(screen.getByText('1. Aceptación de los términos')).toBeTruthy();

    renderScreen(<PrivacyScreen />);
    expect(screen.getByText('1. Qué datos recolectamos')).toBeTruthy();
  });
});

describe('E1-H2. Inicio de Sesión', () => {
  it('E1-H2.CA1 - a successful login opens the session that unlocks the private group', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: true,
      },
      tokens: { accessToken: 'jwt-access-token', refreshToken: 'jwt-refresh-token' },
    });

    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), '@joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123');
    await press('Iniciar Sesión');

    // No navigation is asserted: the root layout swaps groups from the session
    // itself, and tests/unit/navigationGuards.test.tsx covers that.
    await waitFor(() => expect(useAuthStore.getState().user?.handle).toBe('@joaquin_dev'));
    expect(useAuthStore.getState().accessToken).toBe('jwt-access-token');
  });

  it('fetches the profile after login, since login never returns display name or bio', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: true,
      },
      tokens: { accessToken: 'jwt-access-token', refreshToken: 'jwt-refresh-token' },
    });
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: 'Estudiante',
    });

    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), '@joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123');
    await press('Iniciar Sesión');

    await waitFor(() => expect(useAuthStore.getState().user?.displayName).toBe('Joaco'));
    expect(useAuthStore.getState().user?.bio).toBe('Estudiante');
    // The rest of the session set by login is untouched by the merge.
    expect(useAuthStore.getState().user?.fullName).toBe('Joaquín León');
  });

  it('does not block or alert on a successful login when fetching the profile fails', async () => {
    jest.spyOn(authService, 'login').mockResolvedValue({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: true,
      },
      tokens: { accessToken: 'jwt-access-token', refreshToken: 'jwt-refresh-token' },
    });
    jest.spyOn(authService, 'getProfile').mockRejectedValue(new ApiError('down'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);

    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), '@joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'Password123');
    await press('Iniciar Sesión');

    await waitFor(() => expect(useAuthStore.getState().user?.handle).toBe('@joaquin_dev'));
    expect(alert).not.toHaveBeenCalled();
  });

  it('E1-H2.CA3 - shows the generic credentials error raised by the service', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(authService, 'login').mockRejectedValue(new Error('Credenciales inválidas'));

    renderScreen(<LoginScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_PLACEHOLDER), '@joaquin_dev');
    fireEvent.changeText(screen.getByPlaceholderText('••••••••'), 'WrongPass1');
    await press('Iniciar Sesión');

    await waitFor(() => expect(alert).toHaveBeenCalledWith('Error', 'Credenciales inválidas'));
  });
});

describe('E1-H5. Olvidé Mi Contraseña', () => {
  const IDENTIFIER_FIELD = 'ej. @joaquin_dev o jleon@udesa.edu.ar';
  const TOKEN_FIELD = 'Pegá el código acá';

  async function fillReset(token: string, password: string, confirmation: string) {
    fireEvent.changeText(screen.getByPlaceholderText(TOKEN_FIELD), token);
    const secureFields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.changeText(secureFields[0], password);
    fireEvent.changeText(secureFields[1], confirmation);
  }

  it('E1-H5.CA4 - the request answers with the same generic message, telling nothing apart', async () => {
    const forgotPassword = jest.spyOn(authService, 'forgotPassword').mockResolvedValue(undefined);

    renderScreen(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_FIELD), 'noexiste@udesa.edu.ar');
    await press('Enviar código');

    expect(forgotPassword).toHaveBeenCalledWith({ identifier: 'noexiste@udesa.edu.ar' });
    // Nothing on screen says whether the account was found.
    expect(screen.getByText(/Si esa cuenta existe/)).toBeTruthy();
  });

  it('E1-H5.CA8 - shows the rate limit reported by the API instead of a generic error', async () => {
    jest
      .spyOn(authService, 'forgotPassword')
      .mockRejectedValue(
        new ApiError(
          'Se pidieron demasiados links de recuperación. Espera 60 minutos',
          'too-many-reset-requests'
        )
      );

    renderScreen(<ForgotPasswordScreen />);
    fireEvent.changeText(screen.getByPlaceholderText(IDENTIFIER_FIELD), 'jleon@udesa.edu.ar');
    await press('Enviar código');

    await waitFor(() => expect(screen.getByText(/demasiados links/)).toBeTruthy());
  });

  it('E1-H5.CA2 - an expired link offers asking for a new one instead of a dead form', async () => {
    jest
      .spyOn(authService, 'resetPassword')
      .mockRejectedValue(
        new ApiError(
          'El link de recuperación es invalido o expiro. Pedi uno nuevo',
          'reset-token-invalid'
        )
      );

    renderScreen(<ResetPasswordScreen />);
    await fillReset('expired-token', 'Password123', 'Password123');
    await press('Cambiar contraseña');

    await waitFor(() => expect(screen.getByText('El código ya no sirve')).toBeTruthy());

    await press('Pedir un código nuevo');
    expect(mockReplace).toHaveBeenCalledWith('/(auth)/forgot-password');
  });

  it('E1-H5.CA3 - a mismatched confirmation is caught before reaching the API', async () => {
    const resetPassword = jest.spyOn(authService, 'resetPassword');

    renderScreen(<ResetPasswordScreen />);
    await fillReset('reset-token-1', 'Password123', 'Password124');
    await press('Cambiar contraseña');

    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();
    expect(resetPassword).not.toHaveBeenCalled();
  });

  it('E1-H5.CA6 - shows the API refusal to reuse the current password', async () => {
    jest
      .spyOn(authService, 'resetPassword')
      .mockRejectedValue(
        new ApiError(
          'La contraseña nueva tiene que ser distinta de la actual',
          'password-unchanged'
        )
      );

    renderScreen(<ResetPasswordScreen />);
    await fillReset('reset-token-1', 'Password123', 'Password123');
    await press('Cambiar contraseña');

    await waitFor(() => expect(screen.getByText(/distinta de la actual/)).toBeTruthy());
  });

  it('E1-H5.CA3 - marks the field the API rejected on a 422', async () => {
    jest.spyOn(authService, 'resetPassword').mockRejectedValue(
      new ApiError('Revisá los campos marcados.', 'validation-failed', {
        password_confirmation: 'Value error, Las contraseñas no coinciden',
      })
    );

    renderScreen(<ResetPasswordScreen />);
    // The client side check has to pass so the API answer is what gets shown.
    await fillReset('reset-token-1', 'Password123', 'Password123');
    await press('Cambiar contraseña');

    await waitFor(() =>
      expect(screen.getByText('Value error, Las contraseñas no coinciden')).toBeTruthy()
    );
  });

  it('E1-H5.CA7 - a successful reset wipes the local session before going back to the login', async () => {
    jest.spyOn(authService, 'resetPassword').mockResolvedValue({ handle: '@joaquin_dev' });
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState({
      user: {
        id: 'usr-1',
        handle: '@joaquin_dev',
        email: 'jleon@udesa.edu.ar',
        fullName: 'Joaquín León',
        isVerified: true,
      },
      accessToken: 'jwt-access-token',
      refreshToken: 'jwt-refresh-token',
      isInitialized: true,
    });

    renderScreen(<ResetPasswordScreen />);
    await fillReset('reset-token-1', 'Password123', 'Password123');
    await press('Cambiar contraseña');

    // The backend revoked every session, so whatever this device still held is dead.
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_access_token');
  });
});

describe('E1-H13. Cambiar Contraseña', () => {
  const loggedIn = {
    user: {
      id: 'usr-1',
      handle: '@joaquin_dev',
      email: 'jleon@udesa.edu.ar',
      fullName: 'Joaquín León',
      isVerified: true,
    },
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    isInitialized: true,
  };

  async function fillChange(current: string, next: string, confirmation: string) {
    const fields = screen.getAllByPlaceholderText('••••••••');
    fireEvent.changeText(fields[0], current);
    fireEvent.changeText(fields[1], next);
    fireEvent.changeText(fields[2], confirmation);
  }

  it('E1-H13.CA3 - wipes the local session after a successful password change', async () => {
    jest.spyOn(authService, 'changePassword').mockResolvedValue(undefined);
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Vieja1234', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    // The backend revoked every session, including the one that made this request.
    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_access_token');
  });

  it('E1-H13.CA4 - marks an incorrect current password without closing the session', async () => {
    jest
      .spyOn(authService, 'changePassword')
      .mockRejectedValue(
        new ApiError('La contraseña actual no es correcta', 'invalid-current-password')
      );
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Equivocada1', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    await waitFor(() =>
      expect(screen.getByText('La contraseña actual no es correcta')).toBeTruthy()
    );
    // A typing error must not sign the user out of the app.
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('E1-H13.CA3 - wipes the local session when it has already been revoked', async () => {
    jest
      .spyOn(authService, 'changePassword')
      .mockRejectedValue(
        new ApiError('Tu sesión se cerró. Iniciá sesión de nuevo', 'session-revoked')
      );
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Vieja1234', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });

  it('E1-H13.CA4 - shows the attempt limit without closing the session', async () => {
    jest
      .spyOn(authService, 'changePassword')
      .mockRejectedValue(
        new ApiError(
          'Erraste la contraseña actual demasiadas veces. Volvé a intentar el cambio en 15 minutos',
          'too-many-password-attempts'
        )
      );
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Equivocada1', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    await waitFor(() => expect(screen.getByText(/demasiadas veces/)).toBeTruthy());
    // This counter is separate from the login lockout, so the user remains signed in.
    expect(useAuthStore.getState().user).not.toBeNull();
  });

  it('marks the field rejected by the API and ignores unknown fields', async () => {
    jest.spyOn(authService, 'changePassword').mockRejectedValue(
      new ApiError('Revisá los campos marcados.', 'validation-failed', {
        password_confirmation: 'Las contraseñas no coinciden',
        unexpected_field: 'No se muestra en este formulario',
      })
    );
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Vieja1234', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    await waitFor(() => expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy());
  });

  it('returns to the previous screen and advances between password fields', async () => {
    useAuthStore.setState(loggedIn);
    renderScreen(<ChangePasswordScreen />);

    fireEvent(screen.getAllByPlaceholderText('••••••••')[0], 'submitEditing');
    fireEvent(screen.getAllByPlaceholderText('••••••••')[1], 'submitEditing');
    await press('Cancelar');

    expect(mockBack).toHaveBeenCalled();
  });

  it('shows a connection failure as a general error instead of blaming the current password field', async () => {
    // A connection failure carries no `code` (see ApiError/toAuthError), so it
    // must not fall through to the "current password" field by default.
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest
      .spyOn(authService, 'changePassword')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Vieja1234', 'Nueva1234', 'Nueva1234');
    await press('Guardar contraseña');

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo conectar con el servidor. Revisá tu conexión.'
      )
    );
    expect(
      screen.queryByText('No se pudo conectar con el servidor. Revisá tu conexión.')
    ).toBeNull();
  });

  it('E1-H13.CA2 - rejects a repeated password before reaching the API', async () => {
    const changePassword = jest.spyOn(authService, 'changePassword');
    useAuthStore.setState(loggedIn);

    renderScreen(<ChangePasswordScreen />);
    await fillChange('Vieja1234', 'Vieja1234', 'Vieja1234');
    await press('Guardar contraseña');

    expect(
      screen.getByText('La contraseña nueva tiene que ser distinta de la actual')
    ).toBeTruthy();
    expect(changePassword).not.toHaveBeenCalled();
  });
});

describe('E1-H6. Editar mi perfil', () => {
  const loggedIn = {
    user: {
      id: 'usr-1',
      handle: '@joaquin_dev',
      email: 'jleon@udesa.edu.ar',
      fullName: 'Joaquín León',
      isVerified: true,
    },
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    isInitialized: true,
  };

  it('shows the display name and bio on the profile once set, in place of fullName', async () => {
    useAuthStore.setState({
      ...loggedIn,
      user: { ...loggedIn.user, displayName: 'Joaco', bio: 'Estudiante de sistemas' },
    });

    renderScreen(<ProfileScreen />);

    expect(screen.getByText('Joaco')).toBeTruthy();
    expect(screen.getByText('Estudiante de sistemas')).toBeTruthy();
    expect(screen.queryByText('Joaquín León')).toBeNull();
  });

  it('falls back to fullName on the profile until a display name is set', async () => {
    useAuthStore.setState(loggedIn);

    renderScreen(<ProfileScreen />);

    expect(screen.getByText('Joaquín León')).toBeTruthy();
  });

  it('E1-H6 - loads the current profile to prefill the form', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: 'Estudiante',
    });
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);

    expect(await screen.findByDisplayValue('Joaco')).toBeTruthy();
    expect(screen.getByDisplayValue('Estudiante')).toBeTruthy();
  });

  it('E1-H6.CA5 - a blank display name is rejected before reaching the API', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: '',
      bio: '',
    });
    const updateProfile = jest.spyOn(authService, 'updateProfile');
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await waitFor(() => expect(screen.queryByText('Guardar cambios')).toBeTruthy());
    await press('Guardar cambios');

    expect(screen.getByText('El nombre visible no puede quedar vacío')).toBeTruthy();
    expect(updateProfile).not.toHaveBeenCalled();
  });

  it('E1-H6.CA6 - a successful save updates the store and the profile screen reflects it immediately, without a second GET', async () => {
    const getProfile = jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: '',
      bio: '',
    });
    jest.spyOn(authService, 'updateProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: 'Estudiante',
    });
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByPlaceholderText('Como querés que te vean');
    fireEvent.changeText(screen.getByPlaceholderText('Como querés que te vean'), 'Joaco');
    await press('Guardar cambios');

    await waitFor(() => expect(useAuthStore.getState().user?.displayName).toBe('Joaco'));
    expect(useAuthStore.getState().user?.bio).toBe('Estudiante');
    // getProfile only ran once, on mount: the PATCH response is what updated
    // the store, no extra round trip to re-fetch the profile.
    expect(getProfile).toHaveBeenCalledTimes(1);
  });

  it('E1-H6.CA5 - a field rejected by the API marks that input', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: '',
    });
    jest.spyOn(authService, 'updateProfile').mockRejectedValue(
      new ApiError('Revisá los campos marcados.', 'validation-failed', {
        display_name: 'Value error, El nombre visible no puede quedar vacío',
      })
    );
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByDisplayValue('Joaco');
    await press('Guardar cambios');

    await waitFor(() =>
      expect(screen.getByText('Value error, El nombre visible no puede quedar vacío')).toBeTruthy()
    );
  });

  it('shows a connection failure as a general error instead of blaming a field', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: '',
    });
    jest
      .spyOn(authService, 'updateProfile')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByDisplayValue('Joaco');
    await press('Guardar cambios');

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo conectar con el servidor. Revisá tu conexión.'
      )
    );
    expect(
      screen.queryByText('No se pudo conectar con el servidor. Revisá tu conexión.')
    ).toBeNull();
  });

  it('E1-H6 - a session revoked while loading the profile signs the user out', async () => {
    jest
      .spyOn(authService, 'getProfile')
      .mockRejectedValue(
        new ApiError('Tu sesión se cerró. Iniciá sesión de nuevo', 'session-revoked')
      );
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
  });

  it('E1-H6 - a non-session load failure shows a general error and goes back', async () => {
    jest
      .spyOn(authService, 'getProfile')
      .mockRejectedValue(new ApiError('No se pudo conectar con el servidor. Revisá tu conexión.'));
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);

    await waitFor(() =>
      expect(alert).toHaveBeenCalledWith(
        'Error',
        'No se pudo conectar con el servidor. Revisá tu conexión.'
      )
    );
    expect(mockBack).toHaveBeenCalled();
  });

  it('E1-H6 - a session revoked while saving signs the user out without touching the form', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: '',
    });
    jest
      .spyOn(authService, 'updateProfile')
      .mockRejectedValue(
        new ApiError('Tu sesión se cerró. Iniciá sesión de nuevo', 'session-revoked')
      );
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByDisplayValue('Joaco');
    await press('Guardar cambios');

    await waitFor(() => expect(useAuthStore.getState().user).toBeNull());
    // The screen returns as soon as the session is cleared: it must not also
    // pop the navigation stack, which the guards already do by swapping groups.
    expect(mockBack).not.toHaveBeenCalled();
  });

  it('E1-H6 - "next" on the name field focuses bio instead of submitting, and typing a bio reaches the save', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: '',
    });
    const updateProfile = jest.spyOn(authService, 'updateProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: 'Estudiante de sistemas',
    });
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByDisplayValue('Joaco');

    fireEvent(screen.getByPlaceholderText('Como querés que te vean'), 'submitEditing');
    expect(updateProfile).not.toHaveBeenCalled();

    fireEvent.changeText(
      screen.getByPlaceholderText('Contá algo sobre vos (opcional)'),
      'Estudiante de sistemas'
    );
    await press('Guardar cambios');

    expect(updateProfile).toHaveBeenCalledWith({
      displayName: 'Joaco',
      bio: 'Estudiante de sistemas',
    });
  });

  it('cancels back without saving', async () => {
    jest.spyOn(authService, 'getProfile').mockResolvedValue({
      id: 'usr-1',
      email: 'jleon@udesa.edu.ar',
      handle: '@joaquin_dev',
      displayName: 'Joaco',
      bio: '',
    });
    useAuthStore.setState(loggedIn);

    renderScreen(<EditProfileScreen />);
    await screen.findByDisplayValue('Joaco');
    await press('Cancelar');

    expect(mockBack).toHaveBeenCalled();
  });
});

describe('E1-H3. Cierre de Sesión', () => {
  const loggedInSession = {
    user: {
      id: 'usr-1',
      handle: '@joaquin_dev',
      email: 'jleon@udesa.edu.ar',
      fullName: 'Joaquín León',
      isVerified: true,
    },
    accessToken: 'jwt-access-token',
    refreshToken: 'jwt-refresh-token',
    isInitialized: true,
  };

  it('E1-H3.CA2 - logging out revokes the token in the backend and wipes the local session', async () => {
    const logout = jest.spyOn(authService, 'logout').mockResolvedValue(undefined);
    useAuthStore.setState(loggedInSession);
    renderScreen(<ProfileScreen />);
    await press('Cerrar Sesión');

    expect(logout).toHaveBeenCalled();
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_refresh_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_user');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('E1-H3.CA2 - still wipes the local session when the backend revocation is unreachable', async () => {
    // Exercises the real authService.logout (see authService.test.ts for its own
    // best-effort coverage): a rejected POST must not stop the local wipe below.
    jest.spyOn(apiClient, 'post').mockRejectedValueOnce(new Error('Network Error'));
    useAuthStore.setState(loggedInSession);
    renderScreen(<ProfileScreen />);
    await press('Cerrar Sesión');

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
  });

  it('reports a local wipe failure and keeps the profile visible', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    jest.spyOn(authService, 'logout').mockResolvedValue(undefined);
    jest.spyOn(useAuthStore.getState(), 'clearSession').mockRejectedValue(new Error('SecureStore'));
    useAuthStore.setState(loggedInSession);
    renderScreen(<ProfileScreen />);

    await press('Cerrar Sesión');

    expect(alert).toHaveBeenCalledWith(
      'Error',
      'No se pudieron borrar todos los datos de la sesión del dispositivo.'
    );
  });

  it('opens the password change screen from the profile', async () => {
    useAuthStore.setState(loggedInSession);
    renderScreen(<ProfileScreen />);

    await press('Cambiar contraseña');

    expect(mockPush).toHaveBeenCalledWith('/change-password');
  });

  it('opens the edit profile screen from the profile', async () => {
    useAuthStore.setState(loggedInSession);
    renderScreen(<ProfileScreen />);

    await press('Editar perfil');

    expect(mockPush).toHaveBeenCalledWith('/edit-profile');
  });
});

describe('Espacio para el teclado', () => {
  // Screen 800 tall with a keyboard 300 tall, so its top edge sits at y=500.
  const KEYBOARD_METRICS = { screenX: 0, screenY: 500, width: 390, height: 300 };

  function layoutScreen(): ViewStyle {
    fireEvent(screen.getByTestId(AUTH_SCREEN_BODY), 'layout', {
      nativeEvent: { layout: { x: 0, y: 0, width: 390, height: 800 } },
    });
    return StyleSheet.flatten(screen.getByTestId(AUTH_SCREEN_BODY).props.style) as ViewStyle;
  }

  it('leaves no gap under the form while the keyboard is closed', () => {
    renderScreen(<RegisterEmailScreen />);

    expect(layoutScreen().paddingBottom).toBe(0);
  });

  // Moving to another step of the wizard keeps the keyboard open, so no show event
  // is emitted for the new screen. Reading the position only from events left the
  // action button under the keyboard.
  it('clears the keyboard that was already open when the step mounted', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValue(true);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(KEYBOARD_METRICS);

    renderScreen(<RegisterEmailScreen />);

    expect(layoutScreen().paddingBottom).toBe(300);
  });

  // The header height arrives after the first render, debounced by the navigator.
  // Recomputing on it must not re-read `Keyboard.isVisible()`: on iOS that flag is
  // still false between `keyboardWillShow` and `keyboardDidShow`, and re-seeding
  // there dropped the keyboard position and put the button back under the keyboard.
  it('keeps the inset when the navigation header reports its measured height', () => {
    jest.spyOn(Keyboard, 'isVisible').mockReturnValueOnce(true).mockReturnValue(false);
    jest.spyOn(Keyboard, 'metrics').mockReturnValue(KEYBOARD_METRICS);

    const view = renderScreen(
      <HeaderHeightContext.Provider value={0}>
        <RegisterEmailScreen />
      </HeaderHeightContext.Provider>
    );
    expect(layoutScreen().paddingBottom).toBe(300);

    view.rerender(
      <SafeAreaProvider initialMetrics={initialMetrics}>
        <HeaderHeightContext.Provider value={56}>
          <RegisterEmailScreen />
        </HeaderHeightContext.Provider>
      </SafeAreaProvider>
    );

    // The form now starts 56px lower, so the keyboard covers 56px more of it.
    expect(layoutScreen().paddingBottom).toBe(356);
  });
});
