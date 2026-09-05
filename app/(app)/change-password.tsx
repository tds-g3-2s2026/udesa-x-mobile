import React, { useRef, useState } from 'react';
import { Alert, Text, TextInput } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { changePasswordSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { authStyles } from '../../src/features/auth/components/authTheme';
import { useAuthStore } from '../../src/stores/authStore';

type FormField = 'currentPassword' | 'password' | 'passwordConfirmation';
type FieldErrors = Partial<Record<FormField, string>>;

// The API spells its fields as they travel on the wire; the form uses the
// camelCase names of the schema, so a 422 has to be translated to mark an input.
const API_FIELD_TO_FORM: Record<string, FormField> = {
  current_password: 'currentPassword',
  password: 'password',
  password_confirmation: 'passwordConfirmation',
};

// Failures that are about a field of the form and not about the session. The
// wrong current password is answered with a 400 and not a 401 on purpose, so a
// typo never looks like an expired session.
const FIELD_ERROR_CODES: Record<string, FormField> = {
  'invalid-current-password': 'currentPassword',
  'too-many-password-attempts': 'currentPassword',
  'password-unchanged': 'password',
};

// Failures that mean the session is over: there is nothing to correct on the
// form, so the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

export default function ChangePasswordScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const passwordRef = useRef<TextInput>(null);
  const confirmationRef = useRef<TextInput>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clearFieldError = (field: FormField) => {
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  };

  const handleChange = async () => {
    setErrors({});
    const validation = changePasswordSchema.safeParse({
      currentPassword,
      password,
      passwordConfirmation,
    });
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
      await authService.changePassword(validation.data);

      // The change revoked every session of the account, including the token
      // this call just used, so the local one is dropped before anything else
      // tries to use it. The root layout swaps to the public group on its own.
      await clearSession().catch(() => undefined);

      Alert.alert('Contraseña actualizada', 'Volvé a iniciar sesión con tu contraseña nueva.');
    } catch (changeError) {
      const code = changeError instanceof ApiError ? changeError.code : undefined;

      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(changeError));
        return;
      }

      if (changeError instanceof ApiError) {
        const fieldErrors: FieldErrors = {};
        for (const [apiField, message] of Object.entries(changeError.fieldErrors)) {
          const field = API_FIELD_TO_FORM[apiField];
          if (field) fieldErrors[field] ??= message;
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          return;
        }
      }

      // Everything left is about one field: the current password being wrong,
      // too many tries, or the new password repeating the old one.
      const field = (code && FIELD_ERROR_CODES[code]) ?? 'currentPassword';
      setErrors({ [field]: getAuthErrorMessage(changeError) });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Cambiar contraseña</Text>
          <Text style={authStyles.subtitle}>
            Vas a tener que iniciar sesión de nuevo: cambiarla cierra la sesión en todos tus
            dispositivos.
          </Text>
        </>
      }
      submitLabel="Guardar contraseña"
      onSubmit={handleChange}
      isSubmitting={isSubmitting}
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
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={currentPassword}
        error={errors.currentPassword}
        onChangeText={(text) => {
          setCurrentPassword(text);
          clearFieldError('currentPassword');
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
        label="Repetí la contraseña nueva"
        placeholder="••••••••"
        secure
        returnKeyType="go"
        onSubmitEditing={handleChange}
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
