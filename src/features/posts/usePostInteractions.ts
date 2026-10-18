import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { FeedItem } from '../../types/post';
import { getAuthErrorMessage, postService } from './services/postService';

type ReactionState = Partial<
  Pick<FeedItem, 'retweetedByMe' | 'retweetsCount' | 'likedByMe' | 'likesCount'>
>;

export function usePostInteractions() {
  const [overrides, setOverrides] = useState<Record<string, ReactionState>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const current = useRef<Record<string, ReactionState>>({});
  const locks = useRef(new Set<string>());
  const revision = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((id: string, state: ReactionState) => {
    current.current = { ...current.current, [id]: { ...current.current[id], ...state } };
    if (mounted.current) setOverrides(current.current);
  }, []);

  const toggle = useCallback(
    async (item: FeedItem, kind: 'like' | 'retweet') => {
      const key = `${kind}:${item.id}`;
      const active = kind === 'like' ? 'likedByMe' : 'retweetedByMe';
      const count = kind === 'like' ? 'likesCount' : 'retweetsCount';
      if (locks.current.has(key)) return;
      locks.current.add(key);
      revision.current += 1;
      setPending(new Set(locks.current));
      const state = { ...item, ...current.current[item.id] };
      const before: ReactionState = { [active]: state[active], [count]: state[count] };
      update(item.id, {
        [active]: !state[active],
        [count]: Math.max(0, state[count] + (state[active] ? -1 : 1)),
      });
      try {
        if (kind === 'like') {
          if (state[active]) await postService.unlikePost(item.id);
          else await postService.likePost(item.id);
        } else {
          if (state[active]) await postService.undoRetweet(item.id);
          else await postService.retweet(item.id);
        }
      } catch (error) {
        update(item.id, before);
        if (mounted.current) Alert.alert('Error', getAuthErrorMessage(error));
      }
      // A failed response can still mean the server committed the mutation.
      try {
        const fresh = await postService.getPost(item.id);
        update(item.id, { [active]: fresh[active], [count]: fresh[count] });
      } catch {
        // Keep the optimistic result or rollback until a successful screen refresh.
      } finally {
        locks.current.delete(key);
        revision.current += 1;
        if (mounted.current) setPending(new Set(locks.current));
      }
    },
    [update]
  );

  const beginRead = useCallback(() => revision.current, []);
  const acceptRead = useCallback((version: number, items: FeedItem[]) => {
    if (!mounted.current || version !== revision.current) return false;
    const next = { ...current.current };
    for (const item of items) {
      if (!locks.current.has(`like:${item.id}`) && !locks.current.has(`retweet:${item.id}`)) {
        delete next[item.id];
      }
    }
    current.current = next;
    setOverrides(next);
    return true;
  }, []);

  return useMemo(
    () => ({
      forPost: (item: FeedItem): FeedItem => ({ ...item, ...overrides[item.id] }),
      isRetweetPending: (id: string) => pending.has(`retweet:${id}`),
      isLikePending: (id: string) => pending.has(`like:${id}`),
      toggleRetweet: (item: FeedItem) => toggle(item, 'retweet'),
      toggleLike: (item: FeedItem) => toggle(item, 'like'),
      beginRead,
      acceptRead,
    }),
    [overrides, pending, toggle, beginRead, acceptRead]
  );
}
