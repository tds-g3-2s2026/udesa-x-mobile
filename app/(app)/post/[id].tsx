import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { EmptyState } from '../../../src/features/shell/components/AppScreen';
import { PostCard } from '../../../src/features/posts/components/PostCard';
import { postService, getAuthErrorMessage } from '../../../src/features/posts/services/postService';
import { usePostDeletion } from '../../../src/features/posts/usePostDeletion';
import { usePostInteractions } from '../../../src/features/posts/usePostInteractions';
import { FeedItem, PostDetail } from '../../../src/types/post';
import { useAuthStore } from '../../../src/stores/authStore';

export default function PostDetailScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((state) => state.user?.id);
  const { id } = useLocalSearchParams<{ id: string }>();

  const interactions = usePostInteractions();
  const { beginRead, acceptRead } = interactions;

  const [post, setPost] = useState<PostDetail | null>(null);
  const [replies, setReplies] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reloads on every focus, so coming back from answering lands here with the
  // new reply already in the list and the reply counter up to date.
  const load = useCallback(async () => {
    const version = beginRead();
    try {
      const [detail, page] = await Promise.all([
        postService.getPost(id),
        postService.getReplies(id, null),
      ]);
      if (!acceptRead(version, [detail, ...page.items])) return;
      setPost(detail);
      setReplies(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      if (!acceptRead(version, [])) return;
      setPost((previous) => (previous?.deleted ? previous : null));
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, [id, beginRead, acceptRead]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const deletion = usePostDeletion(() => {
    setPost((previous) => (previous ? deletion.forPost(previous) : null));
    setReplies((previous) => previous.map(deletion.forPost));
    return load();
  });

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const version = beginRead();
      const page = await postService.getReplies(id, nextCursor);
      if (!acceptRead(version, page.items)) return;
      setReplies((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const reply = (target: string) =>
    router.push({ pathname: '/compose', params: { parentId: target } });

  const report = (item: FeedItem) =>
    item.authorId !== userId
      ? () =>
          router.push({
            pathname: '/report',
            params: { postId: item.id, handle: item.authorHandle ?? '' },
          })
      : undefined;

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (!post) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="alert-circle-outline"
          title="Publicación no disponible"
          text="No pudimos cargar esta publicación."
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        testID="replies-list"
        data={replies.map(deletion.forPost)}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View>
            <PostCard
              item={deletion.forPost(interactions.forPost(post))}
              onDelete={
                post.authorId === userId ? () => deletion.remove(deletion.forPost(post)) : undefined
              }
              deletePending={deletion.isPending(post.id)}
              onRetweet={() => interactions.toggleRetweet(deletion.forPost(post))}
              retweetPending={interactions.isRetweetPending(post.id)}
              onLike={() => interactions.toggleLike(deletion.forPost(post))}
              likePending={interactions.isLikePending(post.id)}
              onReply={() => reply(post.id)}
              onReport={report(post)}
            />
            <Text style={styles.repliesTitle}>Respuestas</Text>
          </View>
        }
        ListEmptyComponent={<Text style={styles.noReplies}>Todavía no hay respuestas.</Text>}
        ListFooterComponent={
          isLoadingMore ? (
            <ActivityIndicator
              testID="replies-footer-loading"
              style={styles.footerLoading}
              color={colors.primary}
            />
          ) : null
        }
        renderItem={({ item }) => (
          <PostCard
            item={deletion.forPost(interactions.forPost(item))}
            onDelete={
              item.authorId === userId ? () => deletion.remove(deletion.forPost(item)) : undefined
            }
            deletePending={deletion.isPending(item.id)}
            onRetweet={() => interactions.toggleRetweet(deletion.forPost(item))}
            retweetPending={interactions.isRetweetPending(item.id)}
            onLike={() => interactions.toggleLike(deletion.forPost(item))}
            likePending={interactions.isLikePending(item.id)}
            onOpen={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
            onReply={() => reply(item.id)}
            onReport={report(item)}
          />
        )}
      />
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.surface,
    },
    list: {
      flexGrow: 1,
      paddingTop: 12,
      paddingBottom: 32,
    },
    repliesTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginTop: 6,
      marginBottom: 10,
    },
    noReplies: {
      fontSize: 14,
      color: colors.muted,
    },
    footerLoading: {
      paddingVertical: 16,
    },
  });
}
