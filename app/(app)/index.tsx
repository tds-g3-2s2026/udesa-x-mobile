import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { Text, TouchableOpacity } from 'react-native';
import { colors } from '../../src/features/auth/components/authTheme';
import {
  AppScreen,
  EmptyState,
  searchFieldStyles,
} from '../../src/features/shell/components/AppScreen';

// T-51: the Inicio tab. The feed itself arrives with the publication epic, so the
// screen shows the shortcut to the search tab and the empty state.
export default function FeedScreen() {
  const router = useRouter();

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

      <EmptyState
        icon="newspaper-outline"
        title="Todavía no hay publicaciones"
        text="El feed se llena cuando esté lista la creación de publicaciones."
      />
    </AppScreen>
  );
}
