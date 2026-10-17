import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ApiError } from '../../../src/api/apiClient';
import { EmptyState } from '../../../src/features/shell/components/AppScreen';
import { PostCard } from '../../../src/features/posts/components/PostCard';
import { CurrentProfileContext } from '../../../src/features/posts/currentProfile';
import { FollowButton } from '../../../src/features/social/components/FollowButton';
import {
  getAuthErrorMessage,
  PRIVATE_ACCOUNT_CODE,
  profileService,
} from '../../../src/features/social/services/profileService';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { FeedItem } from '../../../src/types/post';
import { FollowState, UserProfile } from '../../../src/types/social';

const MONTHS = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
];

// Spelled out by hand: month names from Intl depend on the JS engine, and
// Hermes and the test runner do not always agree on them.
function joinedOn(createdAt: string): string {
  const date = new Date(createdAt);
  return `Se unió en ${MONTHS[date.getUTCMonth()]} de ${date.getUTCFullYear()}`;
}

function initialOf(profile: UserProfile): string {
  const name = profile.displayName || profile.handle?.replace(/^@/, '') || '?';
  return name.charAt(0).toUpperCase();
}

export default function UserProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuthStore((state) => state.user?.id);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [items, setItems] = useState<FeedItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  // A protected account the caller does not follow: its posts are refused,
  // and the screen says why instead of looking like an account that never
  // posted.
  const [postsHidden, setPostsHidden] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // The header and the first page go out together: neither needs the other,
  // and a protected account still shows its header when its posts are refused.
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    Promise.allSettled([profileService.getProfile(id), profileService.getPosts(id, null)]).then(
      ([header, page]) => {
        if (cancelled) return;
        if (header.status === 'rejected') {
          setLoadError(getAuthErrorMessage(header.reason));
        } else {
          setProfile(header.value);
          if (page.status === 'fulfilled') {
            setItems(page.value.items);
            setNextCursor(page.value.nextCursor);
          } else if (page.reason instanceof ApiError && page.reason.code === PRIVATE_ACCOUNT_CODE) {
            setPostsHidden(true);
          } else {
            Alert.alert('Error', getAuthErrorMessage(page.reason));
          }
        }
        setIsLoading(false);
      }
    );
    return () => {
      cancelled = true;
    };
  }, [id]);

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const page = await profileService.getPosts(id, nextCursor);
      setItems((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  // Keeps the counter in step with the button without asking for the
  // profile again. A protected account stops showing its posts the moment
  // it is unfollowed, the same as posts-api would answer next time.
  const handleFollowChange = (state: FollowState) => {
    if (!profile) return;
    const delta = state === 'following' ? 1 : profile.isFollowedByMe ? -1 : 0;
    setProfile({
      ...profile,
      isFollowedByMe: state === 'following',
      followersCount: profile.followersCount + delta,
    });
    if (profile.isPrivate && state === 'none') {
      setItems([]);
      setNextCursor(null);
      setPostsHidden(true);
    }
  };

  const header = profile ? (
    <View style={styles.profileHeader}>
      {/* No cover photo feature yet: a plain band stands in for it. */}
      <View style={styles.cover} />
      <View style={styles.avatar}>
        <Text style={styles.avatarInitial}>{initialOf(profile)}</Text>
      </View>

      <View style={styles.nameRow}>
        <View style={styles.names}>
          <Text style={styles.displayName}>{profile.displayName || profile.handle}</Text>
          {profile.handle ? <Text style={styles.handle}>{profile.handle}</Text> : null}
        </View>
        {profile.id !== userId ? (
          <FollowButton
            key={profile.id}
            targetUserId={profile.id}
            initialState={profile.isFollowedByMe ? 'following' : 'none'}
            onStateChange={handleFollowChange}
          />
        ) : null}
      </View>

      {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}

      {profile.createdAt ? (
        <View style={styles.joined}>
          <Ionicons name="calendar-outline" size={14} color={colors.muted} />
          <Text style={styles.joinedLabel}>{joinedOn(profile.createdAt)}</Text>
        </View>
      ) : null}

      <View style={styles.counts}>
        <Text style={styles.countLabel}>
          <Text style={styles.countNumber}>{profile.followingCount}</Text> Siguiendo
        </Text>
        <Text style={styles.countLabel}>
          <Text style={styles.countNumber}>{profile.followersCount}</Text> Seguidores
        </Text>
      </View>

      <Text style={styles.tabTitle}>Publicaciones</Text>
    </View>
  ) : null;

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.backLink} onPress={() => router.back()}>
        <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
      </Text>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : loadError ? (
        <EmptyState icon="person-outline" title="No se pudo abrir el perfil" text={loadError} />
      ) : (
        <CurrentProfileContext.Provider value={id}>
          <FlatList
            testID="profile-posts"
            data={postsHidden ? [] : items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            ListHeaderComponent={header}
            onEndReached={loadMore}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={
              postsHidden ? (
                <EmptyState
                  icon="lock-closed-outline"
                  title="Esta cuenta es privada"
                  text="Seguila para ver sus publicaciones."
                />
              ) : (
                <EmptyState
                  icon="newspaper-outline"
                  title="Todavía no publicó nada"
                  text="Cuando publique, sus posts van a aparecer acá."
                />
              )
            }
            ListFooterComponent={
              isLoadingMore ? (
                <ActivityIndicator
                  testID="profile-footer-loading"
                  style={styles.footerLoading}
                  color={colors.primary}
                />
              ) : null
            }
            renderItem={({ item }) => (
              <PostCard
                item={item}
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
        </CurrentProfileContext.Provider>
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
    backLink: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
      marginBottom: 12,
    },
    loading: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
    },
    list: {
      paddingBottom: 24,
    },
    profileHeader: {
      marginBottom: 12,
    },
    cover: {
      height: 96,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      marginTop: -36,
      marginLeft: 16,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 3,
      borderColor: colors.surface,
      backgroundColor: colors.primarySoft,
    },
    avatarInitial: {
      fontSize: 30,
      fontWeight: '800',
      color: colors.primary,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginTop: 8,
    },
    names: {
      flex: 1,
    },
    displayName: {
      fontSize: 20,
      fontWeight: '800',
      color: colors.text,
    },
    handle: {
      fontSize: 15,
      fontWeight: '600',
      color: colors.primary,
    },
    bio: {
      marginTop: 10,
      fontSize: 14,
      lineHeight: 20,
      color: colors.text,
    },
    joined: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginTop: 10,
    },
    joinedLabel: {
      fontSize: 13,
      color: colors.muted,
    },
    counts: {
      flexDirection: 'row',
      gap: 16,
      marginTop: 10,
    },
    countLabel: {
      fontSize: 14,
      color: colors.muted,
    },
    countNumber: {
      fontWeight: '700',
      color: colors.text,
    },
    tabTitle: {
      marginTop: 20,
      paddingBottom: 8,
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
      borderBottomWidth: 2,
      borderBottomColor: colors.primary,
      alignSelf: 'flex-start',
    },
    footerLoading: {
      marginVertical: 16,
    },
  });
}
