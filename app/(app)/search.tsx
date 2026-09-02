import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { TextInput, View } from 'react-native';
import { colors } from '../../src/features/auth/components/authTheme';
import {
  AppScreen,
  EmptyState,
  searchFieldStyles,
} from '../../src/features/shell/components/AppScreen';

// The Buscar tab. The field is real, but users-api exposes no search endpoint
// yet, so the screen says so instead of showing invented results.
export default function SearchScreen() {
  const [query, setQuery] = useState('');

  return (
    <AppScreen title="Buscar">
      <View style={searchFieldStyles.field}>
        <Ionicons name="search-outline" size={18} color={colors.placeholder} />
        <TextInput
          style={searchFieldStyles.input}
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar personas y publicaciones"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>

      {query.trim().length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="Empezá a buscar"
          text="Escribí un nombre de usuario o una palabra para encontrar contenido."
        />
      ) : (
        <EmptyState
          icon="cloud-offline-outline"
          title="Sin resultados"
          text="La búsqueda se conecta cuando la API la exponga."
        />
      )}
    </AppScreen>
  );
}
