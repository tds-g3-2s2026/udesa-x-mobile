import { AppScreen, EmptyState } from '../../src/features/shell/components/AppScreen';

// The Notificaciones tab. Notifications come from their own epic, so the tab
// exists with its empty state instead of faking activity.
export default function NotificationsScreen() {
  return (
    <AppScreen title="Notificaciones">
      <EmptyState
        icon="notifications-off-outline"
        title="No tenés notificaciones"
        text="Acá van a aparecer las respuestas, los seguidores nuevos y las menciones."
      />
    </AppScreen>
  );
}
