import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { FeedItem } from '../../types/post';
import { getAuthErrorMessage, postService } from './services/postService';

export function usePostDeletion(onDeleted: () => void | Promise<void>) {
  const [, setDeleted] = useState<Set<string>>(new Set());
  const [pending, setPending] = useState<Set<string>>(new Set());
  const locks = useRef(new Set<string>());
  const confirmed = useRef(new Set<string>());
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const remove = useCallback(
    async (id: string) => {
      if (locks.current.has(id) || confirmed.current.has(id)) return;
      locks.current.add(id);
      setPending(new Set(locks.current));
      let succeeded = false;
      try {
        await postService.deletePost(id);
        succeeded = true;
      } catch (error) {
        try {
          succeeded = (await postService.getPost(id)).deleted;
        } catch {
          /* A failed read cannot confirm whether the delete committed. */
        }
        if (!succeeded && mounted.current) Alert.alert('Error', getAuthErrorMessage(error));
      }
      if (succeeded) {
        confirmed.current.add(id);
        if (mounted.current) {
          setDeleted(new Set(confirmed.current));
          try {
            await onDeleted();
          } catch {
            /* The confirmed deletion survives a failed refresh. */
          }
        }
      }
      locks.current.delete(id);
      if (mounted.current) setPending(new Set(locks.current));
    },
    [onDeleted]
  );

  return {
    isPending: (id: string) => pending.has(id),
    forPost: <T extends FeedItem>(item: T): T =>
      item.deleted || confirmed.current.has(item.id)
        ? {
            ...item,
            deleted: true,
            content: null,
            likesCount: 0,
            retweetsCount: 0,
            likedByMe: false,
            retweetedByMe: false,
            retweetedBy: null,
            entryId: `post:${item.id}`,
            activityAt: item.createdAt,
          }
        : item,
    remove: (item: FeedItem) => remove(item.id),
  };
}
