import { InfiniteData, QueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { SearchPage } from './types';

export const searchQueryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

export async function updateSearchAfterBlock(userId: string, blocked: boolean): Promise<void> {
  const viewerId = useAuthStore.getState().user?.id;
  if (!viewerId) return;
  const filter = { queryKey: ['search', viewerId] };
  await searchQueryClient.cancelQueries(filter);
  if (blocked) {
    searchQueryClient.setQueriesData<InfiniteData<SearchPage>>(filter, (data) =>
      data
        ? {
            ...data,
            pages: data.pages.map((page) => ({
              ...page,
              items: page.items.filter(
                (item) => ('authorId' in item ? item.authorId : item.id) !== userId
              ),
            })),
          }
        : data
    );
  }
  void searchQueryClient.invalidateQueries(filter);
}
