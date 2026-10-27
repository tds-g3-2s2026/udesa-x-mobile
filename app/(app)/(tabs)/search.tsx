import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../../src/stores/authStore';
import { useThemeColors } from '../../../src/theme/useThemeColors';
import { Colors } from '../../../src/theme/colors';
import { EmptyState, useSearchFieldStyles } from '../../../src/features/shell/components/AppScreen';
import { normalizedSearchText, SearchKind, SearchResult } from '../../../src/features/search/types';
import { search } from '../../../src/features/search/searchService';

export default function SearchScreen() {
  const [text, setText] = useState('');
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('posts');
  const [focused, setFocused] = useState(true);
  const viewerId = useAuthStore((state) => state.user?.id);
  const client = useQueryClient();
  const router = useRouter();
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const fieldStyles = useSearchFieldStyles();
  const enoughText = Array.from(normalizedSearchText(text, kind)).length >= 3;
  const settled = text.trim() === query;

  useEffect(() => {
    const timer = setTimeout(() => setQuery(text.trim()), 300);
    return () => clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (text.trim() !== query) {
      void client.cancelQueries({ queryKey: ['search', viewerId, kind, query] });
    }
  }, [client, viewerId, kind, query, text]);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      void client.invalidateQueries({ queryKey: ['search', viewerId], refetchType: 'active' });
      return () => setFocused(false);
    }, [client, viewerId])
  );

  const results = useInfiniteQuery({
    queryKey: ['search', viewerId, kind, query],
    queryFn: ({ pageParam, signal }) => search(kind, query, pageParam, signal),
    initialPageParam: null as string | null,
    getNextPageParam: (page) => page.nextCursor,
    enabled: focused && !!viewerId && enoughText && settled,
    retry: false,
  });
  const items =
    settled && enoughText ? (results.data?.pages.flatMap((page) => page.items) ?? []) : [];

  function row(item: SearchResult) {
    const post = 'snippet' in item;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={post ? 'Abrir publicación' : `Abrir perfil de ${item.handle}`}
        onPress={() =>
          router.push({ pathname: post ? '/post/[id]' : '/user/[id]', params: { id: item.id } })
        }
        style={styles.row}
      >
        {post ? (
          <>
            <View style={styles.metadata}>
              <Text style={styles.name}>{item.authorHandle || 'Cuenta'}</Text>
              <Text style={styles.muted}>
                {new Date(item.createdAt).toLocaleDateString('es-AR')}
              </Text>
            </View>
            {item.parentId ? <Text style={styles.muted}>Respuesta</Text> : null}
            <Text style={styles.snippet}>
              {item.snippet.map((part, index) => (
                <Text key={index} style={part.highlighted ? styles.highlight : undefined}>
                  {part.text}
                </Text>
              ))}
            </Text>
          </>
        ) : (
          <>
            <View style={styles.metadata}>
              <Text style={styles.name}>{item.displayName || item.handle}</Text>
              {item.isPrivate ? (
                <Ionicons
                  name="lock-closed-outline"
                  accessibilityLabel="Cuenta protegida"
                  color={colors.muted}
                  size={16}
                />
              ) : null}
            </View>
            <Text style={styles.muted}>{item.handle}</Text>
          </>
        )}
      </Pressable>
    );
  }

  const empty = !enoughText ? (
    <EmptyState
      icon="search-outline"
      title="Empezá a buscar"
      text="Escribí al menos 3 caracteres"
    />
  ) : !settled || results.isPending ? (
    <ActivityIndicator accessibilityLabel="Buscando" color={colors.primary} />
  ) : results.isError && !results.data ? (
    <View style={styles.state}>
      <Text style={styles.error}>{results.error.message}</Text>
      <Pressable accessibilityRole="button" onPress={() => void results.refetch()}>
        <Text style={styles.link}>Reintentar búsqueda</Text>
      </Pressable>
    </View>
  ) : (
    <EmptyState icon="search-outline" title="Sin coincidencias" text="Probá con otro texto." />
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={styles.title}>Buscar</Text>
      <View style={fieldStyles.field}>
        <Ionicons name="search-outline" size={18} color={colors.placeholder} />
        <TextInput
          accessibilityLabel="Buscar personas y publicaciones"
          style={fieldStyles.input}
          value={text}
          onChangeText={setText}
          placeholder="Buscar personas y publicaciones"
          placeholderTextColor={colors.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
      </View>
      <View accessibilityRole="tablist" style={styles.tabs}>
        {(['posts', 'users'] as const).map((tab) => (
          <Pressable
            key={tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: kind === tab }}
            onPress={() => setKind(tab)}
            style={[styles.tab, kind === tab && styles.selectedTab]}
          >
            <Text style={kind === tab ? styles.link : styles.muted}>
              {tab === 'posts' ? 'Posts' : 'Usuarios'}
            </Text>
          </Pressable>
        ))}
      </View>
      <FlatList
        key={`${kind}:${query}`}
        testID="search-results"
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => row(item)}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={items.length ? styles.list : styles.empty}
        ListEmptyComponent={empty}
        onEndReachedThreshold={0.3}
        onEndReached={() => {
          if (
            settled &&
            enoughText &&
            results.hasNextPage &&
            !results.isFetching &&
            !results.isError
          )
            void results.fetchNextPage();
        }}
        ListFooterComponent={
          items.length ? (
            <View style={styles.state}>
              {results.isFetching ? (
                <ActivityIndicator
                  accessibilityLabel="Cargando resultados"
                  color={colors.primary}
                />
              ) : null}
              {results.isError ? (
                <>
                  <Text style={styles.error}>{results.error.message}</Text>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() =>
                      void (results.isFetchNextPageError
                        ? results.fetchNextPage()
                        : results.refetch())
                    }
                  >
                    <Text style={styles.link}>Reintentar resultados</Text>
                  </Pressable>
                </>
              ) : null}
            </View>
          ) : null
        }
      />
    </View>
  );
}

function createStyles(colors: Colors) {
  return StyleSheet.create({
    screen: { flex: 1, paddingHorizontal: 20, backgroundColor: colors.surface },
    title: { fontSize: 26, fontWeight: '800', color: colors.text, marginBottom: 16 },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: colors.divider },
    tab: { flex: 1, alignItems: 'center', padding: 14 },
    selectedTab: { borderBottomWidth: 3, borderBottomColor: colors.primary },
    row: { paddingVertical: 14, gap: 5, borderBottomWidth: 1, borderColor: colors.divider },
    metadata: { flexDirection: 'row', alignItems: 'center', gap: 10 },
    name: { fontSize: 15, fontWeight: '700', color: colors.text, flexShrink: 1 },
    muted: { fontSize: 13, color: colors.muted },
    snippet: { fontSize: 15, lineHeight: 21, color: colors.text },
    highlight: { fontWeight: '700', backgroundColor: colors.primarySoft },
    link: { fontSize: 15, color: colors.primary, fontWeight: '600', paddingVertical: 6 },
    error: { color: colors.danger, textAlign: 'center' },
    state: { paddingVertical: 20, gap: 10, alignItems: 'center' },
    list: { paddingBottom: 32 },
    empty: { flexGrow: 1, justifyContent: 'center', paddingBottom: 32 },
  });
}
