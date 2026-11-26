import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../theme/useThemeColors';
import { Colors } from '../../theme/colors';
import { useIsOnline } from './useIsOnline';

export function OfflineNotice() {
  const isOnline = useIsOnline();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (isOnline) return null;
  return (
    <View accessibilityRole="alert" style={[styles.notice, { paddingTop: insets.top + 6 }]}>
      <Text style={styles.text}>Sin conexión</Text>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    notice: {
      backgroundColor: colors.dangerSoft,
      paddingBottom: 6,
      alignItems: 'center',
    },
    text: { color: colors.danger, fontSize: 13, fontWeight: '600' },
  });
}
