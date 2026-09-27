import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { blockService } from '../../src/features/social/services/blockService';
import { getAuthErrorMessage } from '../../src/api/apiClient';
import { BlockedAccount } from '../../src/types/social';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

export default function BlockedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<BlockedAccount[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Only the row being unblocked disables, so acting on one does not freeze
  // the rest of the list.
  const [unblockingId, setUnblockingId] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await blockService.getBlocked();
      setAccounts(page.items);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadFirstPage();
  }, [loadFirstPage]);

  const loadMore = async () => {
    if (isLoadingMore || nextCursor === null) return;
    setIsLoadingMore(true);
    try {
      const page = await blockService.getBlocked(nextCursor);
      setAccounts((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  // No confirmation, unlike blocking: unblocking removes nothing, and the
  // follows the block tore down do not come back on their own.
  const unblock = async (id: string) => {
    setUnblockingId(id);
    try {
      await blockService.unblock(id);
      setAccounts((previous) => previous.filter((account) => account.id !== id));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setUnblockingId(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
        <Text style={styles.title}>Cuentas bloqueadas</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="blocked-list"
          data={accounts}
          keyExtractor={(account) => account.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="ban-outline" size={40} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>No bloqueaste a nadie</Text>
              <Text style={styles.emptyText}>
                Las cuentas que bloquees van a aparecer acá, y las vas a poder desbloquear.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator testID="blocked-list-footer-loading" color={colors.primary} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.handle}>{item.handle}</Text>
              <Text
                style={styles.unblockButton}
                onPress={() => unblockingId === null && unblock(item.id)}
                accessibilityRole="button"
              >
                {unblockingId === item.id ? 'Desbloqueando…' : 'Desbloquear'}
              </Text>
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
      marginBottom: 16,
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
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      marginBottom: 10,
    },
    handle: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    unblockButton: {
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      overflow: 'hidden',
      color: colors.danger,
      backgroundColor: colors.dangerSoft,
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
