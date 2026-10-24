import { useEffect, useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import * as ImagePicker from 'expo-image-picker';
import { Alert, Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { postService, getAuthErrorMessage } from '../../src/features/posts/services/postService';
import { ApiError } from '../../src/api/apiClient';
import {
  acceptPickedImages,
  MAX_POST_IMAGES,
  PickedImage,
  RejectedReason,
} from '../../src/features/posts/postImages';
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

const REJECTION_TEXT: Record<RejectedReason, string> = {
  format: 'no es JPG ni PNG',
  size: 'pesa más de 1 MB',
};

function rejectionMessage(rejected: { name: string; reason: RejectedReason }[]): string {
  return rejected.map((image) => `${image.name} ${REJECTION_TEXT[image.reason]}.`).join('\n');
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
  const [images, setImages] = useState<PickedImage[]>([]);

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
  // A post may be only images: the text is blank-checked only when there is
  // nothing else to publish.
  const isBlank = content.trim().length === 0 && images.length === 0;
  const isTooLong = content.length > MAX_LENGTH;

  const handlePickImages = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        selectionLimit: MAX_POST_IMAGES - images.length,
        // Quality 1 sends the file as it is: any other value would re-encode it
        // behind the user's back, which is the compression the 1 MB rule is
        // meant to leave to them.
        quality: 1,
      });
      if (result.canceled) return;

      const { accepted, rejected } = acceptPickedImages(result.assets, images.length);
      setImages((current) => [...current, ...accepted]);
      if (rejected.length > 0) {
        Alert.alert('Algunas imágenes no se agregaron', rejectionMessage(rejected));
      }
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería. Intentalo de nuevo.');
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages((current) => current.filter((_, position) => position !== index));
  };

  const handlePublish = async () => {
    if (isSubmitting || parentDeleted) return;
    setIsSubmitting(true);
    try {
      if (parentId) await postService.createReply(parentId, content);
      else await postService.createPost(content, images);
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
      {/* Replies are text only: posts-api takes images on a new post alone. */}
      {!isReply ? (
        <View style={styles.attachments}>
          <TouchableOpacity
            style={styles.addImages}
            onPress={handlePickImages}
            disabled={isSubmitting || images.length >= MAX_POST_IMAGES}
            accessibilityRole="button"
            accessibilityLabel="Agregar imágenes"
            accessibilityState={{ disabled: isSubmitting || images.length >= MAX_POST_IMAGES }}
          >
            <Ionicons name="image-outline" size={20} color={colors.primary} />
            <Text style={styles.addImagesLabel}>
              Imágenes {images.length}/{MAX_POST_IMAGES}
            </Text>
          </TouchableOpacity>
          <View style={styles.thumbnails}>
            {images.map((image, index) => (
              <View key={image.uri} style={styles.thumbnail}>
                <Image source={{ uri: image.uri }} style={styles.thumbnailImage} />
                <TouchableOpacity
                  style={styles.removeImage}
                  onPress={() => handleRemoveImage(index)}
                  disabled={isSubmitting}
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar imagen ${index + 1}`}
                >
                  <Ionicons name="close" size={14} color={colors.surface} />
                </TouchableOpacity>
              </View>
            ))}
          </View>
        </View>
      ) : null}
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
    attachments: {
      gap: 12,
    },
    addImages: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      alignSelf: 'flex-start',
      paddingVertical: 8,
    },
    addImagesLabel: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
    },
    thumbnails: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
    },
    thumbnail: {
      width: 72,
      height: 72,
    },
    thumbnailImage: {
      width: 72,
      height: 72,
      borderRadius: 10,
      backgroundColor: colors.field,
    },
    removeImage: {
      position: 'absolute',
      top: -6,
      right: -6,
      width: 22,
      height: 22,
      borderRadius: 11,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.text,
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
