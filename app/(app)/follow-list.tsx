import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  followService,
  getAuthErrorMessage,
} from '../../src/features/social/services/followService';
import { FollowButton } from '../../src/features/social/components/FollowButton';
import { FollowListItem } from '../../src/types/social';
import { useAuthStore } from '../../src/stores/authStore';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

type ListTab = 'followers' | 'following';

const TAB_LABELS: Record<ListTab, string> = {
  followers: 'Seguidores',
  following: 'Siguiendo',
};

// Distinct per tab on purpose: the same sentence for both would say "nadie"
// without saying who is missing whom.
const EMPTY_COPY: Record<ListTab, { title: string; text: string }> = {
  followers: {
    title: 'Todavía no te sigue nadie',
    text: 'Cuando alguien te empiece a seguir, va a aparecer acá.',
  },
  following: {
    title: 'Todavía no seguís a nadie',
    text: 'Las cuentas que sigas van a aparecer acá.',
  },
};

export default function FollowListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const params = useLocalSearchParams<{ tab?: string }>();
  const userId = useAuthStore((state) => state.user?.id);

  const [activeTab, setActiveTab] = useState<ListTab>(
    params.tab === 'following' ? 'following' : 'followers'
  );
  const [items, setItems] = useState<FollowListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchPage = useCallback(
    (tab: ListTab, cursor: string | null) => {
      if (!userId) return Promise.reject(new Error('no session'));
      return tab === 'followers'
        ? followService.getFollowers(userId, cursor)
        : followService.getFollowing(userId, cursor);
    },
    [userId]
  );

  // Switching tabs starts a fresh list: the two tabs don't share a cursor.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setItems([]);
    setNextCursor(null);
    fetchPage(activeTab, null)
      .then((page) => {
        if (cancelled) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      })
      .catch((error) => {
        if (cancelled) return;
        Alert.alert('Error', getAuthErrorMessage(error));
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, fetchPage]);

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const page = await fetchPage(activeTab, nextCursor);
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  const emptyCopy = EMPTY_COPY[activeTab];

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
      </View>

      <View style={styles.tabs}>
        {(['followers', 'following'] as const).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
            accessibilityRole="button"
            accessibilityState={{ selected: activeTab === tab }}
          >
            <Text style={[styles.tabLabel, activeTab === tab && styles.tabLabelActive]}>
              {TAB_LABELS[tab]}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="follow-list"
          data={items}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>{emptyCopy.title}</Text>
              <Text style={styles.emptyText}>{emptyCopy.text}</Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator
                testID="follow-list-footer-loading"
                style={styles.footerLoading}
                color={colors.primary}
              />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              {/* No profile photo feature yet: a placeholder icon stands in. */}
              <View style={styles.avatar}>
                <Ionicons name="person" size={20} color={colors.primary} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.displayName}>{item.displayName || item.handle}</Text>
                {item.displayName && item.handle ? (
                  <Text style={styles.handle}>{item.handle}</Text>
                ) : null}
              </View>
              <FollowButton
                targetUserId={item.id}
                initialState={item.following ? 'following' : 'none'}
              />
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
      backgroundColor: colors.surface,
      paddingHorizontal: 20,
    },
    header: {
      marginBottom: 12,
    },
    backLink: {
      color: colors.primary,
      fontSize: 15,
      fontWeight: '600',
    },
    tabs: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
    },
    tabActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primarySoft,
    },
    tabLabel: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.muted,
    },
    tabLabelActive: {
      color: colors.primary,
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
    row: {
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
    avatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    rowText: {
      flex: 1,
    },
    displayName: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    handle: {
      fontSize: 13,
      color: colors.muted,
    },
    footerLoading: {
      paddingVertical: 16,
    },
    empty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      paddingHorizontal: 12,
      paddingTop: 60,
    },
    emptyTitle: {
      fontSize: 17,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    emptyText: {
      fontSize: 14,
      color: colors.muted,
      textAlign: 'center',
      lineHeight: 20,
    },
  });
}
