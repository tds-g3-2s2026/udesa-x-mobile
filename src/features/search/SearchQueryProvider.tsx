import { PropsWithChildren, useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { focusManager, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/authStore';
import { searchQueryClient } from './queryClient';

export function SearchQueryProvider({ children }: PropsWithChildren) {
  useEffect(() => {
    const unsubscribe = useAuthStore.subscribe((state, previous) => {
      if (state.user?.id !== previous.user?.id) {
        void searchQueryClient.cancelQueries();
        searchQueryClient.clear();
      }
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (Platform.OS !== 'web') focusManager.setFocused(state === 'active');
    });
    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);
  return <QueryClientProvider client={searchQueryClient}>{children}</QueryClientProvider>;
}
