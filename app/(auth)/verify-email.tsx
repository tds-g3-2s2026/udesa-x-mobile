import React, { useState } from 'react';
import { Alert, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';

// No field to paste a token into: the email only ever gives a link (GET
// /auth/verify?token=... already verifies the account the moment it is
// tapped), never the bare token as text, so there is nothing a person could
// realistically copy out of it by hand. The one real action on this screen
// is going to log in once that tap already happened.
export default function VerifyEmailScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email?.trim() ?? '';
  const emailLabel = email || 'tu correo registrado';

  const [isResending, setIsResending] = useState(false);

  const handleResend = async () => {
    if (!email) {
      Alert.alert('Error', 'No se encontró el correo a verificar. Volvé al registro.');
      return;
    }

    setIsResending(true);
    try {
      await authService.resendVerification(email);
      Alert.alert('Link reenviado', `Revisá tu bandeja de entrada en ${emailLabel}`);
    } catch (resendError) {
      Alert.alert('Error al reenviar', getAuthErrorMessage(resendError));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <View style={authStyles.badge}>
            <Text style={authStyles.badgeIcon}>✉️</Text>
          </View>
          <Text style={authStyles.title}>Revisá tu correo</Text>
          <Text style={authStyles.subtitle}>
            Te mandamos un link para verificar tu cuenta a{'\n'}
            <Text style={authStyles.emphasis}>{emailLabel}</Text>
            {'\n\n'}Tocalo desde el celular: se verifica sola. Después, volvé acá e iniciá sesión.
          </Text>
        </>
      }
      submitLabel="Ya toqué el link, iniciar sesión"
      onSubmit={() => router.replace('/(auth)/login')}
      footer={
        <>
          <Text style={authStyles.footerText}>¿No recibiste el correo? </Text>
          <Text style={authStyles.footerLink} onPress={isResending ? undefined : handleResend}>
            {isResending ? 'Reenviando...' : 'Reenviar link'}
          </Text>
        </>
      }
    >
      <></>
    </AuthScreen>
  );
}
