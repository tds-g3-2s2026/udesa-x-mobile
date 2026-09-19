import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { followService, getAuthErrorMessage } from '../services/followService';
import { FollowState } from '../../../types/social';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

interface FollowButtonProps {
  targetUserId: string;
  initialState: FollowState;
  // Lets the screen holding this button keep its own copy of the relationship
  // in sync (e.g. a follower/following count), without this component having
  // to know anything about where it is used.
  onStateChange?: (state: FollowState) => void;
}

const LABELS: Record<FollowState, string> = {
  none: 'Seguir',
  following: 'Siguiendo',
  pending: 'Solicitado',
};

/**
 * Follow/unfollow toggle for another account. No screen mounts it yet: it has
 * nowhere to live until the profile screen for another user's account is
 * built, but the button itself only needs the target's id and the caller's
 * current relationship to it, both of which that screen will have to know
 * regardless of who renders the button.
 */
export function FollowButton({ targetUserId, initialState, onStateChange }: FollowButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [state, setState] = useState<FollowState>(initialState);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePress = async () => {
    setIsSubmitting(true);
    try {
      if (state === 'none') {
        // The answer decides the new state: following a protected account
        // leaves it waiting, and the button has to say so instead of
        // claiming success.
        const reached = await followService.follow(targetUserId);
        setState(reached);
        onStateChange?.(reached);
      } else {
        await followService.unfollow(targetUserId);
        setState('none');
        onStateChange?.('none');
      }
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFollowing = state === 'following';
  // Cancelling a request that is already sent is not possible yet: it arrives
  // with the piece of E3-H2 that makes unfollowing cancel a pending request.
  // Until then the button says what happened and waits.
  const isPending = state === 'pending';

  return (
    <TouchableOpacity
      style={[styles.button, (isFollowing || isPending) && styles.buttonFollowing]}
      onPress={handlePress}
      disabled={isSubmitting || isPending}
      accessibilityRole="button"
      accessibilityLabel={LABELS[state]}
    >
      {isSubmitting ? (
        <ActivityIndicator color={isFollowing ? colors.primary : colors.onPrimary} size="small" />
      ) : (
        <Text style={[styles.label, (isFollowing || isPending) && styles.labelFollowing]}>
          {LABELS[state]}
        </Text>
      )}
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    button: {
      height: 36,
      paddingHorizontal: 20,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
    },
    buttonFollowing: {
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    label: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.onPrimary,
    },
    labelFollowing: {
      color: colors.primary,
    },
  });
}
