import axios from 'axios';
import { toAuthError } from '../../api/apiClient';
import { notificationsApiClient } from '../../api/notificationsApiClient';
import { NotificationPage } from './types';

export const notificationService = {
  // The page size is fixed by the server (20), so the only thing the app sends
  // is where to continue from. A cancelled request is rethrown as is: TanStack
  // Query cancels on purpose and must not see it as a failure to report.
  async list(cursor: string | null, signal?: AbortSignal): Promise<NotificationPage> {
    try {
      const response = await notificationsApiClient.get<NotificationPage>('/notifications', {
        params: cursor ? { cursor } : {},
        signal,
      });
      return response.data;
    } catch (error) {
      if (axios.isCancel(error)) throw error;
      throw toAuthError(error, 'No se pudieron cargar las notificaciones. Intentalo de nuevo.');
    }
  },

  // Answers 204 with no body, also when everything was already read.
  async markAllAsRead(): Promise<void> {
    try {
      await notificationsApiClient.post('/notifications/read-all');
    } catch (error) {
      throw toAuthError(error, 'No se pudieron marcar como leídas. Intentalo de nuevo.');
    }
  },

  // A logical delete on the server: the notification stops being listed but
  // its document stays. Deleting one that was already deleted answers 204 too,
  // so retrying a swipe is harmless.
  async remove(id: string): Promise<void> {
    try {
      await notificationsApiClient.delete(`/notifications/${encodeURIComponent(id)}`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo borrar la notificación. Intentalo de nuevo.');
    }
  },
};
