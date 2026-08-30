import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from './authTheme';

type StepProgressProps = {
  // 1-based position of the step being shown.
  current: number;
  total: number;
};

// Segmented bar shown under the navigation header: one pill per step, filled
// up to the current one.
export function StepProgress({ current, total }: StepProgressProps) {
  return (
    <View
      style={styles.track}
      accessibilityRole="progressbar"
      accessibilityLabel={`Paso ${current} de ${total}`}
    >
      {Array.from({ length: total }, (_, index) => (
        <View key={index} style={[styles.pill, index < current && styles.pillFilled]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 4,
  },
  pill: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.divider,
  },
  pillFilled: {
    backgroundColor: colors.primary,
  },
});
