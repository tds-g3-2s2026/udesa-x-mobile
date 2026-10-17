import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';

interface RetweetButtonProps {
  retweeted: boolean;
  count: number;
  pending: boolean;
  onPress: () => void;
}

export function RetweetButton({ retweeted, count, pending, onPress }: RetweetButtonProps) {
  const colors = useThemeColors();
  const color = retweeted ? colors.primary : colors.muted;
  return (
    <TouchableOpacity
      style={styles.button}
      disabled={pending}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={retweeted ? 'Deshacer retweet' : 'Retweetear'}
      accessibilityState={{ selected: retweeted, disabled: pending, busy: pending }}
    >
      <Ionicons name="repeat-outline" size={16} color={color} />
      <Text style={{ color, fontSize: 13 }}>{count}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
