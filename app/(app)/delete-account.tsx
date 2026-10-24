import React, { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { useAuthStore } from '../../src/stores/authStore';

// Failures that are about the password typed here and not about the session. A
// wrong password is answered with a 400 and not a 401 on purpose, so a typo never
// looks like an expired session.
const PASSWORD_ERROR_CODES = ['invalid-current-password', 'too-many-password-attempts'];

// Failures that mean the session is over: there is nothing to correct on the
// form, so the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

export default function DeleteAccountScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const authStyles = useAuthStyles();

  const [currentPassword, setCurrentPassword] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const deleteAccount = async () => {
    setIsSubmitting(true);
    try {
      await authService.deleteAccount(currentPassword);

      // The deletion revoked every session of the account, including the token
      // this call just used, so the local one is dropped before anything else
      // tries to use it. The root layout swaps to the public group on its own.
      await clearSession().catch(() => undefined);

      Alert.alert('Cuenta eliminada', 'Tu cuenta se eliminó y ya no podés ingresar con ella.');
    } catch (deleteError) {
      const code = deleteError instanceof ApiError ? deleteError.code : undefined;

      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(deleteError));
        return;
      }

      // Only a recognized code blames the password: a dropped connection or an
      // unexpected error says nothing about what was typed.
      if (code && PASSWORD_ERROR_CODES.includes(code)) {
        setError(getAuthErrorMessage(deleteError));
      } else {
        Alert.alert('Error', getAuthErrorMessage(deleteError));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // The password is what confirms the deletion; the alert is the last chance to
  // back out of something that cannot be undone, so nothing is sent before it.
  const handleSubmit = () => {
    if (currentPassword.length === 0) return;
    setError(undefined);

    Alert.alert(
      '¿Eliminar la cuenta definitivamente?',
      'Se borran tu perfil, tus publicaciones y tus seguidores. No se puede deshacer.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Eliminar', style: 'destructive', onPress: deleteAccount },
      ]
    );
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Eliminar cuenta</Text>
          <Text style={authStyles.subtitle}>
            Se borran tu perfil, tus publicaciones y tus seguidores, y se cierra tu sesión en todos
            tus dispositivos. Ingresá tu contraseña para confirmar.
          </Text>
        </>
      }
      submitLabel="Eliminar mi cuenta"
      onSubmit={handleSubmit}
      isSubmitting={isSubmitting}
      disabled={currentPassword.length === 0}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      <FormInput
        label="Contraseña actual"
        placeholder="••••••••"
        secure
        autoFocus
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        value={currentPassword}
        error={error}
        onChangeText={(text) => {
          setCurrentPassword(text);
          setError(undefined);
        }}
      />
    </AuthScreen>
  );
}
