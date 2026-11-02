import { MutedAccountPage } from '../../../types/social';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';

export const muteService = {
  // Muting twice, or unmuting an account that was not muted, is not an error
  // server-side, so neither call checks the current state first. Nothing else
  // has to be refreshed: muting keeps the follow and touches no counter, and
  // the feed reloads by itself when its tab regains focus.
  async mute(targetUserId: string): Promise<void> {
    try {
      await postsApiClient.post(`/users/${targetUserId}/mute`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo silenciar la cuenta. Intentalo de nuevo.');
    }
  },

  async unmute(targetUserId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/users/${targetUserId}/mute`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo dejar de silenciar la cuenta. Intentalo de nuevo.');
    }
  },

  // Only the accounts the caller muted: posts-api scopes the list to the
  // token, there is no id to pass.
  async getMuted(cursor: string | null = null): Promise<MutedAccountPage> {
    try {
      const response = await postsApiClient.get<MutedAccountPage>('/mutes', {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(
        error,
        'No se pudieron cargar las cuentas silenciadas. Intentalo de nuevo.'
      );
    }
  },
};
