import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { resetPasswordSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { authStyles, colors } from '../../src/features/auth/components/authTheme';
import { useAuthStore } from '../../src/stores/authStore';

type FormField = 'token' | 'password' | 'passwordConfirmation';
type FieldErrors = Partial<Record<FormField, string>>;

// The API names its fields as it spells them on the wire; the form uses the
// camelCase names of the schema, so a 422 has to be translated before it can
// mark an input.
const API_FIELD_TO_FORM: Record<string, FormField> = {
  token: 'token',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
};

// The one failure that is not the user's fault and cannot be fixed by editing
// the form: the only way out is asking for another link.
const EXPIRED_TOKEN_CODE = 'reset-token-invalid';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  const [token, setToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTokenExpired, setIsTokenExpired] = useState(false);

  const clearFieldError = (field: FormField) => {
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  };

  const handleReset = async () => {
    setErrors({});
    const validation = resetPasswordSchema.safeParse({ token, password, passwordConfirmation });
    if (!validation.success) {
      const fieldErrors: FieldErrors = {};
      for (const issue of validation.error.issues) {
        const field = issue.path[0] as FormField;
        fieldErrors[field] ??= issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.resetPassword(validation.data);

      // Every session of the account was revoked server-side, so whatever this
      // device still had stored is dead: it is dropped before going back to
      // the login.
      await clearSession().catch(() => undefined);

      Alert.alert('Contraseña actualizada', 'Ya podés iniciar sesión con tu contraseña nueva.', [
        { text: 'Iniciar Sesión', onPress: () => router.replace('/(auth)/login') },
      ]);
    } catch (resetError) {
      if (resetError instanceof ApiError && resetError.code === EXPIRED_TOKEN_CODE) {
        setIsTokenExpired(true);
        return;
      }

      if (resetError instanceof ApiError && Object.keys(resetError.fieldErrors).length > 0) {
        const fieldErrors: FieldErrors = {};
        for (const [apiField, message] of Object.entries(resetError.fieldErrors)) {
          const field = API_FIELD_TO_FORM[apiField];
          if (field) fieldErrors[field] ??= message;
        }
        // A 422 whose fields are all unknown would leave the screen silent, so
        // the message still goes somewhere the user can read it.
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          return;
        }
      }

      // Covers the rejected reuse of the current password, which the API
      // reports about the password itself.
      setErrors({ password: getAuthErrorMessage(resetError) });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isTokenExpired) {
    return (
      <AuthScreen
        header={
          <>
            <View style={styles.expiredBadge}>
              <Ionicons name="time-outline" size={30} color={colors.danger} />
            </View>
            <Text style={authStyles.title}>El código ya no sirve</Text>
            <Text style={authStyles.subtitle}>
              Los códigos duran 10 minutos y se pueden usar una sola vez. Pedí uno nuevo para
              cambiar tu contraseña.
            </Text>
          </>
        }
        submitLabel="Pedir un código nuevo"
        onSubmit={() => router.replace('/(auth)/forgot-password')}
        footer={
          <>
            <Text style={authStyles.footerText}>¿Te acordaste? </Text>
            <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
              <Text style={authStyles.footerLink}>Iniciar sesión</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View />
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Creá tu contraseña nueva</Text>
          <Text style={authStyles.subtitle}>
            Pegá el código que te llegó por correo y elegí una contraseña que no hayas usado antes.
          </Text>
        </>
      }
      submitLabel="Cambiar contraseña"
      onSubmit={handleReset}
      isSubmitting={isSubmitting}
      footer={
        <>
          <Text style={authStyles.footerText}>¿No tenés el código? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/forgot-password')}>
            <Text style={authStyles.footerLink}>Pedir uno</Text>
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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={token}
        error={errors.token}
        onChangeText={(text) => {
          setToken(text);
          clearFieldError('token');
        }}
      />

      <FormInput
        ref={passwordRef}
        label="Contraseña nueva"
        placeholder="••••••••"
        secure
        hint="Al menos 8 caracteres, con una mayúscula y un número."
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => confirmationRef.current?.focus()}
        value={password}
        error={errors.password}
        onChangeText={(text) => {
          setPassword(text);
          clearFieldError('password');
        }}
      />

      <FormInput
        ref={confirmationRef}
        label="Repetí la contraseña"
        placeholder="••••••••"
        secure
        returnKeyType="go"
        onSubmitEditing={handleReset}
        value={passwordConfirmation}
        error={errors.passwordConfirmation}
        onChangeText={(text) => {
          setPasswordConfirmation(text);
          clearFieldError('passwordConfirmation');
        }}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  expiredBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.dangerSoft,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
});
