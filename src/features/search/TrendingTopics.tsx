import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { EmptyState } from '../shell/components/AppScreen';
import { Colors } from '../../theme/colors';
import { useThemeColors } from '../../theme/useThemeColors';
import { useTrendingTopics } from './useTrendingTopics';

interface TrendingTopicsProps {
  onSelect: (tag: string) => void;
}

export function TrendingTopics({ onSelect }: TrendingTopicsProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const trending = useTrendingTopics();

  if (trending.isPending) {
    return (
      <View style={styles.state}>
        <ActivityIndicator accessibilityLabel="Cargando tendencias" color={colors.primary} />
      </View>
    );
  }
  if (trending.isError) {
    return (
      <View style={styles.state}>
        <Text style={styles.error}>No pudimos cargar las tendencias.</Text>
      </View>
    );
  }
  if (trending.data.length === 0) {
    return (
      <EmptyState
        icon="search-outline"
        title="Empezá a buscar"
        text="Escribí al menos 3 caracteres"
      />
    );
  }
  return (
    <View>
      <Text style={styles.title}>Tendencias</Text>
      {trending.data.map((topic) => {
        const posts = topic.count === 1 ? '1 post' : `${topic.count} posts`;
        return (
          <Pressable
            key={topic.tag}
            accessibilityRole="button"
            accessibilityLabel={`Buscar #${topic.tag}, ${posts}`}
            onPress={() => onSelect(topic.tag)}
            style={styles.row}
          >
            <Text style={styles.tag}>#{topic.tag}</Text>
            <Text style={styles.muted}>{posts}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    title: { fontSize: 18, fontWeight: '800', color: colors.text, paddingBottom: 8 },
    row: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderColor: colors.divider,
    },
    tag: { fontSize: 15, fontWeight: '700', color: colors.text },
    muted: { fontSize: 13, color: colors.muted },
    state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    error: { color: colors.danger, textAlign: 'center', paddingVertical: 20 },
  });
}
