import React, { useState } from 'react';
import { Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { authService, getAuthErrorMessage } from '../../../src/features/auth/services/authService';
import { registerSchema } from '../../../src/features/auth/schemas/authSchemas';
import { REGISTER_STEPS } from '../../../src/features/auth/registerFlow';
import { RegisterStep } from '../../../src/features/auth/components/RegisterStep';
import { useRegisterDraft } from '../../../src/stores/registerDraftStore';

export default function RegisterPasswordScreen() {
  const router = useRouter();
  const values = useRegisterDraft((state) => state.values);
  const reset = useRegisterDraft((state) => state.reset);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleRegister = async () => {
    // The whole draft is validated again: a step could have been skipped by a
    // deep link, and the API must never receive a half filled registration.
    const validation = registerSchema.safeParse(values);
    if (!validation.success) {
      const issue = validation.error.issues[0];
      const step = REGISTER_STEPS.find((candidate) => candidate.field === issue.path[0]);
      Alert.alert('Revisá tus datos', issue.message, [
        { text: 'Corregir', onPress: () => (step ? router.replace(step.route) : undefined) },
      ]);
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await authService.register(validation.data);
      reset();
      // The account exists: the wizard is popped so the back button of the next
      // screen goes to the login and not into a form that cannot be sent again.
      if (router.canDismiss()) router.dismissAll();

      if (response.requireVerification) {
        router.push({
          pathname: '/(auth)/verify-email',
          params: { email: validation.data.email },
        });
      } else {
        Alert.alert('Cuenta creada', 'Tu cuenta fue creada correctamente.', [
          { text: 'Iniciar Sesión', onPress: () => router.replace('/(auth)/login') },
        ]);
      }
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <RegisterStep
      field="password"
      submitLabel="Crear cuenta"
      isSubmitting={isSubmitting}
      onSubmit={handleRegister}
    />
  );
}
