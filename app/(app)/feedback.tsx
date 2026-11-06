import { useState } from 'react';
import { Alert, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, getAuthErrorMessage } from '../../src/api/apiClient';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { feedbackService, MAX_FEEDBACK_LENGTH } from '../../src/features/feedback/feedbackService';
import { useAuthStore } from '../../src/stores/authStore';

// Failures that mean the session is over: there is nothing to correct on the
// form, so the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

export default function FeedbackScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const authStyles = useAuthStyles();

  const [message, setMessage] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSend = async () => {
    setIsSubmitting(true);
    try {
      await feedbackService.send(message.trim());
      Alert.alert('¡Gracias!', 'Recibimos tu comentario.');
      router.back();
    } catch (sendError) {
      const code = sendError instanceof ApiError ? sendError.code : undefined;
      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(sendError));
        return;
      }
      // Only a rejected text can be corrected here. Anything else, like the
      // hourly limit, is shown as it comes and the text stays for a later try.
      const fieldError = sendError instanceof ApiError ? sendError.fieldErrors.message : undefined;
      if (fieldError) setError(fieldError);
      else Alert.alert('Error', getAuthErrorMessage(sendError));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Enviar comentarios</Text>
          <Text style={authStyles.subtitle}>Contanos qué mejorarías o qué no funcionó.</Text>
        </>
      }
      submitLabel="Enviar"
      onSubmit={handleSend}
      isSubmitting={isSubmitting}
      disabled={message.trim().length === 0}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      <FormInput
        label="Tu comentario"
        placeholder="Escribí acá"
        autoFocus
        multiline
        numberOfLines={6}
        maxLength={MAX_FEEDBACK_LENGTH}
        hint={`${message.length}/${MAX_FEEDBACK_LENGTH}`}
        value={message}
        error={error}
        onChangeText={(text) => {
          setMessage(text);
          setError(undefined);
        }}
      />
    </AuthScreen>
  );
}
