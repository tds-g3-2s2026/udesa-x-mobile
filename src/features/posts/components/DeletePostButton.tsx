import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useThemeColors } from '../../../theme/useThemeColors';

export function DeletePostButton({
  onConfirm,
  disabled,
}: {
  onConfirm: () => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colors = useThemeColors();
  return (
    <>
      <Pressable
        onPress={(event) => {
          event.stopPropagation();
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel="Eliminar publicación"
        accessibilityState={{ disabled }}
      >
        <Ionicons name="trash-outline" size={18} color={colors.danger} />
      </Pressable>
      <Modal transparent visible={open} onRequestClose={() => setOpen(false)} animationType="fade">
        <View style={styles.backdrop}>
          <View accessibilityViewIsModal style={[styles.dialog, { backgroundColor: colors.field }]}>
            <Text style={[styles.title, { color: colors.text }]}>¿Eliminar publicación?</Text>
            <Text style={{ color: colors.text }}>Esta acción no se puede deshacer.</Text>
            <View style={styles.actions}>
              <Pressable
                accessibilityRole="button"
                onPress={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                }}
              >
                <Text style={[styles.action, { color: colors.text }]}>Cancelar</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                disabled={disabled}
                onPress={(event) => {
                  event.stopPropagation();
                  setOpen(false);
                  if (!disabled) onConfirm();
                }}
              >
                <Text style={[styles.action, { color: colors.danger }]}>Eliminar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
    padding: 24,
  },
  dialog: { width: '100%', maxWidth: 360, padding: 24, borderRadius: 16, gap: 16 },
  title: { fontSize: 18, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 24 },
  action: { paddingVertical: 10, fontWeight: '700' },
});
