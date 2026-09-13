import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Link, Stack } from 'expo-router';
import { useThemeColors } from '../src/theme/useThemeColors';
import { Colors } from '../src/theme/colors';

// Without this route an unknown deep link falls back to the development screen
// that expo-router ships, which is not something a user should ever see.
export default function NotFoundScreen() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Pantalla inexistente' }} />
      <Text style={styles.title}>Esta pantalla no existe</Text>
      <Text style={styles.text}>
        El enlace que abriste no corresponde a ninguna sección de la aplicación.
      </Text>
      <Link href="/" style={styles.link}>
        Volver al inicio
      </Link>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 40,
      backgroundColor: colors.surface,
    },
    title: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
      marginBottom: 8,
      textAlign: 'center',
    },
    text: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
    link: {
      marginTop: 24,
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}
