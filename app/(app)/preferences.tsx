import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError } from '../../src/api/apiClient';
import { authService, getAuthErrorMessage } from '../../src/features/auth/services/authService';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';
import { useAuthStore } from '../../src/stores/authStore';
import { FeedLanguage, ProfileVisibility, UserPreferences } from '../../src/types/auth';

// Failures that mean the session is over: there is nothing to correct on the
// form, so the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

const VISIBILITY_OPTIONS: { value: ProfileVisibility; label: string }[] = [
  { value: 'public', label: 'Público' },
  { value: 'protected', label: 'Protegido' },
];

const LANGUAGE_OPTIONS: { value: FeedLanguage; label: string }[] = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'Inglés' },
  { value: 'all', label: 'Todos' },
];

export default function PreferencesScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [preferences, setPreferences] = useState<UserPreferences | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [savingField, setSavingField] = useState<keyof UserPreferences | null>(null);

  // Loads the current preferences instead of assuming defaults: an account
  // that already set them would otherwise flash the wrong selection first.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const current = await authService.getPreferences();
        if (!cancelled) setPreferences(current);
      } catch (loadError) {
        const code = loadError instanceof ApiError ? loadError.code : undefined;
        if (code && SESSION_ENDED_CODES.includes(code)) {
          await clearSession().catch(() => undefined);
          Alert.alert('Tu sesión se cerró', getAuthErrorMessage(loadError));
          return;
        }
        // No preferences ever arrive on this path, so there is nothing this
        // screen can show: back to wherever it was opened from, same as a
        // failed load on the edit-profile screen.
        Alert.alert('Error', getAuthErrorMessage(loadError));
        router.back();
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Each option saves itself on tap instead of waiting for a submit button:
  // there is nothing else on this screen to submit together. The selection
  // only moves once the server confirms it, so a failed save leaves the
  // screen showing the value that is actually stored.
  async function handleSelect<Field extends keyof UserPreferences>(
    field: Field,
    value: UserPreferences[Field]
  ): Promise<void> {
    if (!preferences || preferences[field] === value || savingField) return;

    setSavingField(field);
    try {
      const updated = await authService.updatePreferences({ [field]: value });
      setPreferences(updated);
    } catch (saveError) {
      const code = saveError instanceof ApiError ? saveError.code : undefined;
      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(saveError));
        return;
      }
      Alert.alert('Error', getAuthErrorMessage(saveError));
    } finally {
      setSavingField(null);
    }
  }

  if (isLoading || !preferences) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Visibilidad del perfil</Text>
          {savingField === 'profileVisibility' && (
            <ActivityIndicator color={colors.primary} size="small" />
          )}
        </View>
        <Text style={styles.sectionHint}>
          Protegido: solo tus seguidores aprobados ven tus publicaciones.
        </Text>
        <View style={styles.options}>
          {VISIBILITY_OPTIONS.map((option) => {
            const isSelected = preferences.profileVisibility === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelect('profileVisibility', option.value)}
                disabled={savingField !== null}
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
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Idioma del feed</Text>
          {savingField === 'feedLanguage' && (
            <ActivityIndicator color={colors.primary} size="small" />
          )}
        </View>
        <Text style={styles.sectionHint}>
          Por ahora esto solo guarda tu preferencia: el feed todavía no filtra por idioma.
        </Text>
        <View style={styles.options}>
          {LANGUAGE_OPTIONS.map((option) => {
            const isSelected = preferences.feedLanguage === option.value;
            return (
              <TouchableOpacity
                key={option.value}
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={() => handleSelect('feedLanguage', option.value)}
                disabled={savingField !== null}
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
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
      padding: 20,
    },
    section: {
      marginBottom: 28,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 8,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    sectionHint: {
      marginTop: 4,
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
    options: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
      marginTop: 12,
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
  });
}
