import axios from 'axios';
import { attachAuthInterceptors } from './apiClient';

// notifications-api is its own deployment, with its own base URL in local
// development (the gateway puts the three services behind one URL in the
// cluster). It validates the same JWT users-api issues, so it reuses the same
// token-attach and refresh-and-retry behavior as postsApiClient.
const NOTIFICATIONS_API_BASE_URL =
  process.env.EXPO_PUBLIC_NOTIFICATIONS_API_URL || 'http://localhost:8003/api';

export const notificationsApiClient = axios.create({
  baseURL: NOTIFICATIONS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

attachAuthInterceptors(notificationsApiClient);
