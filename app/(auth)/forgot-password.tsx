import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { forgotPasswordSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { authStyles, colors } from '../../src/features/auth/components/authTheme';

// Shown once the request went through, whether or not the account exists: the
// API answers the same either way and the screen must not tell them apart.
const SENT_MESSAGE =
  'Si esa cuenta existe, te mandamos un correo con un código para restablecer la contraseña. ' +
  'El código vence a los 10 minutos.';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSent, setIsSent] = useState(false);

  const handleRequest = async () => {
    setError(null);
    const validation = forgotPasswordSchema.safeParse({ identifier });
    if (!validation.success) {
      setError(validation.error.issues[0].message);
      return;
    }

    setIsSubmitting(true);
    try {
      await authService.forgotPassword(validation.data);
      setIsSent(true);
    } catch (requestError) {
      // Covers the rate limit too: the API explains in its own message how
      // long the wait is, so it is shown as it comes.
      setError(getAuthErrorMessage(requestError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSent) {
    return (
      <AuthScreen
        header={
          <>
            <View style={authStyles.badge}>
              <Ionicons name="mail-outline" size={30} color={colors.primary} />
            </View>
            <Text style={authStyles.title}>Revisá tu correo</Text>
            <Text style={authStyles.subtitle}>{SENT_MESSAGE}</Text>
          </>
        }
        submitLabel="Ya tengo el código"
        onSubmit={() => router.push('/(auth)/reset-password')}
        footer={
          <>
            <Text style={authStyles.footerText}>¿No te llegó? </Text>
            <TouchableOpacity onPress={() => setIsSent(false)}>
              <Text style={authStyles.footerLink}>Pedir otro</Text>
            </TouchableOpacity>
          </>
        }
      >
        <View style={styles.hintBox}>
          <Text style={styles.hintText}>
            Copiá el código del correo y pegalo en la pantalla siguiente.
          </Text>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>¿Olvidaste tu contraseña?</Text>
          <Text style={authStyles.subtitle}>
            Escribí tu correo o tu nombre de usuario y te mandamos un código para crear una nueva.
          </Text>
        </>
      }
      submitLabel="Enviar código"
      onSubmit={handleRequest}
      isSubmitting={isSubmitting}
      footer={
        <>
          <Text style={authStyles.footerText}>¿Te acordaste? </Text>
          <TouchableOpacity onPress={() => router.replace('/(auth)/login')}>
            <Text style={authStyles.footerLink}>Iniciar sesión</Text>
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
        autoFocus
        returnKeyType="go"
        onSubmitEditing={handleRequest}
        value={identifier}
        error={error}
        onChangeText={(text) => {
          setIdentifier(text);
          if (error) setError(null);
        }}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  hintBox: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: colors.primarySoft,
  },
  hintText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
    textAlign: 'center',
  },
});
