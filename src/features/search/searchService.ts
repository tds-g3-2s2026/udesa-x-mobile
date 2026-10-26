import axios from 'axios';
import { apiClient, toAuthError } from '../../api/apiClient';
import { postsApiClient } from '../../api/postsApiClient';
import { SearchKind, SearchPage } from './types';

export async function search(
  kind: SearchKind,
  query: string,
  cursor: string | null,
  signal: AbortSignal
): Promise<SearchPage> {
  try {
    const client = kind === 'posts' ? postsApiClient : apiClient;
    const response = await client.get<SearchPage>(`/search/${kind}`, {
      params: { q: query, ...(cursor ? { cursor } : {}) },
      signal,
    });
    return response.data;
  } catch (error) {
    if (axios.isCancel(error)) throw error;
    throw toAuthError(error, 'No se pudo realizar la búsqueda. Intentalo de nuevo.');
  }
}
