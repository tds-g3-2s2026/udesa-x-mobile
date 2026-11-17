import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { touchTarget } from '../../../theme/touchTarget';

// The "Volver" of the screens that draw their own header. A button and not a
// pressable Text: a screen reader announces it as one, and its box reaches
// the minimum size a finger can press.
export function BackLink() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.link}
      onPress={() => router.back()}
      accessibilityRole="button"
      accessibilityLabel="Volver"
    >
      <Ionicons name="chevron-back" size={18} color={colors.primary} />
      <Text style={styles.label}>Volver</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    link: {
      ...touchTarget,
      flexDirection: 'row',
      alignSelf: 'flex-start',
      justifyContent: 'flex-start',
    },
    label: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
  });
}
