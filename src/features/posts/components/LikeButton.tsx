import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

interface LikeButtonProps {
  onPress: () => void;
  pending: boolean;
  liked: boolean;
  count: number;
}

export function LikeButton({ onPress, pending, liked, count }: LikeButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <TouchableOpacity
      style={styles.button}
      disabled={pending}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Quitar me gusta' : 'Dar me gusta'}
      accessibilityState={{ selected: liked, disabled: pending, busy: pending }}
    >
      <Ionicons
        name={liked ? 'heart' : 'heart-outline'}
        size={16}
        color={liked ? colors.danger : colors.muted}
      />
      <Text style={[styles.label, liked && styles.labelLiked]}>{count}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    label: {
      fontSize: 13,
      color: colors.muted,
    },
    labelLiked: {
      color: colors.danger,
    },
  });
}
