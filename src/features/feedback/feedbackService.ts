import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiClient, toAuthError } from '../../api/apiClient';

export const MAX_FEEDBACK_LENGTH = 500;

// The API requires a version, and losing a comment over it would be worse than
// not knowing which build sent it.
const UNKNOWN_VERSION = 'desconocida';

function deviceOs(): string {
  // Platform.Version on Android is the API level (35), not the version people
  // know (15), which comes in Release.
  if (Platform.OS === 'android') return `Android ${Platform.constants.Release}`;
  if (Platform.OS === 'ios') return `iOS ${Platform.Version}`;
  return 'Web';
}

export const feedbackService = {
  // The server takes the account from the session, so the only other things
  // sent are what it cannot know: the device and the version of the app. A 429
  // says how long to wait in its own message, already fit to show.
  async send(message: string): Promise<void> {
    try {
      await apiClient.post('/me/feedback', {
        message,
        device_os: deviceOs(),
        app_version: Constants.expoConfig?.version ?? UNKNOWN_VERSION,
      });
    } catch (error) {
      throw toAuthError(error, 'No se pudo enviar el comentario. Intentalo de nuevo.');
    }
  },
};
