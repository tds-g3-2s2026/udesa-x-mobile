import { useMemo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Galeria } from '@nandorojo/galeria';
import { Image, StyleSheet, View } from 'react-native';
import { useThemeColors } from '../../../theme/useThemeColors';
import { Colors } from '../../../theme/colors';
import { PostImage } from '../../../types/post';

interface PostImageGridProps {
  images: PostImage[];
}

// A signed URL can stop working (it expires, or the server loses access to the
// bucket), so a cell whose image fails to load shows a placeholder in its place
// instead of an empty box.
function GridImage({ image, label }: { image: PostImage; label: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <View style={[styles.image, styles.placeholder]} testID="post-image-unavailable">
        <Ionicons name="image-outline" size={28} color={colors.muted} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri: image.url }}
      style={styles.image}
      resizeMode="cover"
      accessibilityLabel={label}
      onError={() => setFailed(true)}
    />
  );
}

// One image takes the full width, two split it in halves and three or four form
// a 2x2 grid. With three the fourth cell stays empty rather than stretching the
// third across the row.
//
// Galeria wraps the grid and is what opens the full-screen viewer, with pinch
// and double-tap zoom and swiping between the post's images: each cell tells it
// which of `urls` it is, so the viewer opens on the one that was tapped.
export function PostImageGrid({ images }: PostImageGridProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (images.length === 0) return null;

  const ordered = [...images].sort((a, b) => a.position - b.position);
  const cellStyle = ordered.length === 1 ? styles.cellFull : styles.cellHalf;

  return (
    <Galeria urls={ordered.map((image) => image.url)}>
      <View style={styles.grid} testID="post-image-grid">
        {ordered.map((image, index) => (
          <View key={image.id} style={[styles.cell, cellStyle]} testID={`post-image-${index}`}>
            <Galeria.Image index={index}>
              <GridImage image={image} label={`Imagen ${index + 1} de ${ordered.length}`} />
            </Galeria.Image>
          </View>
        ))}
      </View>
    </Galeria>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      // The cells carry a 2 px padding that makes the gap between images; this
      // takes it back at the edges so the grid lines up with the text above.
      margin: -2,
      marginBottom: 8,
    },
    cell: {
      padding: 2,
    },
    cellFull: {
      width: '100%',
      aspectRatio: 16 / 9,
    },
    cellHalf: {
      width: '50%',
      aspectRatio: 1,
    },
    image: {
      width: '100%',
      height: '100%',
      borderRadius: 10,
      backgroundColor: colors.field,
    },
    placeholder: {
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
