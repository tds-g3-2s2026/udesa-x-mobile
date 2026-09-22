import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { AuthScreen } from '../../src/features/auth/components/AuthScreen';
import { FormInput } from '../../src/features/auth/components/FormInput';
import { useAuthStyles } from '../../src/features/auth/components/authTheme';
import { postService, getAuthErrorMessage } from '../../src/features/posts/services/postService';
import { useFeedStore } from '../../src/stores/feedStore';
import { useThemeColors } from '../../src/theme/useThemeColors';
import { Colors } from '../../src/theme/colors';

const MAX_LENGTH = 280;

export default function ComposeScreen() {
  const router = useRouter();
  const authStyles = useAuthStyles();
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const addPost = useFeedStore((state) => state.addPost);

  const [content, setContent] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Client-side rules mirror the server's: letting the user type past the
  // limit or submit a blank post just to have the API reject it is a worse
  // screen than disabling the button before that round trip happens.
  const isBlank = content.trim().length === 0;
  const isTooLong = content.length > MAX_LENGTH;

  const handlePublish = async () => {
    setIsSubmitting(true);
    try {
      const post = await postService.createPost(content);
      // No real feed endpoint to re-fetch from yet: this is the local
      // stand-in that shows what was just published.
      addPost(post);
      router.back();
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreen
      header={<Text style={authStyles.title}>Nuevo post</Text>}
      submitLabel="Publicar"
      onSubmit={handlePublish}
      isSubmitting={isSubmitting}
      disabled={isBlank || isTooLong}
      footer={
        <Text style={authStyles.footerLink} onPress={() => router.back()}>
          Cancelar
        </Text>
      }
    >
      <FormInput
        label="¿Qué está pasando?"
        placeholder="Escribí algo para compartir"
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
