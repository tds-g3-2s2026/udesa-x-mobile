import { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

// Text blocks shared by the header and the footer links of the auth screens.
// A hook and not a static export: the colors it reads have to update with
// the theme, so the styles it returns are rebuilt whenever they change.
export function useAuthStyles() {
  const colors = useThemeColors();
  return useMemo(() => createAuthStyles(colors), [colors]);
}

function createAuthStyles(colors: Colors) {
  return StyleSheet.create({
    brand: {
      fontSize: 34,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.5,
      textAlign: 'center',
      marginBottom: 8,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 6,
    },
    subtitle: {
      fontSize: 15,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 22,
    },
    emphasis: {
      fontWeight: '600',
      color: colors.primary,
    },
    badge: {
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: colors.primarySoft,
      alignItems: 'center',
      justifyContent: 'center',
      alignSelf: 'center',
      marginBottom: 16,
    },
    badgeIcon: {
      fontSize: 30,
    },
    footerText: {
      color: colors.muted,
      fontSize: 14,
    },
    footerLink: {
      color: colors.primary,
      fontSize: 14,
      fontWeight: '700',
    },
  });
}
