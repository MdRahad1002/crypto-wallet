import axios from 'axios';
import { API_URL } from '../config/env';

let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
}

/**
 * Attempts to refresh the access token using the refresh token (stored in HttpOnly cookie).
 * Returns the new access token on success, or null on failure.
 */
export async function silentRefresh() {
  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
      withCredentials: true
    });
    const newToken = response.data.token;
    return newToken || null;
  } catch (error) {
    console.error('Silent refresh failed:', error.response?.data?.message || error.message);
    return null;
  }
}

/**
 * Creates a response interceptor that handles 401 responses by attempting a silent refresh.
 * If refresh succeeds, retries the original request with the new token.
 * If refresh fails, the interceptor rejects the request (triggering logout in the app).
 */
export function setupRefreshInterceptor(client, onTokenUpdate, onUnauthorized) {
  client.interceptors.response.use(
    response => response,
    async error => {
      const originalRequest = error.config;

      if (error.response?.status === 401 && !originalRequest._retry) {
        originalRequest._retry = true;

        if (!isRefreshing) {
          isRefreshing = true;

          const newToken = await silentRefresh();

          if (newToken) {
            isRefreshing = false;
            onTokenUpdate(newToken);
            onRefreshed(newToken);

            // Retry the original request with the new token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            return client(originalRequest);
          } else {
            isRefreshing = false;
            onUnauthorized();
            return Promise.reject(error);
          }
        } else {
          // If already refreshing, wait for the refresh to complete
          return new Promise(resolve => {
            subscribeTokenRefresh(newToken => {
              originalRequest.headers.Authorization = `Bearer ${newToken}`;
              resolve(client(originalRequest));
            });
          });
        }
      }

      return Promise.reject(error);
    }
  );
}
