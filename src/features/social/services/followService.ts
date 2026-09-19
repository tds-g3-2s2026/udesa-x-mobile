import { FollowRequestSummary, FollowState } from '../../../types/social';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';

export { getAuthErrorMessage } from '../../../api/apiClient';

export const followService = {
  // posts-api's route takes the target's id, not their handle: who is
  // following comes from the token, so there is nothing else to send.
  // Following an account already followed is not an error server-side, so
  // this never has to check the current state first.
  //
  // The answer says what happened: 204 means it is done, and 202 means the
  // account is protected and the ask is waiting for its owner.
  async follow(targetUserId: string): Promise<FollowState> {
    try {
      const response = await postsApiClient.post(`/users/${targetUserId}/follow`);
      return response.status === 202 ? 'pending' : 'following';
    } catch (error) {
      throw toAuthError(error, 'No se pudo seguir la cuenta. Intentalo de nuevo.');
    }
  },

  async unfollow(targetUserId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/users/${targetUserId}/follow`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo dejar de seguir la cuenta. Intentalo de nuevo.');
    }
  },

  // Only the requests aimed at the caller: posts-api scopes the list to the
  // authenticated account, there is no handle to pass.
  async getFollowRequests(): Promise<FollowRequestSummary[]> {
    try {
      const response = await postsApiClient.get<FollowRequestSummary[]>('/follow-requests');
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las solicitudes. Intentalo de nuevo.');
    }
  },

  async approveFollowRequest(id: string): Promise<void> {
    try {
      await postsApiClient.post(`/follow-requests/${id}/approve`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo aprobar la solicitud. Intentalo de nuevo.');
    }
  },

  async rejectFollowRequest(id: string): Promise<void> {
    try {
      await postsApiClient.post(`/follow-requests/${id}/reject`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo rechazar la solicitud. Intentalo de nuevo.');
    }
  },
};
