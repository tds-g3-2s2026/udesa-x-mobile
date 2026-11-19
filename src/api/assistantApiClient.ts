import axios from 'axios';
import { attachAuthInterceptors } from './apiClient';

// assistant-api is its own deployment. In the cluster the gateway puts it
// behind the same URL as the rest; in local development the default is the
// gateway too, the only process that knows every service. It validates the
// JWT users-api issues, so it reuses the same token and refresh handling.
const ASSISTANT_API_BASE_URL =
  process.env.EXPO_PUBLIC_ASSISTANT_API_URL || 'http://localhost:8002/api';

export const assistantApiClient = axios.create({
  baseURL: ASSISTANT_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // The server waits up to ten seconds for the model: past that, it answers 503.
  timeout: 15000,
});

attachAuthInterceptors(assistantApiClient);
