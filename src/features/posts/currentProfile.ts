import { createContext } from 'react';

// The profile on display, when a card is shown inside one. PostCard reads it
// to skip the link to an author whose profile is the screen already open,
// without every screen that renders cards having to pass it down.
export const CurrentProfileContext = createContext<string | null>(null);
