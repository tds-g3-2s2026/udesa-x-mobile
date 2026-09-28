import { FeedPage, Post, SuggestedAccount } from '../../../types/post';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';

export { getAuthErrorMessage } from '../../../api/apiClient';

export const postService = {
  // Length, blankness and the hourly rate all live server-side: posts-api
  // enforces them and answers a Problem Details 422 or 429 with a message
  // already fit to show, so there is nothing to translate here.
  async createPost(content: string): Promise<Post> {
    try {
      const response = await postsApiClient.post<Post>('/posts', { content });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo publicar. Intentalo de nuevo.');
    }
  },

  // Only posts from accounts the caller follows, most recent first: the
  // ordering and the filtering are both the backend's job, not something
  // this reorders or refetches to double-check.
  async getFeed(cursor: string | null = null): Promise<FeedPage> {
    try {
      const response = await postsApiClient.get<FeedPage>('/feed', {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo cargar el feed. Intentalo de nuevo.');
    }
  },

  // A plain list, not a cursor page: posts-api caps it at 10 and already
  // excludes the caller's own account and whoever they already follow.
  async getSuggestedAccounts(): Promise<SuggestedAccount[]> {
    try {
      const response = await postsApiClient.get<SuggestedAccount[]>('/users/suggested');
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las sugerencias. Intentalo de nuevo.');
    }
  },
};
