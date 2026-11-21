import { useCallback, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';

// Push to talk: listens while the button is held and hands over the text once
// the recognizer is done. The audio never leaves the phone through the app:
// only the text does (ADR-026).
export function useVoiceInput(onHeard: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [partial, setPartial] = useState('');
  const latest = useRef('');
  // Released before the permission prompt was answered: nothing to start.
  const held = useRef(false);

  useSpeechRecognitionEvent('result', (event) => {
    latest.current = event.results[0]?.transcript ?? latest.current;
    setPartial(latest.current);
  });

  useSpeechRecognitionEvent('end', () => {
    setListening(false);
    const text = latest.current.trim();
    latest.current = '';
    setPartial('');
    if (text) onHeard(text);
  });

  useSpeechRecognitionEvent('error', (event) => {
    setListening(false);
    latest.current = '';
    // Letting go without saying anything is not worth a message.
    if (event.error === 'aborted' || event.error === 'no-speech') return;
    Alert.alert('No te pude escuchar', 'Probá de nuevo, más cerca del micrófono.');
  });

  const start = useCallback(async () => {
    held.current = true;
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      Alert.alert(
        'Sin reconocimiento de voz',
        'Este teléfono no tiene un reconocedor de voz disponible.'
      );
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(
        'Hace falta el micrófono',
        'Para hablarle al asistente, permití el micrófono y el reconocimiento de voz en los ajustes del teléfono.'
      );
      return;
    }
    if (!held.current) return;
    latest.current = '';
    setPartial('');
    setListening(true);
    ExpoSpeechRecognitionModule.start({ lang: 'es-AR', interimResults: true, continuous: false });
  }, []);

  const stop = useCallback(() => {
    held.current = false;
    ExpoSpeechRecognitionModule.stop();
  }, []);

  return { listening, partial, start, stop };
}
