import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../../auth/components/authTheme';

interface AppScreenProps {
  title: string;
  // The feed shows the product name instead of a section title, so it gets the
  // brand treatment while the other tabs keep a plain heading.
  brand?: boolean;
  children: ReactNode;
}

// Shared chrome of the tab screens. The tab navigator draws no header, so each
// screen owns its top inset: doing it here keeps the four tabs aligned.
export function AppScreen({ title, brand = false, children }: AppScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={brand ? styles.brand : styles.title}>{title}</Text>
      {children}
    </View>
  );
}

interface EmptyStateProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  text: string;
}

// No sample content anywhere: posts, search and notifications have no endpoint yet
// and inventing data here would hide that. The bottom inset belongs to the tab bar.
export function EmptyState({ icon, title, text }: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={40} color={colors.placeholder} />
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptyText}>{text}</Text>
    </View>
  );
}

// Look of the search box, shared by the shortcut on the feed and the real field of
// the search tab: one is a button and the other an input, but they read the same.
export const searchFieldStyles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    height: 44,
    paddingHorizontal: 14,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.field,
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: colors.text,
    padding: 0,
  },
  placeholder: {
    flex: 1,
    fontSize: 15,
    color: colors.placeholder,
  },
});

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    paddingHorizontal: 20,
    backgroundColor: colors.surface,
  },
  brand: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    marginBottom: 16,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  emptyTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
