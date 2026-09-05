import { Stack } from 'expo-router';
import { colors } from '../../src/features/auth/components/authTheme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerBackTitle: 'Volver',
        headerTintColor: colors.primary,
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontWeight: '600',
          color: colors.text,
        },
        contentStyle: {
          backgroundColor: colors.surface,
        },
      }}
    >
      {/* Login is the root of the group: no back button, and the brand block
          replaces the header title. */}
      <Stack.Screen name="login" options={{ title: 'Iniciar Sesión', headerShown: false }} />

      {/* One route per step of the signup wizard: the native back button, the
          iOS swipe gesture and the Android hardware button move between steps
          without any interception. The title stays fixed so only the progress
          bar changes. */}
      <Stack.Screen name="register/index" options={{ title: 'Crear Cuenta' }} />
      <Stack.Screen name="register/email" options={{ title: 'Crear Cuenta' }} />
      <Stack.Screen name="register/handle" options={{ title: 'Crear Cuenta' }} />
      <Stack.Screen name="register/password" options={{ title: 'Crear Cuenta' }} />

      <Stack.Screen name="verify-email" options={{ title: 'Verificar Correo' }} />

      <Stack.Screen name="forgot-password" options={{ title: 'Recuperar Cuenta' }} />
      <Stack.Screen name="reset-password" options={{ title: 'Nueva Contraseña' }} />

      {/* Static policy screens linked from the terms checkbox. */}
      <Stack.Screen name="terms" options={{ title: 'Términos y Condiciones' }} />
      <Stack.Screen name="privacy" options={{ title: 'Política de Privacidad' }} />
    </Stack>
  );
}
