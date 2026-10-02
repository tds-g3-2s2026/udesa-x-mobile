import React, { useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { z } from 'zod';
import { useAuthStore } from '../../src/stores/authStore';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { loginSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';

// Only an email, never a handle, is of any use to the verify-email screen's
// resend: users-api looks the account up by email, and a handle typed in
// this same field would just come back "not found" on the other side.
const emailShape = z.string().email();

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
  const authStyles = useAuthStyles();
  const passwordRef = useRef<TextInput>(null);

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ identifier?: string; password?: string }>({});

  const handleLogin = async () => {
    setErrors({});
    const validation = loginSchema.safeParse({ identifier, password });

    if (!validation.success) {
      const fieldErrors: { identifier?: string; password?: string } = {};
      for (const issue of validation.error.issues) {
        if (issue.path[0] === 'identifier') fieldErrors.identifier = issue.message;
        if (issue.path[0] === 'password') fieldErrors.password = issue.message;
      }
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);
    try {
      const response = await authService.login(validation.data);
      // authService.login already resolves the identity via GET /me (the
      // login response itself carries no user data), so display name and bio
      // are already here — no second fetch needed.
      // No navigation here: the root layout mounts the authenticated group as
      // soon as the session exists.
      await setSession(response.user, response.tokens);
    } catch (error) {
      if (error instanceof ApiError && error.code === 'account-not-verified') {
        offerResend(validation.data.identifier);
        return;
      }
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  };

  // Reachable from login itself, not only from "Revisá tu correo": a 403
  // here is the one moment login already knows the account exists and just
  // needs its link sent again.
  const offerResend = (identifier: string) => {
    const trimmed = identifier.trim();
    const email = emailShape.safeParse(trimmed).success ? trimmed : undefined;

    Alert.alert(
      'Cuenta sin verificar',
      'Todavía no verificaste tu correo. Te podemos mandar el link de nuevo.',
      [
        { text: 'Ahora no', style: 'cancel' },
        {
          text: 'Reenviar el link',
          onPress: () =>
            router.push({ pathname: '/(auth)/verify-email', params: email ? { email } : {} }),
        },
      ]
    );
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.brand}>UdeSA-X</Text>
          <Text style={authStyles.subtitle}>Conectate con tu comunidad universitaria</Text>
        </>
      }
      submitLabel="Iniciar Sesión"
      onSubmit={handleLogin}
      isSubmitting={isLoading}
      footer={
        <>
          <Text style={authStyles.footerText}>¿No tenés una cuenta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={authStyles.footerLink}>Registrate</Text>
          </TouchableOpacity>
        </>
      }
    >
      <FormInput
        label="Usuario o Email"
        placeholder="ej. @joaquin_dev o jleon@udesa.edu.ar"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => passwordRef.current?.focus()}
        value={identifier}
        error={errors.identifier}
        onChangeText={(text) => {
          setIdentifier(text);
          if (errors.identifier) setErrors((prev) => ({ ...prev, identifier: undefined }));
        }}
      />

      <FormInput
        ref={passwordRef}
        label="Contraseña"
        placeholder="••••••••"
        secure
        returnKeyType="go"
        onSubmitEditing={handleLogin}
        value={password}
        error={errors.password}
        onChangeText={(text) => {
          setPassword(text);
          if (errors.password) setErrors((prev) => ({ ...prev, password: undefined }));
        }}
      />

      <TouchableOpacity
        style={styles.forgotLink}
        onPress={() => router.push('/(auth)/forgot-password')}
      >
        <Text style={authStyles.footerLink}>¿Olvidaste tu contraseña?</Text>
      </TouchableOpacity>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  forgotLink: {
    alignSelf: 'center',
    paddingVertical: 4,
  },
});
