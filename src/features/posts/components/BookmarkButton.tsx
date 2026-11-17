import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { touchTarget } from '../../../theme/touchTarget';

interface BookmarkButtonProps {
  onPress: () => void;
  pending: boolean;
  saved: boolean;
}

export function BookmarkButton({ onPress, pending, saved }: BookmarkButtonProps) {
  const colors = useThemeColors();

  return (
    <TouchableOpacity
      style={styles.button}
      disabled={pending}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={saved ? 'Quitar de guardados' : 'Guardar post'}
      accessibilityState={{ selected: saved, disabled: pending, busy: pending }}
    >
      <Ionicons
        name={saved ? 'bookmark' : 'bookmark-outline'}
        size={16}
        color={saved ? colors.primary : colors.muted}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: touchTarget,
});
