import { Stack } from 'expo-router';
import { useThemeColors } from '../../src/theme/useThemeColors';

// The three steps a new account goes through before its first feed: what the
// app does, its interests and some accounts to follow. Each step is its own
// route, so the system back gesture moves between them.
export default function OnboardingLayout() {
  const colors = useThemeColors();

  return (
    <Stack
      initialRouteName="welcome"
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.surface },
      }}
    >
      <Stack.Screen name="welcome" />
      <Stack.Screen name="interests" />
      <Stack.Screen name="suggestions" />
    </Stack>
  );
}
