import { StyleSheet } from 'react-native';

export const colors = {
  primary: '#1D9BF0',
  primarySoft: '#E8F5FD',
  onPrimary: '#FFFFFF',
  surface: '#FFFFFF',
  text: '#0F1419',
  muted: '#536471',
  placeholder: '#8B98A5',
  border: '#CFD9DE',
  field: '#F7F9F9',
  divider: '#EFF3F4',
  danger: '#F4212E',
  dangerSoft: '#FFF5F5',
} as const;

// Text blocks shared by the header and the footer links of the auth screens.
export const authStyles = StyleSheet.create({
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
