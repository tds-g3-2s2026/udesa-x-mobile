import { Post } from '../../../types/post';
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
};
