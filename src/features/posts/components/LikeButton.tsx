import { useEffect, useMemo, useRef, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { getAuthErrorMessage, postService } from '../services/postService';

interface LikeButtonProps {
  postId: string;
  liked: boolean;
  count: number;
}

export function LikeButton({ postId, liked, count }: LikeButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [isLiked, setIsLiked] = useState(liked);
  const [likes, setLikes] = useState(count);
  // A ref and not state: a second tap can land before React re-renders, and it
  // has to see that a call is already on its way.
  const isPending = useRef(false);

  // The list reloads (focus, pull to refresh) and hands down what the server
  // now says, which wins over whatever this button remembered.
  useEffect(() => {
    setIsLiked(liked);
    setLikes(count);
  }, [liked, count]);

  const toggle = async () => {
    if (isPending.current) return;
    isPending.current = true;

    const wasLiked = isLiked;
    // Optimistic: the heart and the counter move before the server answers.
    setIsLiked(!wasLiked);
    setLikes((current) => Math.max(0, current + (wasLiked ? -1 : 1)));
    try {
      if (wasLiked) await postService.unlikePost(postId);
      else await postService.likePost(postId);
    } catch (error) {
      setIsLiked(wasLiked);
      setLikes((current) => Math.max(0, current + (wasLiked ? 1 : -1)));
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      isPending.current = false;
    }
  };

  return (
    <TouchableOpacity
      style={styles.button}
      onPress={toggle}
      accessibilityRole="button"
      accessibilityLabel={isLiked ? 'Quitar me gusta' : 'Dar me gusta'}
      accessibilityState={{ selected: isLiked }}
    >
      <Ionicons
        name={isLiked ? 'heart' : 'heart-outline'}
        size={16}
        color={isLiked ? colors.danger : colors.muted}
      />
      <Text style={[styles.label, isLiked && styles.labelLiked]}>{likes}</Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    label: {
      fontSize: 13,
      color: colors.muted,
    },
    labelLiked: {
      color: colors.danger,
    },
  });
}
