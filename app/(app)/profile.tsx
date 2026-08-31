import Ionicons from '@expo/vector-icons/Ionicons';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '../../src/features/auth/components/authTheme';
import { authService } from '../../src/features/auth/services/authService';
import { AppScreen } from '../../src/features/shell/components/AppScreen';
import { useAuthStore } from '../../src/stores/authStore';

// T-51: the Perfil tab. It owns the session data and the logout, which is where
// E1-H3 lives now that the authenticated area has more than one screen.
export default function ProfileScreen() {
  const user = useAuthStore((state) => state.user);
  const clearSession = useAuthStore((state) => state.clearSession);

  // The root layout only mounts this group when there is a session, so a null
  // user means the group is being unmounted: nothing to draw.
  if (!user) return null;

  // E1-H3.CA2: revokes the token server-side, then the store wipes the local
  // session and the root layout swaps to the public group on its own. The
  // backend call is best effort (see authService.logout), so a wipe failure
  // here is the only one that has to be visible.
  const handleLogout = async () => {
    try {
      await authService.logout();
      await clearSession();
    } catch {
      Alert.alert('Error', 'No se pudieron borrar todos los datos de la sesión del dispositivo.');
    }
  };

  return (
    <AppScreen title="Perfil">
      <View style={styles.card}>
        <View style={styles.avatar}>
          <Text style={styles.avatarInitial}>{user.fullName.charAt(0).toUpperCase()}</Text>
        </View>

        <Text style={styles.fullName}>{user.fullName}</Text>
        <Text style={styles.handle}>{user.handle}</Text>
        <Text style={styles.email}>{user.email}</Text>

        <View style={user.isVerified ? styles.verifiedBadge : styles.pendingBadge}>
          <Ionicons
            name={user.isVerified ? 'checkmark-circle' : 'alert-circle-outline'}
            size={16}
            color={user.isVerified ? colors.primary : colors.danger}
          />
          <Text style={user.isVerified ? styles.verifiedLabel : styles.pendingLabel}>
            {user.isVerified ? 'Correo verificado' : 'Correo sin verificar'}
          </Text>
        </View>
      </View>

      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        accessibilityRole="button"
      >
        <Ionicons name="log-out-outline" size={18} color={colors.danger} />
        <Text style={styles.logoutLabel}>Cerrar Sesión</Text>
      </TouchableOpacity>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: 4,
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.divider,
    backgroundColor: colors.field,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primarySoft,
    marginBottom: 8,
  },
  avatarInitial: {
    fontSize: 30,
    fontWeight: '800',
    color: colors.primary,
  },
  fullName: {
    fontSize: 20,
    fontWeight: '800',
    color: colors.text,
  },
  handle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.primary,
  },
  email: {
    fontSize: 14,
    color: colors.muted,
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  pendingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    backgroundColor: colors.dangerSoft,
  },
  verifiedLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.primary,
  },
  pendingLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.danger,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    marginTop: 24,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
  },
  logoutLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: colors.danger,
  },
});
