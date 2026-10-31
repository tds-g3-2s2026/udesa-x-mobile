import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { getAuthErrorMessage } from '../../../src/api/apiClient';
import { EmptyState } from '../../../src/features/shell/components/AppScreen';
import { NotificationRow } from '../../../src/features/notifications/components/NotificationRow';
import { notificationService } from '../../../src/features/notifications/notificationService';
import { notificationTarget } from '../../../src/features/notifications/notificationContent';
import {
  markLoadedAsRead,
  NotificationPages,
  notificationsKey,
  withoutNotification,
} from '../../../src/features/notifications/notificationsCache';
import { AppNotification } from '../../../src/features/notifications/types';

// The Notificaciones tab: the account's history, newest first, 20 at a time.
// It draws its own chrome instead of using AppScreen because AppScreen scrolls,
// and a FlatList inside a ScrollView loses its virtualization and its
// end-of-list event.
export default function NotificationsScreen() {
  const viewerId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isMarking, setIsMarking] = useState(false);
  const queryKey = notificationsKey(viewerId);

  // Coming back to the tab reloads it, so what arrived meanwhile shows up.
  // A load still in flight (the first one, on mount) is left alone instead of
  // being cancelled and started again.
  useFocusEffect(
    useCallback(() => {
      void client.invalidateQueries(
        { queryKey: notificationsKey(viewerId), refetchType: 'active' },
        { cancelRefetch: false }
      );
    }, [client, viewerId])
  );

  const list = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => notificationService.list(pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: !!viewerId,
  });
  const items = list.data?.pages.flatMap((page) => page.items) ?? [];
  const hasUnread = items.some((item) => item.readAt === null);

  // Only the rows already loaded are updated, once the server confirms: the
  // ones further down come from the server already read when scrolled to.
  const markAllAsRead = async () => {
    setIsMarking(true);
    try {
      await notificationService.markAllAsRead();
      const readAt = new Date().toISOString();
      client.setQueryData<NotificationPages>(queryKey, (data) => markLoadedAsRead(data, readAt));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsMarking(false);
    }
  };

  // The row leaves the list right away instead of waiting for the server. If
  // the delete fails the list is reloaded from the server, which puts the row
  // back, rather than restoring a copy taken before that may be stale by then.
  const remove = async (id: string) => {
    await client.cancelQueries({ queryKey });
    client.setQueryData<NotificationPages>(queryKey, (data) => withoutNotification(data, id));
    try {
      await notificationService.remove(id);
    } catch (error) {
      void client.invalidateQueries({ queryKey });
      Alert.alert('Error', getAuthErrorMessage(error));
    }
  };

  const open = (item: AppNotification) => {
    const target = notificationTarget(item);
    if (!target) return undefined;
    return () =>
      router.push(
        target.screen === 'user'
          ? { pathname: '/user/[id]', params: { id: target.id } }
          : { pathname: '/post/[id]', params: { id: target.id } }
      );
  };

  const empty = list.isPending ? (
    <ActivityIndicator accessibilityLabel="Cargando notificaciones" color={colors.primary} />
  ) : list.isError ? (
    <View style={styles.state}>
      <Text style={styles.error}>{list.error.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => void list.refetch()}>
        <Text style={styles.link}>Reintentar</Text>
      </Pressable>
    </View>
  ) : (
    <EmptyState
      icon="notifications-off-outline"
      title="No tenés notificaciones"
      text="Acá van a aparecer las respuestas, los seguidores nuevos y las menciones."
    />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Notificaciones</Text>
        <Pressable
          onPress={markAllAsRead}
          disabled={!hasUnread || isMarking}
          accessibilityRole="button"
          accessibilityState={{ disabled: !hasUnread || isMarking }}
        >
          <Text style={[styles.link, (!hasUnread || isMarking) && styles.disabledLink]}>
            Marcar todas como leídas
          </Text>
        </Pressable>
      </View>
      <FlatList
        testID="notifications-list"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <NotificationRow item={item} onOpen={open(item)} onDelete={() => void remove(item.id)} />
        )}
        contentContainerStyle={items.length ? styles.list : styles.empty}
        ListEmptyComponent={empty}
        refreshing={list.isRefetching && !list.isFetchingNextPage}
        onRefresh={() => void list.refetch()}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (list.hasNextPage && !list.isFetching && !list.isError) void list.fetchNextPage();
        }}
        ListFooterComponent={
          items.length ? (
            <View style={styles.state}>
              {list.isFetchingNextPage ? (
                <ActivityIndicator
                  accessibilityLabel="Cargando más notificaciones"
                  color={colors.primary}
                />
              ) : null}
              {list.isFetchNextPageError ? (
                <>
                  <Text style={styles.error}>{list.error?.message}</Text>
                  <Pressable accessibilityRole="button" onPress={() => void list.fetchNextPage()}>
                    <Text style={styles.link}>Reintentar</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.surface },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
      marginBottom: 12,
    },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, letterSpacing: -0.5 },
    link: { fontSize: 14, color: colors.primary, fontWeight: '600', paddingVertical: 6 },
    disabledLink: { color: colors.placeholder },
    error: { color: colors.danger, textAlign: 'center' },
    state: { paddingVertical: 20, gap: 10, alignItems: 'center' },
    list: { paddingBottom: 32 },
    empty: { flexGrow: 1, justifyContent: 'center', paddingBottom: 32 },
  });
}
