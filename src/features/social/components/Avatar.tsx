import { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Image, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';

interface AvatarProps {
  // Null when the account has no photo: a new one, one that removed it, or a
  // deleted account.
  url: string | null | undefined;
  size: number;
}

// The account's profile photo, or the default avatar when there is none. The
// URL is signed and can stop working (it expires, or the server loses access
// to the bucket), so a photo that fails to load falls back to the default
// too. The failure is kept per URL: a fresh one from the next read is tried.
export function Avatar({ url, size }: AvatarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const shape = { width: size, height: size, borderRadius: size / 2 };

  if (!url || url === failedUrl) {
    return (
      <View style={[styles.fallback, shape]} testID="default-avatar">
        <Ionicons name="person" size={size / 2} color={colors.primary} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: url }}
      style={[styles.photo, shape]}
      resizeMode="cover"
      accessibilityLabel="Foto de perfil"
      onError={() => setFailedUrl(url)}
    />
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    fallback: {
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primarySoft,
    },
    photo: {
      backgroundColor: colors.primarySoft,
    },
  });
}
