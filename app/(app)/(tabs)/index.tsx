import { useMemo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import {
  AppScreen,
  EmptyState,
  useSearchFieldStyles,
} from '../../../src/features/shell/components/AppScreen';
import { useFeedStore } from '../../../src/stores/feedStore';
import { useAuthStore } from '../../../src/stores/authStore';

// The home tab. A real feed endpoint with pagination is not built yet on
// either side, so this only shows what this device published this session
// (see feedStore.ts), instead of pretending to be the real feed.
export default function FeedScreen() {
  const router = useRouter();
  const colors = useThemeColors();
  const searchFieldStyles = useSearchFieldStyles();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const posts = useFeedStore((state) => state.posts);
  const user = useAuthStore((state) => state.user);

  return (
    <AppScreen title="UdeSA-X" brand>
      <TouchableOpacity
        style={searchFieldStyles.field}
        onPress={() => router.navigate('/search')}
        accessibilityRole="button"
        accessibilityLabel="Buscar en UdeSA-X"
      >
        <Ionicons name="search-outline" size={18} color={colors.placeholder} />
        <Text style={searchFieldStyles.placeholder}>Buscar en UdeSA-X</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.composeField}
        onPress={() => router.push('/compose')}
        accessibilityRole="button"
        accessibilityLabel="Escribir un post nuevo"
      >
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
        <Text style={styles.composePlaceholder}>¿Qué está pasando?</Text>
      </TouchableOpacity>

      {posts.length === 0 ? (
        <EmptyState
          icon="newspaper-outline"
          title="Todavía no hay publicaciones"
          text="Escribí la primera desde el botón de arriba."
        />
      ) : (
        posts.map((post) => (
          <View key={post.id} style={styles.postCard}>
            <Text style={styles.postAuthor}>{user?.displayName || user?.handle}</Text>
            <Text style={styles.postContent}>{post.content}</Text>
          </View>
        ))
      )}
    </AppScreen>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    composeField: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      height: 44,
      paddingHorizontal: 14,
      borderRadius: 22,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.field,
      marginBottom: 16,
    },
    composePlaceholder: {
      flex: 1,
      fontSize: 15,
      color: colors.primary,
      fontWeight: '600',
    },
    postCard: {
      padding: 16,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.divider,
      backgroundColor: colors.field,
      marginBottom: 10,
    },
    postAuthor: {
      fontSize: 14,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 4,
    },
    postContent: {
      fontSize: 15,
      color: colors.text,
      lineHeight: 21,
    },
  });
}
