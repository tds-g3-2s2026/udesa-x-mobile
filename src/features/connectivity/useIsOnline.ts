import { useEffect, useRef, useSyncExternalStore } from 'react';
import { onlineManager } from '@tanstack/react-query';

const subscribe = (listener: () => void) => onlineManager.subscribe(listener);
const getSnapshot = () => onlineManager.isOnline();

export function useIsOnline(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot);
}

// Runs `callback` each time the connection comes back, never on mount.
export function useOnReconnect(callback: () => void): void {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(
    () =>
      onlineManager.subscribe((online) => {
        if (online) latest.current();
      }),
    []
  );
}
