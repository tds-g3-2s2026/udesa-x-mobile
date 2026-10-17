import { useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { postService, getAuthErrorMessage } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import { PostDetail } from '../../src/types/post';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

const MAX_LENGTH = 280;

// The same 404 covers a post that is gone, one by a blocked account and one
// from a protected account the caller does not follow. Saying which would
// tell the caller who blocked them, so the message never does.
function replyErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'post-not-found') {
    return 'No podés responder a esta publicación.';
  }
  return getAuthErrorMessage(error);
}

export default function ComposeScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const { parentId } = useLocalSearchParams<{ parentId?: string }>();
  const isReply = Boolean(parentId);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [parentDeleted, setParentDeleted] = useState(false);
  const [parent, setParent] = useState<PostDetail | null>(null);

  // Read from posts-api instead of handed over by the screen that opened this
  // one: what is quoted is then what the server will accept a reply to.
  useEffect(() => {
    if (!parentId) return;
    let isCurrent = true;
    postService
      .getPost(parentId)
      .then((post) => {
        if (isCurrent) {
          setParent(post);
          setParentDeleted(post.deleted);
        }
      })
      .catch((error) => {
        if (!isCurrent) return;
        Alert.alert('Error', replyErrorMessage(error));
        router.back();
      });
    return () => {
      isCurrent = false;
    };
  }, [parentId, router]);

  // Client-side rules mirror the server's: letting the user type past the
  // limit or submit a blank post just to have the API reject it is a worse
  // screen than disabling the button before that round trip happens.
  const isBlank = content.trim().length === 0;
  const isTooLong = content.length > MAX_LENGTH;

  const handlePublish = async () => {
    if (isSubmitting || parentDeleted) return;
    setIsSubmitting(true);
    try {
      if (parentId) await postService.createReply(parentId, content);
      else await postService.createPost(content);
      // Nothing to hand back to the screen underneath: it reloads on its own
      // the moment it regains focus, and that fresh GET already has this post.
      router.back();
    } catch (error) {
      if (error instanceof ApiError && error.code === 'post-deleted') setParentDeleted(true);
      else Alert.alert('Error', isReply ? replyErrorMessage(error) : getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      header={<Text style={authStyles.title}>{isReply ? 'Nueva respuesta' : 'Nuevo post'}</Text>}
      submitLabel={isReply ? 'Responder' : 'Publicar'}
      onSubmit={handlePublish}
      isSubmitting={isSubmitting}
      disabled={isBlank || isTooLong || parentDeleted || (isReply && parent === null)}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      {parentDeleted ? <Text>Esta publicación fue eliminada.</Text> : null}
      {parent && !parentDeleted ? (
        <View style={styles.quote}>
          <Text style={styles.quoteLabel}>Respondiendo a {parent.authorHandle}</Text>
          <Text style={styles.quoteContent}>{parent.content}</Text>
        </View>
      ) : null}
      <FormInput
        label={isReply ? 'Tu respuesta' : '¿Qué está pasando?'}
        placeholder={isReply ? 'Escribí tu respuesta' : 'Escribí algo para compartir'}
        multiline
        numberOfLines={5}
        autoFocus
        value={content}
        onChangeText={setContent}
      />
      <Text style={[styles.counter, isTooLong && styles.counterOver]}>
        {content.length}/{MAX_LENGTH}
      </Text>
    </AuthScreen>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    quote: {
      padding: 12,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      gap: 4,
    },
    quoteLabel: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.primary,
    },
    quoteContent: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 20,
    },
    counter: {
      alignSelf: 'flex-end',
      marginTop: -8,
      fontSize: 13,
      color: colors.muted,
    },
    counterOver: {
      color: colors.danger,
      fontWeight: '700',
    },
  });
}
