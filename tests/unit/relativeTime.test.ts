import { formatRelativeTime } from '../../src/features/posts/relativeTime';

const NOW = new Date('2026-09-22T15:00:00Z');

describe('E2-H2. Feed Principal', () => {
  it('E2-H2.CA3 - a post from seconds ago reads "ahora"', () => {
    expect(formatRelativeTime('2026-09-22T14:59:31Z', NOW)).toBe('ahora');
  });

  it('E2-H2.CA3 - a post from minutes ago counts minutes', () => {
    expect(formatRelativeTime('2026-09-22T14:55:00Z', NOW)).toBe('hace 5m');
  });

  it('E2-H2.CA3 - a post from hours ago counts hours, not minutes', () => {
    expect(formatRelativeTime('2026-09-22T12:00:00Z', NOW)).toBe('hace 3h');
  });

  it('E2-H2.CA3 - a post from days ago counts days, not hours', () => {
    expect(formatRelativeTime('2026-09-19T15:00:00Z', NOW)).toBe('hace 3d');
  });

  it('E2-H2.CA3 - a post from over a week ago shows a date instead of a count', () => {
    expect(formatRelativeTime('2026-09-10T15:00:00Z', NOW)).toBe('10 sept');
  });

  it('E2-H2.CA3 - a post from a previous year includes the year', () => {
    expect(formatRelativeTime('2025-12-20T15:00:00Z', NOW)).toBe('20 de dic de 2025');
  });
});
