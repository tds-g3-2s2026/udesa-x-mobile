import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';
import { AccountList, ListMember } from '../../../types/lists';
import { FeedPage } from '../../../types/post';

// The lists of the account making the call (E3-H8). posts-api scopes every
// route to the token, so none takes the owner. Its refusals carry the reason in
// Spanish (a full list, an account not followed), and toAuthError keeps it.
export const listService = {
  // Twenty at most, oldest first: one call, no paging.
  async getLists(): Promise<AccountList[]> {
    try {
      const response = await postsApiClient.get<AccountList[]>('/lists');
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar tus listas. Intentalo de nuevo.');
    }
  },

  async createList(name: string): Promise<AccountList> {
    try {
      const response = await postsApiClient.post<AccountList>('/lists', { name });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo crear la lista. Intentalo de nuevo.');
    }
  },

  // Takes its members with it; their posts stay in the main feed.
  async deleteList(listId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/lists/${listId}`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo borrar la lista. Intentalo de nuevo.');
    }
  },

  // A hundred at most, the most recently added first.
  async getMembers(listId: string): Promise<ListMember[]> {
    try {
      const response = await postsApiClient.get<ListMember[]>(`/lists/${listId}/members`);
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las cuentas de la lista.');
    }
  },

  // Adding an account twice, or taking out one that was not there, is not an
  // error server-side.
  async addMember(listId: string, userId: string): Promise<void> {
    try {
      await postsApiClient.post(`/lists/${listId}/members/${userId}`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo sumar la cuenta a la lista. Intentalo de nuevo.');
    }
  },

  async removeMember(listId: string, userId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/lists/${listId}/members/${userId}`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo sacar la cuenta de la lista. Intentalo de nuevo.');
    }
  },

  // The same shape and paging as the main feed, with only the members' activity.
  async getFeed(listId: string, cursor: string | null = null): Promise<FeedPage> {
    try {
      const response = await postsApiClient.get<FeedPage>(`/lists/${listId}/feed`, {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo cargar la lista. Intentalo de nuevo.');
    }
  },
};
