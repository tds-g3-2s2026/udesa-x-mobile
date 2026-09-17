import React, { useState } from 'react';
import { Alert, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { verifyEmailSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const params = useLocalSearchParams<{ email?: string }>();
  const email = params.email?.trim() ?? '';
  const emailLabel = email || 'tu correo registrado';

  const [token, setToken] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setError(null);

    const validation = verifyEmailSchema.safeParse({ token });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    setIsLoading(true);
    try {
      await authService.verifyEmail(validation.data);
      Alert.alert(
        '¡Cuenta verificada!',
        'Tu correo fue verificado correctamente. Ya podés iniciar sesión.',
        [{ text: 'Iniciar Sesión', onPress: () => router.replace('/(auth)/login') }]
      );
    } catch (verifyError) {
      setError(getAuthErrorMessage(verifyError));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!email) {
      setError('No se encontró el correo a verificar. Volvé al registro.');
      return;
    }

    setIsResending(true);
    setError(null);
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
          </Text>
        </>
      }
      submitLabel="Verificar cuenta"
      onSubmit={handleVerify}
      isSubmitting={isLoading}
      footer={
        <>
          <Text style={authStyles.footerText}>¿No recibiste el correo? </Text>
          <TouchableOpacity onPress={handleResend} disabled={isResending}>
            <Text style={authStyles.footerLink}>
              {isResending ? 'Reenviando...' : 'Reenviar link'}
            </Text>
          </TouchableOpacity>
        </>
      }
    >
      <FormInput
        label="Código del correo"
        placeholder="Pegá el código acá"
        autoCapitalize="none"
        autoCorrect={false}
        autoFocus
        returnKeyType="done"
        onSubmitEditing={handleVerify}
        value={token}
        error={error}
        onChangeText={(value) => {
          setToken(value);
          if (error) setError(null);
        }}
      />
    </AuthScreen>
  );
}
