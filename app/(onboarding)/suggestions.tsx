import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ApiError, getAuthErrorMessage } from '../../src/api/apiClient';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { authService } from '../../src/features/auth/services/authService';
import { postService } from '../../src/features/posts/services/postService';
import { SuggestedAccountRow } from '../../src/features/social/components/SuggestedAccountRow';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';
import { SuggestedAccount } from '../../src/types/post';

// Failures that mean the session is over: there is nothing to correct here, so
// the local session is dropped and the guards send the user to the login.
const SESSION_ENDED_CODES = ['session-revoked', 'invalid-token', 'account-suspended'];

// The last step: the most followed accounts, each followed with one tap.
// Following none is fine, so the same button that finishes the onboarding is
// the way to skip this step. Once users-api marks it done, the root layout
// swaps the onboarding for the feed.
export default function SuggestionsScreen() {
  const router = useRouter();
  const clearSession = useAuthStore((state) => state.clearSession);
  const finishOnboarding = useAuthStore((state) => state.finishOnboarding);
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [accounts, setAccounts] = useState<SuggestedAccount[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isFinishing, setIsFinishing] = useState(false);

  // A failed read does not hold the onboarding back: the accounts can also be
  // found later from the feed or the search.
  useEffect(() => {
    let cancelled = false;
    postService
      .getSuggestedAccounts()
      .then((found) => {
        if (!cancelled) setAccounts(found);
      })
      .catch((error) => {
        if (!cancelled) setLoadError(getAuthErrorMessage(error));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const handleFinish = async () => {
    setIsFinishing(true);
    try {
      await authService.completeOnboarding();
      await finishOnboarding();
    } catch (error) {
      const code = error instanceof ApiError ? error.code : undefined;
      if (code && SESSION_ENDED_CODES.includes(code)) {
        await clearSession().catch(() => undefined);
        Alert.alert('Tu sesión se cerró', getAuthErrorMessage(error));
        return;
      }
      Alert.alert('Error', getAuthErrorMessage(error));
      // The interests did not make it to the server: back to that step.
      if (code === 'too-few-interests') router.replace('/interests');
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <AuthScreen
      header={
        <>
          <Text style={authStyles.title}>Cuentas para seguir</Text>
          <Text style={authStyles.subtitle}>
            Seguí las que te interesen con un toque. Podés seguir otras después.
          </Text>
        </>
      }
      submitLabel="Ir al inicio"
      onSubmit={handleFinish}
      isSubmitting={isFinishing}
    >
      {loadError ? (
        <Text style={styles.message}>{loadError}</Text>
      ) : accounts === null ? (
        <ActivityIndicator accessibilityLabel="Cargando sugerencias" color={colors.primary} />
      ) : accounts.length === 0 ? (
        <Text style={styles.message}>Todavía no hay cuentas para sugerirte.</Text>
      ) : (
        <View>
          {accounts.map((account) => (
            <SuggestedAccountRow key={account.id} account={account} />
          ))}
        </View>
      )}
    </AuthScreen>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    message: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
    },
  });
}
