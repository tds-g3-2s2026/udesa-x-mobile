import React from 'react';
import { Alert, Keyboard, StyleSheet, type ViewStyle } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { HeaderHeightContext } from '@react-navigation/elements';
import * as SecureStore from 'expo-secure-store';
import ProfileScreen from '../../app/(app)/profile';
import LoginScreen from '../../app/(auth)/login';
import RegisterNameScreen from '../../app/(auth)/register/index';
import RegisterHandleScreen from '../../app/(auth)/register/handle';
import RegisterPasswordScreen from '../../app/(auth)/register/password';
import RegisterEmailScreen from '../../app/(auth)/register/email';
import VerifyEmailScreen from '../../app/(auth)/verify-email';
import { authService } from '../../src/features/auth/services/authService';
import { useAuthStore } from '../../src/stores/authStore';
import { useRegisterDraft } from '../../src/stores/registerDraftStore';
import { AUTH_SCREEN_BODY } from '../../src/features/auth/components/AuthScreen';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockDismissAll = jest.fn();

jest.mock('expo-router', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
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
    useRegisterDraft.setState({ values: COMPLETE_DRAFT });

    renderScreen(<RegisterPasswordScreen />);
    await press('Crear cuenta');

    expect(register).toHaveBeenCalledWith(COMPLETE_DRAFT);
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
    useRegisterDraft.setState({ values: COMPLETE_DRAFT });

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

describe('E1-H3. Cierre de Sesión', () => {
  it('E1-H3.CA2 - logging out wipes the local session from the device', async () => {
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
    renderScreen(<ProfileScreen />);
    await press('Cerrar Sesión');

    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_access_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_refresh_token');
    expect(SecureStore.deleteItemAsync).toHaveBeenCalledWith('udesa_x_user');
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().accessToken).toBeNull();
    expect(useAuthStore.getState().refreshToken).toBeNull();
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
