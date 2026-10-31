import { useMemo, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { Avatar } from './Avatar';

interface ProfileBannerProps {
  avatarUrl: string | null | undefined;
  coverUrl: string | null | undefined;
  // Where the photo sits under the cover: aligned with the text of another
  // account's profile, or centered on the Perfil tab's card.
  align?: 'start' | 'center';
}

// The top of a profile: the cover across the width, and the photo overlapping
// its bottom edge. Without a cover, or with one that fails to load, a plain
// band stands in, so the layout is the same either way.
export function ProfileBanner({ avatarUrl, coverUrl, align = 'start' }: ProfileBannerProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  return (
    <View>
      {coverUrl && coverUrl !== failedUrl ? (
        <Image
          source={{ uri: coverUrl }}
          style={styles.cover}
          resizeMode="cover"
          accessibilityLabel="Portada"
          onError={() => setFailedUrl(coverUrl)}
        />
      ) : (
        <View style={styles.cover} testID="default-cover" />
      )}
      <View style={[styles.ring, align === 'center' ? styles.centered : styles.start]}>
        <Avatar url={avatarUrl} size={72} />
      </View>
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    cover: {
      height: 96,
      borderRadius: 16,
      backgroundColor: colors.primarySoft,
    },
    // A border the color of the screen separates the photo from the cover.
    ring: {
      marginTop: -39,
      padding: 3,
      borderRadius: 39,
      backgroundColor: colors.surface,
    },
    start: {
      alignSelf: 'flex-start',
      marginLeft: 16,
    },
    centered: {
      alignSelf: 'center',
    },
  });
}
