import { Interest } from '../../types/auth';

// The minimum users-api asks for before the onboarding can be finished.
export const MIN_INTERESTS = 3;

// The codes travel to users-api; the labels are only this app's.
export const INTEREST_OPTIONS: { value: Interest; label: string }[] = [
  { value: 'sports', label: 'Deportes' },
  { value: 'technology', label: 'Tecnología' },
  { value: 'politics', label: 'Política' },
  { value: 'music', label: 'Música' },
  { value: 'science', label: 'Ciencia' },
  { value: 'movies', label: 'Cine y series' },
  { value: 'gaming', label: 'Videojuegos' },
  { value: 'economy', label: 'Economía' },
];
