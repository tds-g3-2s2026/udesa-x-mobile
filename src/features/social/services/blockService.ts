import { BlockedAccountPage } from '../../../types/social';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';

export const blockService = {
  // Blocking an account already blocked is not an error server-side, so this
  // never has to check the current state first. The server also removes the
  // follows in both directions: nothing else has to be called here.
  async block(targetUserId: string): Promise<void> {
    try {
      await postsApiClient.post(`/users/${targetUserId}/block`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo bloquear la cuenta. Intentalo de nuevo.');
    }
  },

  async unblock(targetUserId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/users/${targetUserId}/block`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo desbloquear la cuenta. Intentalo de nuevo.');
    }
  },

  // Only the accounts the caller blocked: posts-api scopes the list to the
  // token, there is no id to pass.
  async getBlocked(cursor: string | null = null): Promise<BlockedAccountPage> {
    try {
      const response = await postsApiClient.get<BlockedAccountPage>('/blocks', {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las cuentas bloqueadas. Intentalo de nuevo.');
    }
  },
};
