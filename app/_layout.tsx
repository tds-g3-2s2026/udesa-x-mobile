import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/stores/authStore';
import { colors } from '../src/features/auth/components/authTheme';

// T-52: the native splash stays up until the stored session was read, so the first
// screen the user sees is already the right one for their session.
SplashScreen.preventAutoHideAsync().catch(() => {
  // Only rejects when the splash is already gone, which is the desired end state.
});

export default function RootLayout() {
  const user = useAuthStore((state) => state.user);
  const isInitialized = useAuthStore((state) => state.isInitialized);
  const restoreSession = useAuthStore((state) => state.restoreSession);

  useEffect(() => {
    restoreSession();
  }, [restoreSession]);

  useEffect(() => {
    if (!isInitialized) return;
    SplashScreen.hideAsync().catch(() => {
      // Same as above: a splash that is not there anymore needs no hiding.
    });
  }, [isInitialized]);

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {isInitialized ? (
        // Declarative guards: only the group the session allows is mounted, so
        // the protected area never renders for a frame before a redirect.
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={user !== null}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>

          <Stack.Protected guard={user === null}>
            <Stack.Screen name="(auth)" />
          </Stack.Protected>
        </Stack>
      ) : (
        // Reading the stored session is a couple of SecureStore calls: this only
        // shows while that resolves, and replaces the flash of the wrong screen.
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      )}
    </SafeAreaProvider>
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
