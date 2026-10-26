export type SearchKind = 'posts' | 'users';

export interface PostSearchResult {
  id: string;
  authorId: string;
  authorHandle: string | null;
  createdAt: string;
  parentId: string | null;
  snippet: { text: string; highlighted: boolean }[];
}

export interface UserSearchResult {
  id: string;
  handle: string;
  displayName: string | null;
  isPrivate: boolean;
}

export type SearchResult = PostSearchResult | UserSearchResult;

export interface SearchPage {
  items: SearchResult[];
  nextCursor: string | null;
}

export function normalizedSearchText(text: string, kind: SearchKind): string {
  const trimmed = text.trim();
  return kind === 'users' && trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
}
