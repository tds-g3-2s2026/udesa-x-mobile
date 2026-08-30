import React, { useState } from 'react';
import { Text } from 'react-native';
import { useRouter } from 'expo-router';
import { useRegisterDraft } from '../../../stores/registerDraftStore';
import { normalizeHandle, validateRegisterField } from '../schemas/authSchemas';
import type { RegisterField } from '../schemas/authSchemas';
import { REGISTER_STEPS } from '../registerFlow';
import { AuthScreen } from './AuthScreen';
import { FormInput } from './FormInput';
import { StepProgress } from './StepProgress';
import { authStyles } from './authTheme';

type RegisterStepProps = {
  field: RegisterField;
  // Only the last step submits: it replaces the "Continuar" button.
  submitLabel?: string;
  onSubmit?: () => void;
  isSubmitting?: boolean;
};

/**
 * One question of the signup wizard. Each step validates its own field with the
 * registration schema before moving on, so an invalid value never travels to the
 * next screen, and the value itself lives in the shared draft.
 */
export function RegisterStep({
  field,
  submitLabel,
  onSubmit,
  isSubmitting = false,
}: RegisterStepProps) {
  const router = useRouter();
  const value = useRegisterDraft((state) => state.values[field]);
  const setValue = useRegisterDraft((state) => state.setValue);
  const [error, setError] = useState<string | null>(null);

  const index = REGISTER_STEPS.findIndex((step) => step.field === field);
  const step = REGISTER_STEPS[index];
  const nextStep = REGISTER_STEPS[index + 1];

  const handleContinue = () => {
    const message = validateRegisterField(field, value);
    if (message) {
      setError(message);
      return;
    }

    setError(null);
    if (nextStep) {
      router.push(nextStep.route);
      return;
    }
    onSubmit?.();
  };

  // The handle is the only field with a rule the user can watch being met.
  const warning =
    field === 'handle' && value.length > 0 && value.length < 4
      ? 'El usuario debe tener al menos 4 caracteres (@ + 3 letras/números).'
      : null;

  return (
    <AuthScreen
      progress={<StepProgress current={index + 1} total={REGISTER_STEPS.length} />}
      header={
        <>
          <Text style={authStyles.title}>{step.title}</Text>
          <Text style={authStyles.subtitle}>{step.subtitle}</Text>
        </>
      }
      submitLabel={submitLabel ?? 'Continuar'}
      onSubmit={handleContinue}
      isSubmitting={isSubmitting}
    >
      <FormInput
        {...step.input}
        label={step.label}
        placeholder={step.placeholder}
        hint={step.hint}
        secure={step.secure}
        error={error}
        warning={warning}
        autoFocus
        returnKeyType={nextStep ? 'next' : 'go'}
        onSubmitEditing={handleContinue}
        value={value}
        onChangeText={(text) => {
          setValue(field, field === 'handle' ? normalizeHandle(text) : text);
          if (error) setError(null);
        }}
      />
    </AuthScreen>
  );
}
