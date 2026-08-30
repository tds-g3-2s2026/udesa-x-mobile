import React from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '../../src/features/auth/components/authTheme';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  // The root layout only mounts this group when there is a session, so a null
  // user means the group is being unmounted: nothing to draw.
  if (!user) return null;

  // E1-H3.CA2: the store wipes the local session and the root layout swaps to
  // the public group on its own. A wipe failure has to be visible.
  const handleLogout = async () => {
    try {
      await clearSession();
    } catch {
      Alert.alert('Error', 'No se pudieron borrar todos los datos de la sesión del dispositivo.');
    }
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.brand}>UdeSA-X</Text>
        <TouchableOpacity
          style={styles.logoutButton}
          onPress={handleLogout}
          accessibilityRole="button"
        >
          <Text style={styles.logoutLabel}>Cerrar Sesión</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.sessionCard}>
        <Text style={styles.greeting}>
          Hola, <Text style={styles.handle}>{user.handle}</Text>
        </Text>
        <Text style={styles.email}>{user.email}</Text>
        <Text style={styles.verification}>
          {user.isVerified ? 'Correo verificado' : 'Correo sin verificar'}
        </Text>
      </View>

      {/* No sample posts: posts-api does not exist yet and inventing a feed here
          would hide that. The real feed arrives with the publication epic. */}
      <View style={[styles.empty, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.emptyTitle}>Todavía no hay publicaciones</Text>
        <Text style={styles.emptyText}>
          El feed se llena cuando esté lista la creación de publicaciones.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.primary,
    letterSpacing: -0.5,
  },
  logoutButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
  },
  logoutLabel: {
    color: colors.muted,
    fontSize: 13,
    fontWeight: '600',
  },
  sessionCard: {
    margin: 24,
    padding: 16,
    borderRadius: 12,
    backgroundColor: colors.field,
    borderWidth: 1,
    borderColor: colors.divider,
  },
  greeting: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  handle: {
    color: colors.primary,
  },
  email: {
    marginTop: 4,
    fontSize: 14,
    color: colors.muted,
  },
  verification: {
    marginTop: 8,
    fontSize: 12,
    color: colors.muted,
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 40,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  emptyText: {
    fontSize: 14,
    color: colors.muted,
    textAlign: 'center',
    lineHeight: 20,
  },
});
