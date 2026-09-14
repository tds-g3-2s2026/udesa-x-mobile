import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { ApiError } from '../../../api/apiClient';
import { followService, getAuthErrorMessage } from '../services/followService';
import { FollowState } from '../../../types/social';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

// A protected account's owner has not approved anything yet, so this is not
// really "pending" from the server's point of view: today it is just a
// follow the API refuses outright.
const NEEDS_APPROVAL_CODE = 'follow-needs-approval';

interface FollowButtonProps {
  targetUserId: string;
  initialState: FollowState;
  // Lets the screen holding this button keep its own copy of the relationship
  // in sync (e.g. a follower/following count), without this component having
  // to know anything about where it is used.
  onStateChange?: (state: FollowState) => void;
}

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
        await followService.follow(targetUserId);
        setState('following');
        onStateChange?.('following');
      } else {
        await followService.unfollow(targetUserId);
        setState('none');
        onStateChange?.('none');
      }
    } catch (error) {
      if (error instanceof ApiError && error.code === NEEDS_APPROVAL_CODE) {
        Alert.alert(
          'Cuenta protegida',
          'Esta cuenta es protegida y todavía no se pueden enviar solicitudes para seguirla.'
        );
      } else {
        Alert.alert('Error', getAuthErrorMessage(error));
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const isFollowing = state === 'following';

  return (
    <TouchableOpacity
      style={[styles.button, isFollowing && styles.buttonFollowing]}
      onPress={handlePress}
      disabled={isSubmitting}
      accessibilityRole="button"
      accessibilityLabel={isFollowing ? 'Dejar de seguir' : 'Seguir'}
    >
      {isSubmitting ? (
        <ActivityIndicator color={isFollowing ? colors.primary : colors.onPrimary} size="small" />
      ) : (
        <Text style={[styles.label, isFollowing && styles.labelFollowing]}>
          {isFollowing ? 'Siguiendo' : 'Seguir'}
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
