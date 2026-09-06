import React, { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { editProfileSchema } from '../../src/features/auth/schemas/authSchemas';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { authStyles, colors } from '../../src/features/auth/components/authTheme';
import { useAuthStore } from '../../src/stores/authStore';

type FormField = 'displayName' | 'bio';
type FieldErrors = Partial<Record<FormField, string>>;

// The API spells its fields as they travel on the wire; the form uses the
// camelCase names of the schema, so a 422 has to be translated to mark an input.
const API_FIELD_TO_FORM: Record<string, FormField> = {
  display_name: 'displayName',
  bio: 'bio',
};

// Failures that mean the session is over: there is nothing to correct on the
// form, so the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

export default function EditProfileScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const setProfile = useAuthStore((state) => state.setProfile);
  const bioRef = useRef<TextInput>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Loads the current profile instead of trusting whatever the store already
  // has: login never returns display_name/bio, so on a first edit the store
  // has nothing for them, and on a later one it could be stale.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const profile = await authService.getProfile();
        if (cancelled) return;
        setDisplayName(profile.displayName ?? '');
        setBio(profile.bio ?? '');
      } catch (loadError) {
        const code = loadError instanceof ApiError ? loadError.code : undefined;
        if (code && SESSION_ENDED_CODES.includes(code)) {
          await clearSession().catch(() => undefined);
          Alert.alert('Tu sesión se cerró', getAuthErrorMessage(loadError));
          return;
        }
        Alert.alert('Error', getAuthErrorMessage(loadError));
        router.back();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
    // Runs once on mount, on purpose: this fetch loads the profile exactly
    // once when the screen opens, and must not react to `router` changing
    // identity on every render, which the test double for useRouter() does.
  }, []);

  const clearFieldError = (field: FormField) => {
    setErrors((previous) => (previous[field] ? { ...previous, [field]: undefined } : previous));
  };

  const handleSave = async () => {
    setErrors({});
    const validation = editProfileSchema.safeParse({ displayName, bio });
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
      const profile = await authService.updateProfile(validation.data);

      // The PATCH response already is the full, sanitized profile, so this
      // is the update — no separate GET to re-fetch it.
      await setProfile(profile);
      router.back();
    } catch (saveError) {
      const code = saveError instanceof ApiError ? saveError.code : undefined;

      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(saveError));
        return;
      }

      if (saveError instanceof ApiError) {
        const fieldErrors: FieldErrors = {};
        for (const [apiField, message] of Object.entries(saveError.fieldErrors)) {
          const field = API_FIELD_TO_FORM[apiField];
          if (field) fieldErrors[field] ??= message;
        }
        if (Object.keys(fieldErrors).length > 0) {
          setErrors(fieldErrors);
          return;
        }
      }

      Alert.alert('Error', getAuthErrorMessage(saveError));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Editar perfil</Text>
          <Text style={authStyles.subtitle}>Así te van a ver otros usuarios de UdeSA-X.</Text>
        </>
      }
      submitLabel="Guardar cambios"
      onSubmit={handleSave}
      isSubmitting={isSubmitting}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      <FormInput
        label="Nombre visible"
        placeholder="Como querés que te vean"
        autoCapitalize="words"
        autoFocus
        returnKeyType="next"
        submitBehavior="submit"
        onSubmitEditing={() => bioRef.current?.focus()}
        value={displayName}
        error={errors.displayName}
        onChangeText={(text) => {
          setDisplayName(text);
          clearFieldError('displayName');
        }}
      />

      <FormInput
        ref={bioRef}
        label="Biografía"
        placeholder="Contá algo sobre vos (opcional)"
        hint="Hasta 160 caracteres."
        multiline
        numberOfLines={4}
        value={bio}
        error={errors.bio}
        onChangeText={(text) => {
          setBio(text);
          clearFieldError('bio');
        }}
      />
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
});
