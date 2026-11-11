import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, getAuthErrorMessage } from '../../src/api/apiClient';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { authService } from '../../src/features/auth/services/authService';
import { INTEREST_OPTIONS, MIN_INTERESTS } from '../../src/features/onboarding/interests';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';
import { Interest } from '../../src/types/auth';

// Failures that mean the session is over: there is nothing to correct here, so
// the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

// The step that cannot be skipped: users-api asks for at least 3 interests
// before the onboarding can be finished. They are saved here, on the way to
// the suggestions, so the last step only has to mark the onboarding as done.
export default function InterestsScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selected, setSelected] = useState<Interest[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const toggle = (interest: Interest) =>
    setSelected((current) =>
      current.includes(interest)
        ? current.filter((value) => value !== interest)
        : [...current, interest]
    );

  const handleContinue = async () => {
    setIsSaving(true);
    try {
      await authService.saveInterests(selected);
      router.push('/suggestions');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(error));
        return;
      }
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>¿Qué te interesa?</Text>
          <Text style={authStyles.subtitle}>Elegí al menos {MIN_INTERESTS} temas.</Text>
        </>
      }
      submitLabel="Continuar"
      onSubmit={handleContinue}
      isSubmitting={isSaving}
      disabled={selected.length < MIN_INTERESTS}
    >
      <View style={styles.options}>
        {INTEREST_OPTIONS.map((option) => {
          const isSelected = selected.includes(option.value);
          return (
            <TouchableOpacity
              key={option.value}
              style={[styles.option, isSelected && styles.optionSelected]}
              onPress={() => toggle(option.value)}
              disabled={isSaving}
              accessibilityRole="button"
              accessibilityState={{ selected: isSelected }}
            >
              <Text style={[styles.optionLabel, isSelected && styles.optionLabelSelected]}>
                {option.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
      <Text style={styles.count}>
        {selected.length === 1 ? '1 elegido' : `${selected.length} elegidos`}
      </Text>
    </AuthScreen>
  );
}

// The same chips as the options of Configuración.
function createStyles(colors: Colors) {
  return StyleSheet.create({
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    option: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
    },
    optionSelected: {
      borderColor: colors.primary,
      backgroundColor: colors.primary,
    },
    optionLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.text,
    },
    optionLabelSelected: {
      color: colors.onPrimary,
    },
    count: {
      marginTop: 12,
      fontSize: 13,
      color: colors.muted,
    },
  });
}
