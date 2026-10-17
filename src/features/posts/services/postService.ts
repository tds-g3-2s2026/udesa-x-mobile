import { FeedPage, Post, PostDetail, SuggestedAccount } from '../../../types/post';
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

  // A reply takes the same checks as a post (length, HTML, hourly limit), all
  // server-side. A parent the caller cannot see answers the same 404 as one
  // that does not exist, so the service keeps that error's `code` for the
  // screen to match on and never says why.
  async createReply(postId: string, content: string): Promise<Post> {
    try {
      const response = await postsApiClient.post<Post>(`/posts/${postId}/replies`, { content });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo responder. Intentalo de nuevo.');
    }
  },

  async getPost(postId: string): Promise<PostDetail> {
    try {
      const response = await postsApiClient.get<PostDetail>(`/posts/${postId}`);
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudo cargar la publicación. Intentalo de nuevo.');
    }
  },

  // Oldest first, unlike the feed: a thread reads top to bottom.
  async getReplies(postId: string, cursor: string | null = null): Promise<FeedPage> {
    try {
      const response = await postsApiClient.get<FeedPage>(`/posts/${postId}/replies`, {
        params: cursor ? { cursor } : undefined,
      });
      return response.data;
    } catch (error) {
      throw toAuthError(error, 'No se pudieron cargar las respuestas. Intentalo de nuevo.');
    }
  },

  // Both are idempotent server-side: liking twice or unliking a post that was
  // never liked still answers 204 and moves nothing, so a retry after a doubt
  // about whether the first call arrived is always safe.
  async likePost(postId: string): Promise<void> {
    try {
      await postsApiClient.put(`/posts/${postId}/like`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo dar me gusta. Intentalo de nuevo.');
    }
  },

  async unlikePost(postId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/posts/${postId}/like`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo quitar el me gusta. Intentalo de nuevo.');
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
