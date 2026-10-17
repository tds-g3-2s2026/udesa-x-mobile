import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { FeedItem } from '../../types/post';
import { getAuthErrorMessage, postService } from './services/postService';

type RetweetState = Pick<FeedItem, 'retweetedByMe' | 'retweetsCount'>;

export function useRetweets() {
  const [overrides, setOverrides] = useState<Record<string, RetweetState>>({});
  const [pending, setPending] = useState<Set<string>>(new Set());
  const current = useRef<Record<string, RetweetState>>({});
  const locks = useRef(new Set<string>());
  const revision = useRef(0);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const update = useCallback((id: string, state: RetweetState) => {
    current.current = { ...current.current, [id]: state };
    if (mounted.current) setOverrides(current.current);
  }, []);

  const toggle = useCallback(
    async (item: FeedItem) => {
      if (locks.current.has(item.id)) return;
      locks.current.add(item.id);
      revision.current += 1;
      setPending(new Set(locks.current));
      const before: RetweetState = current.current[item.id] ?? {
        retweetedByMe: item.retweetedByMe,
        retweetsCount: item.retweetsCount,
      };
      update(item.id, {
        retweetedByMe: !before.retweetedByMe,
        retweetsCount: Math.max(0, before.retweetsCount + (before.retweetedByMe ? -1 : 1)),
      });
      try {
        if (before.retweetedByMe) await postService.undoRetweet(item.id);
        else await postService.retweet(item.id);
      } catch (error) {
        update(item.id, before);
        if (mounted.current) Alert.alert('Error', getAuthErrorMessage(error));
      }
      // A failed response can still mean the server committed the mutation.
      try {
        const fresh = await postService.getPost(item.id);
        update(item.id, { retweetedByMe: fresh.retweetedByMe, retweetsCount: fresh.retweetsCount });
      } catch {
        // Keep the optimistic result or rollback until a successful screen refresh.
      } finally {
        locks.current.delete(item.id);
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
      if (!locks.current.has(item.id)) delete next[item.id];
    }
    current.current = next;
    setOverrides(next);
    return true;
  }, []);

  return useMemo(
    () => ({
      forPost: (item: FeedItem): FeedItem => ({ ...item, ...overrides[item.id] }),
      isPending: (id: string) => pending.has(id),
      toggle,
      beginRead,
      acceptRead,
    }),
    [overrides, pending, toggle, beginRead, acceptRead]
  );
}
