import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { getAuthErrorMessage } from '../../../api/apiClient';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { AccountList } from '../../../types/lists';
import { listService } from '../services/listService';

// The same limit posts-api applies to a list name.
const MAX_NAME_LENGTH = 50;

interface ListRow extends AccountList {
  hasAccount: boolean;
}

// Every list of the caller, with whether the account is in it. posts-api has no
// call for "the lists an account is in", so each list's members are read: there
// are twenty lists of a hundred accounts at most.
async function listsWith(accountId: string): Promise<ListRow[]> {
  const lists = await listService.getLists();
  const members = await Promise.all(lists.map((list) => listService.getMembers(list.id)));
  return lists.map((list, index) => ({
    ...list,
    hasAccount: members[index].some((member) => member.id === accountId),
  }));
}

/**
 * Adds an account the caller follows to their lists, or takes it out (E3-H8).
 * The same account can be in several lists at once, and a new list can be
 * created here with the account already in it.
 */
export function AddToListModal({
  accountId,
  handle,
  visible,
  onClose,
}: {
  accountId: string;
  handle: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [rows, setRows] = useState<ListRow[] | null>(null);
  // Only the list being changed disables, so the rest stay usable.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Read again every time it opens: a list may have changed from its own screen.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    setRows(null);
    setLoadError(null);
    listsWith(accountId)
      .then((loaded) => {
        if (!cancelled) setRows(loaded);
      })
      .catch((error) => {
        if (cancelled) return;
        setLoadError(getAuthErrorMessage(error));
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [visible, accountId]);

  const toggle = async (row: ListRow) => {
    setPendingId(row.id);
    try {
      if (row.hasAccount) await listService.removeMember(row.id, accountId);
      else await listService.addMember(row.id, accountId);
      setRows((current) =>
        (current ?? []).map((one) =>
          one.id === row.id
            ? {
                ...one,
                hasAccount: !row.hasAccount,
                membersCount: one.membersCount + (row.hasAccount ? -1 : 1),
              }
            : one
        )
      );
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  const create = async () => {
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    try {
      const created = await listService.createList(name);
      await listService.addMember(created.id, accountId);
      setRows((current) => [...(current ?? []), { ...created, membersCount: 1, hasAccount: true }]);
      setNewName('');
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal transparent visible={visible} onRequestClose={onClose} animationType="fade">
      <View style={styles.backdrop}>
        <View accessibilityViewIsModal style={styles.dialog}>
          <Text style={styles.title}>Agregar {handle ?? 'la cuenta'} a una lista</Text>

          {rows === null ? (
            <ActivityIndicator testID="lists-loading" color={colors.primary} />
          ) : (
            <ScrollView style={styles.lists}>
              {loadError ? <Text style={styles.error}>{loadError}</Text> : null}
              {rows.length === 0 && !loadError ? (
                <Text style={styles.hint}>Todavía no tenés listas. Creá una acá abajo.</Text>
              ) : null}
              {rows.map((row) => (
                <Pressable
                  key={row.id}
                  style={styles.row}
                  onPress={() => pendingId === null && toggle(row)}
                  disabled={pendingId !== null}
                  accessibilityRole="checkbox"
                  accessibilityLabel={row.name}
                  accessibilityState={{ checked: row.hasAccount, disabled: pendingId !== null }}
                >
                  <View style={styles.rowText}>
                    <Text style={styles.name}>{row.name}</Text>
                    <Text style={styles.hint}>
                      {row.membersCount === 1 ? '1 cuenta' : `${row.membersCount} cuentas`}
                    </Text>
                  </View>
                  {pendingId === row.id ? (
                    <ActivityIndicator color={colors.primary} />
                  ) : (
                    <Ionicons
                      name={row.hasAccount ? 'checkmark-circle' : 'ellipse-outline'}
                      size={22}
                      color={row.hasAccount ? colors.primary : colors.muted}
                    />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          )}

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
            <Pressable
              onPress={create}
              disabled={creating || !newName.trim()}
              accessibilityRole="button"
              accessibilityLabel="Crear lista"
              accessibilityState={{ disabled: creating || !newName.trim() }}
            >
              <Text style={[styles.action, !newName.trim() && styles.actionDisabled]}>
                {creating ? 'Creando…' : 'Crear'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={onClose} accessibilityRole="button" style={styles.done}>
            <Text style={styles.action}>Listo</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'rgba(0,0,0,0.45)',
      padding: 24,
    },
    dialog: {
      width: '100%',
      maxWidth: 420,
      maxHeight: '80%',
      borderRadius: 16,
      padding: 20,
      gap: 12,
      backgroundColor: colors.field,
    },
    title: { fontSize: 17, fontWeight: '700', color: colors.text },
    lists: { flexGrow: 0 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 10,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.divider,
    },
    rowText: { flexShrink: 1, paddingRight: 12 },
    name: { fontSize: 15, fontWeight: '600', color: colors.text },
    hint: { fontSize: 13, color: colors.muted },
    error: { fontSize: 13, color: colors.danger },
    newList: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 10,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: colors.text,
    },
    action: { fontSize: 15, fontWeight: '700', color: colors.primary },
    actionDisabled: { color: colors.placeholder },
    done: { alignSelf: 'flex-end' },
  });
