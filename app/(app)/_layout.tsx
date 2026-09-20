import { Stack } from 'expo-router';
import { useThemeColors } from '../../src/theme/useThemeColors';

// A real navigation stack around the tab bar. change-password, edit-profile
// and preferences live here and not inside (tabs)/_layout.tsx: as Stack
// screens, pushing to one and calling router.back() returns to whatever
// screen pushed it, the same as any other stack. As Tabs.Screen entries
// (their previous home) `.back()` did not reliably return to Perfil — Tabs do
// not share a linear back history between sibling tabs the way a Stack does.
export default function AppLayout() {
  const colors = useThemeColors();

  return (
    <Stack initialRouteName="(tabs)" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="edit-profile" />
      {/* The only screen here with no single action to submit: it draws no
          header of its own, so it uses the native one instead of AuthScreen's
          fixed-footer-button layout, which this screen has no use for. */}
      <Stack.Screen
        name="preferences"
        options={{
          headerShown: true,
          title: 'Configuración',
          headerBackTitle: 'Volver',
          headerTintColor: colors.primary,
          headerStyle: { backgroundColor: colors.surface },
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '600', color: colors.text },
        }}
      />
      <Stack.Screen name="follow-requests" />
      <Stack.Screen name="follow-list" />
    </Stack>
  );
}
