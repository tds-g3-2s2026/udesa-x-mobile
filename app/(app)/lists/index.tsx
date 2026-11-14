import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAuthErrorMessage } from '../../../src/api/apiClient';
import { EmptyState } from '../../../src/features/shell/components/AppScreen';
import { listService } from '../../../src/features/lists/services/listService';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { AccountList } from '../../../src/types/lists';

// The same limit posts-api applies to a list name.
const MAX_NAME_LENGTH = 50;

// The caller's lists (E3-H8): open one to read what its accounts post, create
// one, or delete one. Accounts are added from their profile.
export default function ListsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [lists, setLists] = useState<AccountList[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Read again on every visit: accounts may have been added from a profile.
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      listService
        .getLists()
        .then((loaded) => {
          if (!cancelled) setLists(loaded);
        })
        .catch((error) => {
          if (!cancelled) Alert.alert('Error', getAuthErrorMessage(error));
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [])
  );

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await listService.createList(name);
      setLists((current) => [...current, created]);
      setNewName('');
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (list: AccountList) => {
    setDeletingId(list.id);
    try {
      await listService.deleteList(list.id);
      setLists((current) => current.filter((one) => one.id !== list.id));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setDeletingId(null);
    }
  };

  // Asked first because it cannot be undone. It says what stays: the accounts
  // and their posts in the main feed (CA.4).
  const confirmRemove = (list: AccountList) => {
    Alert.alert(
      `¿Borrar la lista ${list.name}?`,
      'Las cuentas que tenía siguen apareciendo en tu feed principal.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Borrar', style: 'destructive', onPress: () => void remove(list) },
      ]
    );
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Text style={styles.backLink} onPress={() => router.back()}>
          <Ionicons name="chevron-back" size={18} color={colors.primary} /> Volver
        </Text>
        <Text style={styles.title}>Listas</Text>
      </View>

      <View style={styles.newList}>
        <TextInput
          style={styles.input}
          value={newName}
          onChangeText={setNewName}
          placeholder="Nombre de una lista nueva"
          placeholderTextColor={colors.placeholder}
          maxLength={MAX_NAME_LENGTH}
          editable={!creating}
          accessibilityLabel="Nombre de una lista nueva"
        />
        <TouchableOpacity
          onPress={create}
          disabled={creating || !newName.trim()}
          accessibilityRole="button"
          accessibilityLabel="Crear lista"
          accessibilityState={{ disabled: creating || !newName.trim() }}
        >
          <Text style={[styles.action, !newName.trim() && styles.actionDisabled]}>
            {creating ? 'Creando…' : 'Crear'}
          </Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          testID="lists"
          data={lists}
          keyExtractor={(list) => list.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <EmptyState
              icon="list-outline"
              title="Todavía no tenés listas"
              text="Creá una acá, o sumá una cuenta que seguís desde su perfil."
            />
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <TouchableOpacity
                style={styles.rowText}
                onPress={() =>
                  router.push({ pathname: '/lists/[id]', params: { id: item.id, name: item.name } })
                }
                accessibilityRole="button"
                accessibilityLabel={`Abrir ${item.name}`}
              >
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.hint}>
                  {item.membersCount === 1 ? '1 cuenta' : `${item.membersCount} cuentas`}
                </Text>
              </TouchableOpacity>
              {deletingId === item.id ? (
                <ActivityIndicator color={colors.primary} />
              ) : (
                <TouchableOpacity
                  onPress={() => confirmRemove(item)}
                  disabled={deletingId !== null}
                  accessibilityRole="button"
                  accessibilityLabel={`Borrar ${item.name}`}
                >
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                </TouchableOpacity>
              )}
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
    newList: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      marginBottom: 16,
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 12,
      paddingVertical: 10,
      color: colors.text,
      backgroundColor: colors.field,
    },
    action: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
    actionDisabled: {
      color: colors.placeholder,
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
    rowText: {
      flex: 1,
      paddingRight: 12,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    hint: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
