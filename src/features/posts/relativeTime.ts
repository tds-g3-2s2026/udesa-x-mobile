// The feed's rows only get an absolute createdAt from the API; the relative
// "hace 5m" the row shows is computed here, the same way every other screen
// in this app turns a raw timestamp into something a person reads at a
// glance. `now` is a parameter so a test can pin it instead of racing the clock.
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso).getTime();
  const diffSeconds = Math.max(0, Math.floor((now.getTime() - then) / 1000));

  if (diffSeconds < 60) return 'ahora';

  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `hace ${diffMinutes}m`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `hace ${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays}d`;

  // Past a week, a relative count stops being useful: an actual date reads
  // better than "hace 19d". The year is only spelled out once it isn't now.
  const sameYear = new Date(iso).getFullYear() === now.getFullYear();
  return new Intl.DateTimeFormat('es-AR', {
    day: 'numeric',
    month: 'short',
    year: sameYear ? undefined : 'numeric',
  }).format(then);
}
