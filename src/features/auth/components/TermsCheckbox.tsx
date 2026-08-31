import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { colors } from './authTheme';

type TermsCheckboxProps = {
  value: boolean;
  onChange: (accepted: boolean) => void;
};

// E1-H12.CA1: the mandatory checkbox of the signup form. The box and the two
// links are separate touch targets on purpose, so opening a policy never
// toggles acceptance by accident.
export function TermsCheckbox({ value, onChange }: TermsCheckboxProps) {
  const router = useRouter();

  return (
    <View style={styles.row}>
      <TouchableOpacity
        onPress={() => onChange(!value)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: value }}
        accessibilityLabel="Aceptar los Términos y Condiciones y la Política de Privacidad"
        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        style={styles.box}
      >
        <Ionicons
          name={value ? 'checkbox' : 'square-outline'}
          size={22}
          color={value ? colors.primary : colors.muted}
        />
      </TouchableOpacity>

      <Text style={styles.label}>
        Acepto los{' '}
        <Text style={styles.link} onPress={() => router.push('/(auth)/terms')}>
          Términos y Condiciones
        </Text>{' '}
        y la{' '}
        <Text style={styles.link} onPress={() => router.push('/(auth)/privacy')}>
          Política de Privacidad
        </Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 16,
    gap: 10,
  },
  box: {
    paddingTop: 1,
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.muted,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
