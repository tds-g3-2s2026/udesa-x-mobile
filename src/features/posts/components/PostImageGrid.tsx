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

// How wide a single image may be drawn against its height. Inside this range it
// shows whole, at its own shape, as on X: from a 2:1 landscape to a 3:4
// portrait. Past it, it is centered and cropped, so one very tall photo
// cannot fill the whole screen of the feed.
export const WIDEST_RATIO = 2;
export const TALLEST_RATIO = 3 / 4;
// Until the image arrives its size is unknown: the cell waits at 16:9, the
// shape of most phone screenshots and landscape photos.
const UNKNOWN_RATIO = 16 / 9;

export function singleImageRatio(width: number, height: number): number {
  if (width <= 0 || height <= 0) return UNKNOWN_RATIO;
  return Math.min(WIDEST_RATIO, Math.max(TALLEST_RATIO, width / height));
}

interface GridImageProps {
  image: PostImage;
  label: string;
  // Told the real size once the image loads, to fit the cell to it.
  onSize?: (width: number, height: number) => void;
}

// A signed URL can stop working (it expires, or the server loses access to the
// bucket), so a cell whose image fails to load shows a placeholder in its place
// instead of an empty box.
function GridImage({ image, label, onSize }: GridImageProps) {
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
      onLoad={(event) => onSize?.(event.nativeEvent.source.width, event.nativeEvent.source.height)}
      onError={() => setFailed(true)}
    />
  );
}

// One image takes the full width at its own shape, within the limits above.
// Two split the width in square halves and three or four form a 2x2 grid of
// squares, cropped like X does: their shapes rarely match each other. With
// three the fourth cell stays empty rather than stretching the third across
// the row.
//
// Galeria wraps the grid and is what opens the full-screen viewer, with pinch
// and double-tap zoom and swiping between the post's images: each cell tells it
// which of `urls` it is, so the viewer opens on the one that was tapped.
export function PostImageGrid({ images }: PostImageGridProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [singleRatio, setSingleRatio] = useState(UNKNOWN_RATIO);

  if (images.length === 0) return null;

  const ordered = [...images].sort((a, b) => a.position - b.position);
  const single = ordered.length === 1;
  const cellStyle = single ? [styles.cellFull, { aspectRatio: singleRatio }] : styles.cellHalf;

  return (
    <Galeria urls={ordered.map((image) => image.url)}>
      <View style={styles.grid} testID="post-image-grid">
        {ordered.map((image, index) => (
          <View key={image.id} style={[styles.cell, cellStyle]} testID={`post-image-${index}`}>
            <Galeria.Image index={index}>
              <GridImage
                image={image}
                label={`Imagen ${index + 1} de ${ordered.length}`}
                onSize={
                  single
                    ? (width, height) => setSingleRatio(singleImageRatio(width, height))
                    : undefined
                }
              />
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
