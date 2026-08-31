import React, { useRef, useState } from 'react';
import { Alert, Text, TextInput, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { loginSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { authStyles } from '../../src/features/auth/components/authTheme';

export default function LoginScreen() {
  const router = useRouter();
  const setSession = useAuthStore((state) => state.setSession);
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
      // No navigation here: the root layout mounts the authenticated group as
      // soon as the session exists.
      await setSession(response.user, response.tokens);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
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
    </AuthScreen>
  );
}
