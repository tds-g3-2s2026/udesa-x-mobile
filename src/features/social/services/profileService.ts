import { FeedPage } from '../../../types/post';
import { UserProfile } from '../../../types/social';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';

export { getAuthErrorMessage } from '../../../api/apiClient';

// What posts-api answers when the account is protected and the caller does
// not follow it. Not an error for the screen: it shows the private-account
// message in place of the posts.
export const PRIVATE_ACCOUNT_CODE = 'account-is-private';

export const profileService = {
  async getProfile(userId: string): Promise<UserProfile> {
    try {
      const response = await postsApiClient.get<UserProfile>(`/users/${userId}`);
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo cargar el perfil. Intentalo de nuevo.');
    }
  },

  // The same page as the feed, 20 posts plus an opaque cursor, so the screen
  // paints them with the card it already has.
  async getPosts(userId: string, cursor: string | null = null): Promise<FeedPage> {
    try {
      const response = await postsApiClient.get<FeedPage>(`/users/${userId}/posts`, {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las publicaciones. Intentalo de nuevo.');
    }
  },
};
