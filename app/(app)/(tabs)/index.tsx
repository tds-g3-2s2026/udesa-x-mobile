import { useCallback, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { EmptyState, useSearchFieldStyles } from '../../../src/features/shell/components/AppScreen';
import { FollowButton } from '../../../src/features/social/components/FollowButton';
import { postService, getAuthErrorMessage } from '../../../src/features/posts/services/postService';
import { formatRelativeTime } from '../../../src/features/posts/relativeTime';
import { FeedItem, SuggestedAccount } from '../../../src/types/post';

export default function FeedScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const searchFieldStyles = useSearchFieldStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [suggestions, setSuggestions] = useState<SuggestedAccount[]>([]);

  const loadSuggestions = useCallback(async () => {
    try {
      setSuggestions(await postService.getSuggestedAccounts());
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    }
  }, []);

  const loadFeed = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      try {
        const page = await postService.getFeed(null);
        setItems(page.items);
        setNextCursor(page.nextCursor);
        // Nothing to follow yet is exactly when the suggestions matter: no
        // point fetching them for a screen that already has content to show.
        if (page.items.length === 0) await loadSuggestions();
      } catch (error) {
        Alert.alert('Error', getAuthErrorMessage(error));
      } finally {
        if (isRefresh) setIsRefreshing(false);
        else setIsLoading(false);
      }
    },
    [loadSuggestions]
  );

  // Reloads every time this tab regains focus, publishing included: coming
  // back from Componer lands here with a fresh GET /feed already showing it,
  // no local copy of what was just sent to keep in sync by hand.
  useFocusEffect(
    useCallback(() => {
      loadFeed();
    }, [loadFeed])
  );

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const page = await postService.getFeed(nextCursor);
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const header = (
    <View>
      <Text style={styles.brand}>UdeSA-X</Text>

      <TouchableOpacity
        style={searchFieldStyles.field}
        onPress={() => router.navigate('/search')}
        accessibilityRole="button"
        accessibilityLabel="Buscar en UdeSA-X"
      >
        <Ionicons name="search-outline" size={18} color={colors.placeholder} />
        <Text style={searchFieldStyles.placeholder}>Buscar en UdeSA-X</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.composeField}
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="Escribir un post nuevo"
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.composePlaceholder}>¿Qué está pasando?</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      {isLoading ? (
        <>
          {header}
          <View style={styles.loading}>
            <ActivityIndicator color={colors.primary} />
          </View>
        </>
      ) : (
        <FlatList
          testID="feed-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          ListHeaderComponent={header}
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
            <View style={styles.empty}>
              <EmptyState
                icon="newspaper-outline"
                title="Todavía no hay publicaciones"
                text="Seguí a alguien para que su actividad aparezca acá."
              />
              {suggestions.length > 0 ? (
                <View style={styles.suggestions}>
                  <Text style={styles.suggestionsTitle}>Cuentas para seguir</Text>
                  {suggestions.map((account) => (
                    <View key={account.id} style={styles.suggestionRow}>
                      <View style={styles.avatar}>
                        <Ionicons name="person" size={20} color={colors.primary} />
                      </View>
                      <View style={styles.suggestionText}>
                        <Text style={styles.suggestionName}>
                          {account.displayName || account.handle}
                        </Text>
                        <Text style={styles.suggestionMeta}>
                          {account.handle} · {account.followersCount} seguidores
                        </Text>
                      </View>
                      <FollowButton targetUserId={account.id} initialState="none" />
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                testID="feed-footer-loading"
                style={styles.footerLoading}
                color={colors.primary}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.postCard}>
              <View style={styles.postHeader}>
                {/* No profile photo feature yet: a placeholder icon stands in. */}
                <View style={styles.avatar}>
                  <Ionicons name="person" size={20} color={colors.primary} />
                </View>
                <View style={styles.postAuthorBlock}>
                  <Text style={styles.postAuthor}>
                    {item.authorDisplayName || item.authorHandle}
                  </Text>
                  {item.authorDisplayName && item.authorHandle ? (
                    <Text style={styles.postHandle}>{item.authorHandle}</Text>
                  ) : null}
                </View>
                <Text style={styles.postTime}>{formatRelativeTime(item.createdAt)}</Text>
              </View>

              <Text style={styles.postContent}>{item.content}</Text>

              <View style={styles.postCounters}>
                <View style={styles.postCounter}>
                  <Ionicons name="heart-outline" size={16} color={colors.muted} />
                  <Text style={styles.postCounterLabel}>{item.likesCount}</Text>
                </View>
                <View style={styles.postCounter}>
                  <Ionicons name="repeat-outline" size={16} color={colors.muted} />
                  <Text style={styles.postCounterLabel}>{item.retweetsCount}</Text>
                </View>
                <View style={styles.postCounter}>
                  <Ionicons name="chatbubble-outline" size={16} color={colors.muted} />
                  <Text style={styles.postCounterLabel}>{item.repliesCount}</Text>
                </View>
              </View>
            </View>
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
      paddingHorizontal: 20,
      backgroundColor: colors.surface,
    },
    brand: {
      fontSize: 26,
      fontWeight: '800',
      color: colors.primary,
      letterSpacing: -0.5,
      marginBottom: 16,
    },
    composeField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
      marginBottom: 16,
    },
    composePlaceholder: {
      flex: 1,
      fontSize: 15,
      color: colors.primary,
      fontWeight: '600',
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      flexGrow: 1,
      paddingBottom: 32,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    postCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      marginBottom: 10,
    },
    postHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 8,
    },
    postAuthorBlock: {
      flex: 1,
    },
    postAuthor: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
    },
    postHandle: {
      fontSize: 12,
      color: colors.muted,
    },
    postTime: {
      fontSize: 12,
      color: colors.muted,
    },
    postContent: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 21,
      marginBottom: 10,
    },
    postCounters: {
      flexDirection: 'row',
      gap: 20,
    },
    postCounter: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    postCounterLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    footerLoading: {
      paddingVertical: 16,
    },
    empty: {
      flexGrow: 1,
      paddingTop: 40,
    },
    suggestions: {
      marginTop: 16,
    },
    suggestionsTitle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 10,
    },
    suggestionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      marginBottom: 10,
    },
    suggestionText: {
      flex: 1,
    },
    suggestionName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    suggestionMeta: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
