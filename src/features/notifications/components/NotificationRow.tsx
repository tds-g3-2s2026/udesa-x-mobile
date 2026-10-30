import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { formatRelativeTime } from '../../posts/relativeTime';
import { describeNotification } from '../notificationContent';
import { AppNotification } from '../types';

interface NotificationRowProps {
  item: AppNotification;
  // Absent when the notification has nowhere to lead (a kind the app does not
  // know, or a post id that did not come).
  onOpen?: () => void;
  onDelete: () => void;
}

// An unread notification is told apart three ways at once: a tinted
// background, a dot and bold text. The screen reader gets it too, at the start
// of the label, since none of the visual cues reach it.
export function NotificationRow({ item, onOpen, onDelete }: NotificationRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const unread = item.readAt === null;
  const { text, icon } = describeNotification(item);

  return (
    <View style={[styles.row, unread && styles.unreadRow]} testID={`notification-${item.id}`}>
      <Pressable
        style={styles.body}
        onPress={onOpen}
        disabled={!onOpen}
        accessibilityRole={onOpen ? 'button' : undefined}
        accessibilityLabel={unread ? `No leída. ${text}` : text}
      >
        <View style={[styles.dot, unread && styles.unreadDot]} testID="notification-dot" />
        <Ionicons name={icon} size={20} color={colors.primary} />
        <View style={styles.texts}>
          <Text style={[styles.text, unread && styles.unreadText]}>{text}</Text>
          <Text style={styles.time}>{formatRelativeTime(item.createdAt)}</Text>
        </View>
      </Pressable>
      <Pressable
        style={styles.delete}
        onPress={onDelete}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Borrar notificación"
      >
        <Ionicons name="trash-outline" size={18} color={colors.muted} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderBottomWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.surface,
    },
    unreadRow: {
      backgroundColor: colors.primarySoft,
    },
    body: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    // Takes its space even when read, so the icons of read and unread rows
    // line up in one column.
    dot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    unreadDot: {
      backgroundColor: colors.primary,
    },
    texts: {
      flex: 1,
      gap: 2,
    },
    text: {
      fontSize: 15,
      color: colors.text,
    },
    unreadText: {
      fontWeight: '700',
    },
    time: {
      fontSize: 13,
      color: colors.muted,
    },
    delete: {
      padding: 6,
      marginLeft: 8,
    },
  });
}
