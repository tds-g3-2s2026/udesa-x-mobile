import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { EmptyState } from '../../src/features/shell/components/AppScreen';
import { PostCard } from '../../src/features/posts/components/PostCard';
import { getAuthErrorMessage, postService } from '../../src/features/posts/services/postService';
import { usePostInteractions } from '../../src/features/posts/usePostInteractions';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';
import { FeedItem } from '../../src/types/post';
import { BackLink } from '../../src/features/shell/components/BackLink';

// The posts the signed-in user saved, newest save first. Read again on every
// visit; a post un-saved here stays listed until the next load.
export default function SavedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const userId = useAuthStore((state) => state.user?.id);

  const interactions = usePostInteractions();
  const { beginRead, acceptRead } = interactions;

  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Read by the reload's catch, which must not change when the list grows.
  const itemsRef = useRef(items);
  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  const loadSaved = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      try {
        const version = beginRead();
        const page = await postService.getBookmarks(null);
        if (!acceptRead(version, page.items)) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
        setLoadError(null);
      } catch (error) {
        // Keep what is already on screen; the inline error only replaces an empty list.
        if (itemsRef.current.length > 0) Alert.alert('Error', getAuthErrorMessage(error));
        else setLoadError(getAuthErrorMessage(error));
      } finally {
        if (isRefresh) setIsRefreshing(false);
        else setIsLoading(false);
      }
    },
    [beginRead, acceptRead]
  );

  useFocusEffect(
    useCallback(() => {
      loadSaved();
    }, [loadSaved])
  );

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const version = beginRead();
      const page = await postService.getBookmarks(nextCursor);
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
        <BackLink />
        <Text style={styles.title}>Guardados</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loadError ? (
        <EmptyState
          icon="bookmark-outline"
          title="No se pudieron abrir tus guardados"
          text={loadError}
        />
      ) : (
        <FlatList
          testID="saved-list"
          data={items}
          keyExtractor={(item) => item.entryId}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => loadSaved(true)}
              tintColor={colors.primary}
            />
          }
          ListEmptyComponent={
            <EmptyState
              icon="bookmark-outline"
              title="Todavía no guardaste nada"
              text="Guardá posts con el ícono de marcador para releerlos más tarde."
            />
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                testID="saved-footer-loading"
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
              onBookmark={() => interactions.toggleSave(item)}
              bookmarkPending={interactions.isSavePending(item.id)}
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
