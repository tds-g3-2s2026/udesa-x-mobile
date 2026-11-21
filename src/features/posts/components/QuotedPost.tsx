import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { FeedItem } from '../../../types/post';
import { postService } from '../services/postService';
import { DELETED_AUTHOR_LABEL } from '../labels';

export const DELETED_ORIGINAL_LABEL = '[Post original eliminado]';
export const UNAVAILABLE_ORIGINAL_LABEL = 'Post no disponible';

type Original =
  | { kind: 'loading' }
  | { kind: 'ready'; post: FeedItem }
  | { kind: 'deleted' }
  | { kind: 'unavailable' };

// The post a quote carries inside. It is read like opening it by hand: a post
// the reader cannot see answers 404, the same as one that does not exist, and
// shows as unavailable. One level only: the original never shows what it quotes.
export function QuotedPost({ postId }: { postId: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const router = useRouter();
  const [original, setOriginal] = useState<Original>({ kind: 'loading' });

  useEffect(() => {
    let current = true;
    setOriginal({ kind: 'loading' });
    postService
      .getPost(postId)
      .then((post) => {
        if (current) setOriginal(post.deleted ? { kind: 'deleted' } : { kind: 'ready', post });
      })
      .catch(() => {
        if (current) setOriginal({ kind: 'unavailable' });
      });
    return () => {
      current = false;
    };
  }, [postId]);

  if (original.kind === 'loading') {
    return (
      <View style={styles.box} testID="quoted-post">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (original.kind !== 'ready') {
    return (
      <View style={styles.box} testID="quoted-post">
        <Text style={styles.missing}>
          {original.kind === 'deleted' ? DELETED_ORIGINAL_LABEL : UNAVAILABLE_ORIGINAL_LABEL}
        </Text>
      </View>
    );
  }

  const { post } = original;
  const author = post.authorDeleted
    ? DELETED_AUTHOR_LABEL
    : post.authorDisplayName || post.authorHandle;
  return (
    <TouchableOpacity
      style={styles.box}
      onPress={() => router.push({ pathname: '/post/[id]', params: { id: post.id } })}
      accessibilityRole="button"
      accessibilityLabel={`Abrir el post citado de ${post.authorHandle ?? 'esta cuenta'}`}
      testID="quoted-post"
    >
      <Text style={styles.author}>{author}</Text>
      <Text style={styles.content} numberOfLines={4}>
        {post.content ?? ''}
      </Text>
    </TouchableOpacity>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    box: {
      gap: 4,
      padding: 12,
      marginBottom: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    author: { fontSize: 13, fontWeight: '700', color: colors.text },
    content: { fontSize: 14, color: colors.text, lineHeight: 19 },
    missing: { fontSize: 14, fontStyle: 'italic', color: colors.muted },
  });
}
