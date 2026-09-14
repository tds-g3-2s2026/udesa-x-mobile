import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  followService,
  getAuthErrorMessage,
} from '../../src/features/social/services/followService';
import { FollowRequestSummary } from '../../src/types/social';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

export default function FollowRequestsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLoading, setIsLoading] = useState(true);
  const [requests, setRequests] = useState<FollowRequestSummary[]>([]);
  // Tracks which row has a request in flight, so only that row's buttons
  // disable: approving one request must not block acting on another.
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  const loadRequests = useCallback(async () => {
    try {
      const data = await followService.getFollowRequests();
      setRequests(data);
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const resolve = async (id: string, action: 'approve' | 'reject') => {
    setResolvingId(id);
    try {
      if (action === 'approve') {
        await followService.approveFollowRequest(id);
      } else {
        await followService.rejectFollowRequest(id);
      }
      // The server is the source of truth for who is still pending: removing
      // the row locally instead of re-fetching avoids a second round trip for
      // a list that a single resolved request already tells us how to update.
      setRequests((previous) => previous.filter((request) => request.id !== id));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
        <Text style={styles.title}>Solicitudes pendientes</Text>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={requests}
          keyExtractor={(request) => request.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="people-outline" size={40} color={colors.placeholder} />
              <Text style={styles.emptyTitle}>No tenés solicitudes pendientes</Text>
              <Text style={styles.emptyText}>
                Acá van a aparecer los pedidos para seguirte de las cuentas protegidas.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.handle}>{item.requesterHandle}</Text>
              <View style={styles.actions}>
                <Text
                  style={[styles.actionButton, styles.rejectButton]}
                  onPress={() => resolvingId === null && resolve(item.id, 'reject')}
                >
                  {resolvingId === item.id ? 'Rechazando…' : 'Rechazar'}
                </Text>
                <Text
                  style={[styles.actionButton, styles.approveButton]}
                  onPress={() => resolvingId === null && resolve(item.id, 'approve')}
                >
                  {resolvingId === item.id ? 'Aprobando…' : 'Aprobar'}
                </Text>
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
    actions: {
      flexDirection: 'row',
      gap: 12,
    },
    actionButton: {
      fontSize: 13,
      fontWeight: '700',
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 999,
      overflow: 'hidden',
    },
    approveButton: {
      color: colors.onPrimary,
      backgroundColor: colors.primary,
    },
    rejectButton: {
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
