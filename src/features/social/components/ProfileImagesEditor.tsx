import { useEffect, useMemo, useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { getAuthErrorMessage } from '../../../api/apiClient';
import { checkPickedImage } from '../../posts/postImages';
import { profileService } from '../services/profileService';
import {
  PROFILE_IMAGE_MAX_BYTES,
  ProfileImageKind,
  profileImageService,
} from '../services/profileImageService';
import { ProfileBanner } from './ProfileBanner';

const LABELS: Record<ProfileImageKind, { change: string; remove: string; size: string }> = {
  avatar: {
    change: 'Cambiar foto',
    remove: 'Eliminar foto actual',
    size: 'La foto puede pesar hasta 5 MB.',
  },
  cover: {
    change: 'Cambiar portada',
    remove: 'Eliminar portada',
    size: 'La portada puede pesar hasta 10 MB.',
  },
};

type Urls = Record<ProfileImageKind, string | null>;

// The photo and the cover of Editar perfil. Unlike the name and the bio they
// do not wait for "Guardar cambios": each change goes to posts-api the moment
// it is made, and the preview shows what the server kept.
export function ProfileImagesEditor({ userId }: { userId: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [urls, setUrls] = useState<Urls>({ avatar: null, cover: null });
  // One change at a time: a second one while the first is on its way could
  // land in either order.
  const [busy, setBusy] = useState<ProfileImageKind | null>(null);

  // A failed read leaves the defaults: the photo can still be changed, and
  // the rest of the screen does not depend on it.
  useEffect(() => {
    let cancelled = false;
    profileService
      .getProfile(userId)
      .then((profile) => {
        if (!cancelled) setUrls({ avatar: profile.avatarUrl, cover: profile.coverUrl });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const change = async (kind: ProfileImageKind) => {
    let result: ImagePicker.ImagePickerResult;
    try {
      // Quality 1 sends the file as it is, the same as a post's images: the
      // size limit is left to the user, not met by re-encoding behind them.
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
    } catch {
      Alert.alert('Error', 'No se pudo abrir la galería. Intentalo de nuevo.');
      return;
    }
    if (result.canceled) return;

    const checked = checkPickedImage(result.assets[0], PROFILE_IMAGE_MAX_BYTES[kind]);
    if (!('image' in checked)) {
      Alert.alert(
        'No se pudo usar la imagen',
        checked.reason === 'format' ? 'Elegí una imagen JPG o PNG.' : LABELS[kind].size
      );
      return;
    }

    setBusy(kind);
    try {
      const url = await profileImageService.upload(kind, checked.image);
      setUrls((current) => ({ ...current, [kind]: url }));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const remove = async (kind: ProfileImageKind) => {
    setBusy(kind);
    try {
      await profileImageService.remove(kind);
      setUrls((current) => ({ ...current, [kind]: null }));
    } catch (error) {
      Alert.alert('Error', getAuthErrorMessage(error));
    } finally {
      setBusy(null);
    }
  };

  const actions = (kind: ProfileImageKind) => (
    <View style={styles.actions}>
      <Pressable
        onPress={() => void change(kind)}
        disabled={busy !== null}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy !== null }}
      >
        <Text style={styles.link}>{LABELS[kind].change}</Text>
      </Pressable>
      {/* Only with an image to remove: without one the default already shows. */}
      {urls[kind] ? (
        <Pressable
          onPress={() => void remove(kind)}
          disabled={busy !== null}
          accessibilityRole="button"
          accessibilityState={{ disabled: busy !== null }}
        >
          <Text style={styles.danger}>{LABELS[kind].remove}</Text>
        </Pressable>
      ) : null}
      {busy === kind ? (
        <ActivityIndicator
          accessibilityLabel={kind === 'avatar' ? 'Guardando la foto' : 'Guardando la portada'}
          color={colors.primary}
        />
      ) : null}
    </View>
  );

  return (
    <View style={styles.section}>
      <ProfileBanner avatarUrl={urls.avatar} coverUrl={urls.cover} />
      {actions('avatar')}
      {actions('cover')}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    section: {
      gap: 8,
      marginBottom: 16,
    },
    actions: {
      flexDirection: 'row',
      alignItems: 'center',
      flexWrap: 'wrap',
      columnGap: 16,
    },
    link: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.primary,
      paddingVertical: 6,
    },
    danger: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.danger,
      paddingVertical: 6,
    },
  });
}
