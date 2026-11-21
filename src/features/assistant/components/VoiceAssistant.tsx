import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { AssistantOptions, useAssistant } from '../useAssistant';
import { useVoiceInput } from '../useVoiceInput';
import { AssistantPanel } from './AssistantPanel';

interface VoiceAssistantProps extends AssistantOptions {
  // The screen behind may have changed: likes, a new post, someone followed.
  onClosed?: () => void;
}

// The microphone of the feed: hold to talk, let go to send. No continuous
// listening and no wake word (ADR-026).
export function VoiceAssistant({ onClosed, ...options }: VoiceAssistantProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const assistant = useAssistant(options);
  const voice = useVoiceInput(assistant.ask);

  return (
    <>
      {voice.listening ? (
        <View style={styles.listening} testID="assistant-listening">
          <Text style={styles.listeningText}>{voice.partial || 'Escuchando…'}</Text>
        </View>
      ) : null}
      <Pressable
        style={[styles.mic, voice.listening && styles.micActive]}
        onPressIn={voice.start}
        onPressOut={voice.stop}
        accessibilityRole="button"
        accessibilityLabel="Mantené apretado para hablarle al asistente"
        testID="assistant-mic"
      >
        <Ionicons name="mic" size={26} color={colors.onPrimary} />
      </Pressable>
      <AssistantPanel
        state={assistant.state}
        onConfirm={assistant.confirm}
        onCancel={assistant.cancel}
        onClose={() => {
          assistant.close();
          onClosed?.();
        }}
      />
    </>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    mic: {
      position: 'absolute',
      right: 20,
      bottom: 24,
      width: 60,
      height: 60,
      borderRadius: 30,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primaryFill,
      elevation: 4,
      shadowColor: '#000',
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    micActive: { backgroundColor: colors.danger },
    listening: {
      position: 'absolute',
      left: 20,
      right: 96,
      bottom: 30,
      padding: 12,
      borderRadius: 12,
      backgroundColor: colors.field,
      borderWidth: 1,
      borderColor: colors.border,
    },
    listeningText: { fontSize: 15, color: colors.text },
  });
}
