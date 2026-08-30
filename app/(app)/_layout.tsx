import { Stack } from 'expo-router';

// The authenticated area draws its own header, so the navigator only provides
// the stack for the screens that come with the next epics.
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
