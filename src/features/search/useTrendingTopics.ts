import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { fetchTrending } from './searchService';

// The ranking changes only on the server's 15 minute refresh.
const TRENDING_STALE_TIME_MS = 5 * 60 * 1000;

export function useTrendingTopics() {
  const viewerId = useAuthStore((state) => state.user?.id);
  return useQuery({
    queryKey: ['trending', viewerId],
    queryFn: ({ signal }) => fetchTrending(signal),
    enabled: !!viewerId,
    staleTime: TRENDING_STALE_TIME_MS,
  });
}
