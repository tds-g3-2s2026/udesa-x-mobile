import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { getAuthErrorMessage } from '../../src/api/apiClient';
import { notificationService } from '../../src/features/notifications/notificationService';
import {
  NotificationPreferences,
  NotificationPreferenceType,
} from '../../src/features/notifications/types';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

const OPTIONS: { type: NotificationPreferenceType; label: string; hint?: string }[] = [
  { type: 'like', label: 'Me gusta' },
  { type: 'retweet', label: 'Retweets' },
  { type: 'reply', label: 'Respuestas' },
  { type: 'mention', label: 'Menciones' },
  { type: 'follow', label: 'Nuevos seguidores' },
  {
    type: 'direct_message',
    label: 'Mensajes directos',
    hint: 'Todavía no hay mensajes directos: se guarda tu elección para cuando existan.',
  },
];

export default function NotificationPreferencesScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [savingType, setSavingType] = useState<NotificationPreferenceType | null>(null);

  // Loads what the account chose instead of assuming everything is on: one
  // that already turned a type off would otherwise flash the wrong switch.
  useEffect(() => {
    (async () => {
      try {
        setPreferences(await notificationService.getPreferences());
      } catch (loadError) {
        // Without the preferences there is nothing to show: back to wherever
        // this was opened from, same as the preferences screen.
        Alert.alert('Error', getAuthErrorMessage(loadError));
        router.back();
      }
    })();
  }, []);

  // Each switch saves itself on tap, and only that type goes to the server.
  // The switch moves once the server confirms it, so a failed save leaves the
  // screen showing what is actually stored. The switches only exist once the
  // preferences loaded, and they are disabled while one of them saves.
  async function handleToggle(type: NotificationPreferenceType, value: boolean): Promise<void> {
    if (savingType || preferences?.[type] === value) return;

    setSavingType(type);
    try {
      setPreferences(await notificationService.updatePreferences({ [type]: value }));
    } catch (saveError) {
      Alert.alert('Error', getAuthErrorMessage(saveError));
    } finally {
      setSavingType(null);
    }
  }

  if (!preferences) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.intro}>
        Elegí de qué querés que te avisemos con una notificación push. Las que apagues igual se ven
        en la pestaña Notificaciones.
      </Text>
      {OPTIONS.map((option) => (
        <View key={option.type} style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>{option.label}</Text>
            {option.hint ? <Text style={styles.hint}>{option.hint}</Text> : null}
          </View>
          <Switch
            value={preferences[option.type]}
            onValueChange={(value) => handleToggle(option.type, value)}
            disabled={savingType !== null}
            accessibilityLabel={option.label}
            trackColor={{ false: colors.border, true: colors.primary }}
          />
        </View>
      ))}
    </ScrollView>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    content: {
      padding: 20,
    },
    intro: {
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
      marginBottom: 8,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      paddingVertical: 16,
      borderTopWidth: 1,
      borderTopColor: colors.divider,
    },
    rowText: {
      flex: 1,
    },
    label: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.text,
    },
    hint: {
      marginTop: 4,
      fontSize: 13,
      color: colors.muted,
      lineHeight: 18,
    },
  });
}
