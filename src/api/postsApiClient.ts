import axios from 'axios';
import { attachAuthInterceptors } from './apiClient';

// posts-api is a separate deployment from users-api, with its own base URL,
// but it validates the same JWT users-api issues — so it reuses the same
// token-attach and refresh-and-retry behavior via attachAuthInterceptors.
const POSTS_API_BASE_URL = process.env.EXPO_PUBLIC_POSTS_API_URL || 'http://localhost:8001/api/v1';

export const postsApiClient = axios.create({
  baseURL: POSTS_API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000,
});

attachAuthInterceptors(postsApiClient);
