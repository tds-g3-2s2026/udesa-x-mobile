import { FeedPage, Post, PostDetail, SuggestedAccount } from '../../../types/post';
import { postsApiClient } from '../../../api/postsApiClient';
import { toAuthError } from '../../../api/apiClient';
import { PickedImage } from '../postImages';

const UPLOAD_TIMEOUT_MS = 60000;

export { getAuthErrorMessage } from '../../../api/apiClient';

export const postService = {
  async deletePost(postId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/posts/${postId}`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo eliminar la publicación. Intentalo de nuevo.');
    }
  },

  async retweet(postId: string): Promise<void> {
    try {
      await postsApiClient.post(`/posts/${postId}/retweet`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo retweetear. Intentalo de nuevo.');
    }
  },

  async undoRetweet(postId: string): Promise<void> {
    try {
      await postsApiClient.delete(`/posts/${postId}/retweet`);
    } catch (error) {
      throw toAuthError(error, 'No se pudo deshacer el retweet. Intentalo de nuevo.');
    }
  },

  // Length, blankness and the hourly rate all live server-side: posts-api
  // enforces them and answers a Problem Details 422 or 429 with a message
  // already fit to show, so there is nothing to translate here.
  // With images the same endpoint takes multipart instead of JSON: one `images`
  // part per file, and the order they are appended in is the order they show.
  // The default 10 s timeout is for small JSON bodies; up to four 1 MB files
  // over a mobile connection need longer.
  async createPost(content: string, images: PickedImage[] = []): Promise<Post> {
    try {
      if (images.length === 0) {
        const response = await postsApiClient.post<Post>('/posts', { content });
        return response.data;
      }
      const form = new FormData();
      form.append('content', content);
      for (const image of images) {
        // React Native's FormData reads a file from `{ uri, name, type }`,
        // which the DOM typings do not know about.
        form.append('images', {
          uri: image.uri,
          name: image.name,
          type: image.mimeType,
        } as unknown as Blob);
      }
      const response = await postsApiClient.post<Post>('/posts', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: UPLOAD_TIMEOUT_MS,
      });
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
