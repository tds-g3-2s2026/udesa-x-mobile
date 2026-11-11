import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { SuggestedAccount } from '../../../types/post';
import { Avatar } from './Avatar';
import { FollowButton } from './FollowButton';

// One account suggested to follow, with its button: a single tap follows it,
// or asks to when the account is protected. Shared by the empty feed and the
// onboarding.
export function SuggestedAccountRow({ account }: { account: SuggestedAccount }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.row}>
      <Avatar url={account.avatarUrl} size={40} />
      <View style={styles.text}>
        <Text style={styles.name}>{account.displayName || account.handle}</Text>
        <Text style={styles.meta}>
          {account.handle} · {account.followersCount} seguidores
        </Text>
      </View>
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
