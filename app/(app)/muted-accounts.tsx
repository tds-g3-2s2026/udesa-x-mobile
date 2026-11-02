import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { muteService } from '../../src/features/social/services/muteService';
import { getAuthErrorMessage } from '../../src/api/apiClient';
import { MutedAccount } from '../../src/types/social';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

export default function MutedAccountsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [accounts, setAccounts] = useState<MutedAccount[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  // Only the row being unmuted disables, so acting on one does not freeze
  // the rest of the list.
  const [unmutingId, setUnmutingId] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    try {
      const page = await muteService.getMuted();
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
      const page = await muteService.getMuted(nextCursor);
      setAccounts((previous) => [...previous, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoadingMore(false);
    }
  };

  // No confirmation: unmuting only brings the account's posts back to the
  // feed, and it can be muted again from its profile.
  const unmute = async (id: string) => {
    setUnmutingId(id);
    try {
      await muteService.unmute(id);
      setAccounts((previous) => previous.filter((account) => account.id !== id));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setUnmutingId(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
        <Text style={styles.title}>Cuentas silenciadas</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="muted-list"
          data={accounts}
          keyExtractor={(account) => account.id}
          contentContainerStyle={styles.list}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="volume-mute-outline" size={40} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>No silenciaste a nadie</Text>
              <Text style={styles.emptyText}>
                Las cuentas que silencies van a aparecer acá, y las vas a poder dejar de silenciar.
              </Text>
            </View>
          }
          ListFooterComponent={
            isLoadingMore ? (
              <ActivityIndicator testID="muted-list-footer-loading" color={colors.primary} />
            ) : null
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.handle}>{item.handle}</Text>
              <Text
                style={styles.unmuteButton}
                onPress={() => unmutingId === null && unmute(item.id)}
                accessibilityRole="button"
              >
                {unmutingId === item.id ? 'Quitando…' : 'Dejar de silenciar'}
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
    // Not red like unblocking: unmuting takes nothing away.
    unmuteButton: {
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      overflow: 'hidden',
      color: colors.primary,
      backgroundColor: colors.primarySoft,
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
