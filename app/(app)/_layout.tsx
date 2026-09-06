import { Stack } from 'expo-router';

// A real navigation stack around the tab bar. change-password and
// edit-profile live here and not inside (tabs)/_layout.tsx: as Stack screens,
// pushing to one and calling router.back() returns to whatever screen pushed
// it, the same as any other stack. As Tabs.Screen entries (their previous
// home) `.back()` did not reliably return to Perfil — Tabs do not share a
// linear back history between sibling tabs the way a Stack does. Every
// screen draws its own header, so the stack only owns navigation, not chrome.
export default function AppLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="change-password" />
      <Stack.Screen name="edit-profile" />
    </Stack>
  );
}
