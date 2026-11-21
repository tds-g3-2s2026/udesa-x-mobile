import { useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { MIN_TOUCH_TARGET } from '../../../theme/touchTarget';
import { SuggestedAccount } from '../../../types/post';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';

interface SuggestedAccountRowProps {
  account: SuggestedAccount;
  // Opens the account's profile from its photo and name. Left out during the
  // onboarding: that account has not reached the app's screens yet.
  onOpen?: () => void;
}

// One account suggested to follow, with its button: a single tap follows it,
// or asks to when the account is protected. Shared by the empty feed and the
// onboarding.
export function SuggestedAccountRow({ account, onOpen }: SuggestedAccountRowProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const details = (
    <>
      <Avatar url={account.avatarUrl} size={40} />
      <View style={styles.text}>
        <Text style={styles.name}>{account.displayName || account.handle}</Text>
        <Text style={styles.meta}>
          {account.handle} · {account.followersCount} seguidores
        </Text>
      </View>
    </>
  );

  return (
    <View style={styles.row}>
      {onOpen ? (
        <TouchableOpacity
          style={styles.account}
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={`Abrir perfil de ${account.handle ?? 'esta cuenta'}`}
        >
          {details}
        </TouchableOpacity>
      ) : (
        <View style={styles.account}>{details}</View>
      )}
      <FollowButton targetUserId={account.id} initialState="none" />
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
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
    account: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      minHeight: MIN_TOUCH_TARGET,
    },
    text: {
      flex: 1,
    },
    name: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.text,
    },
    meta: {
      fontSize: 13,
      color: colors.muted,
    },
  });
}
