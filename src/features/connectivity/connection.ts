import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import { onlineManager } from '@tanstack/react-query';

// NetInfo reports null while it has not probed yet: that counts as reachable,
// so the app does not open with a false offline notice.
export function isReachable(state: NetInfoState): boolean {
  return state.isConnected !== false && state.isInternetReachable !== false;
}

// React Query's onlineManager is the one place that knows whether there is a
// connection: the notice, the screens and paused queries all read it.
export function watchConnection(): () => void {
  return NetInfo.addEventListener((state) => onlineManager.setOnline(isReachable(state)));
}
