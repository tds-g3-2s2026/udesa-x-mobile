import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthErrorMessage } from '../../../src/api/apiClient';
import { EmptyState } from '../../../src/features/shell/components/AppScreen';
import { listService } from '../../../src/features/lists/services/listService';
import { PostCard } from '../../../src/features/posts/components/PostCard';
import { usePostInteractions } from '../../../src/features/posts/usePostInteractions';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { FeedItem } from '../../../src/types/post';

// What the accounts of one list posted and retweeted (E3-H8 CA.2): the main
// feed's shape and paging, with only the members' activity.
export default function ListFeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const userId = useAuthStore((state) => state.user?.id);

  const interactions = usePostInteractions();
  const { beginRead, acceptRead } = interactions;

  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const loadFeed = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      try {
        const version = beginRead();
        const page = await listService.getFeed(id, null);
        if (!acceptRead(version, page.items)) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setLoadError(null);
      } catch (error) {
        // A list deleted from another device answers 404: the screen says so.
        setLoadError(getAuthErrorMessage(error));
      } finally {
        if (isRefresh) setIsRefreshing(false);
        else setIsLoading(false);
      }
    },
    [id, beginRead, acceptRead]
  );

  // Read again on every visit, as the main feed does.
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const version = beginRead();
      const page = await listService.getFeed(id, nextCursor);
      if (!acceptRead(version, page.items)) return;
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
        <Text style={styles.title}>{name || 'Lista'}</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loadError ? (
        <EmptyState icon="list-outline" title="No se pudo abrir la lista" text={loadError} />
      ) : (
        <FlatList
          testID="list-feed"
          data={items}
          keyExtractor={(item) => item.entryId}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadFeed(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="newspaper-outline"
              title="Todavía no hay publicaciones"
              text="Cuando las cuentas de esta lista publiquen, lo vas a ver acá. Sumá cuentas desde su perfil."
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                testID="list-feed-footer-loading"
                style={styles.footerLoading}
                color={colors.primary}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              item={interactions.forPost(item)}
              onRetweet={() => interactions.toggleRetweet(item)}
              retweetPending={interactions.isRetweetPending(item.id)}
              onLike={() => interactions.toggleLike(item)}
              likePending={interactions.isLikePending(item.id)}
              onOpen={() => router.push({ pathname: '/post/[id]', params: { id: item.id } })}
              onReply={() => router.push({ pathname: '/compose', params: { parentId: item.id } })}
              onReport={
                item.authorId !== userId
                  ? () =>
                      router.push({
                        pathname: '/report',
                        params: { postId: item.id, handle: item.authorHandle ?? '' },
                      })
                  : undefined
              }
            />
          )}
        />
      )}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: colors.surface,
    },
    header: {
      paddingHorizontal: 20,
      marginBottom: 8,
    },
    backLink: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
      marginBottom: 12,
    },
    title: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.text,
      letterSpacing: -0.5,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flexGrow: 1,
      paddingBottom: 24,
    },
    footerLoading: {
      marginVertical: 16,
    },
  });
}
