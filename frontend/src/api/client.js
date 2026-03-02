import axios from 'axios';
import { API_URL } from '../config/env';

let accessToken = null;
let onTokenUpdateCallback = null;
let onUnauthorizedCallback = null;

export const setAccessToken = (token) => {
  accessToken = token || null;
};

export const getAccessToken = () => accessToken;

export const setOnTokenUpdate = (callback) => {
  onTokenUpdateCallback = callback;
};

export const setOnUnauthorized = (callback) => {
  onUnauthorizedCallback = callback;
};

function getCookieValue(name) {
  if (typeof document === 'undefined') return null;
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const match = document.cookie.match(new RegExp(`(?:^|; )${escapedName}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

const client = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Enable automatic cookie handling
  headers: {
    'Content-Type': 'application/json'
  }
});

client.interceptors.request.use((config) => {
  const token = accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const method = (config.method || 'get').toLowerCase();
  if (['post', 'put', 'patch', 'delete'].includes(method)) {
    if (!config.headers['X-Request-Id']) {
      const requestId = typeof crypto !== 'undefined' && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      config.headers['X-Request-Id'] = requestId;
    }
    if (!config.headers['X-Request-Timestamp']) {
      config.headers['X-Request-Timestamp'] = Date.now().toString();
    }

    const csrfToken = getCookieValue('csrfToken');
    if (csrfToken && !config.headers['X-CSRF-Token']) {
      config.headers['X-CSRF-Token'] = csrfToken;
    }
  }

  return config;
});

// Response interceptor for silent refresh on 401
let isRefreshing = false;
let refreshSubscribers = [];

function subscribeTokenRefresh(callback) {
  refreshSubscribers.push(callback);
}

function onRefreshed(newToken) {
  refreshSubscribers.forEach(callback => callback(newToken));
  refreshSubscribers = [];
}

async function performSilentRefresh() {
  try {
    const response = await axios.post(`${API_URL}/auth/refresh`, {}, {
      withCredentials: true
    });
    return response.data.token || null;
  } catch (error) {
    return null;
  }
}

function isAuthEndpoint(url) {
  return typeof url === 'string' && /\/auth\/(login|register|refresh|logout)/i.test(url);
}

client.interceptors.response.use(
  response => response,
  async error => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint(originalRequest?.url)) {
      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;

        const newToken = await performSilentRefresh();

        if (newToken) {
          isRefreshing = false;
          setAccessToken(newToken);
          if (onTokenUpdateCallback) {
            onTokenUpdateCallback(newToken);
          }
          // Re-bind CSRF cookie to new refreshToken (token rotation changes session identifier)
          try {
            await axios.get(`${API_URL}/auth/csrf-token`, { withCredentials: true });
          } catch (_) { /* non-fatal */ }
          onRefreshed(newToken);

          // Retry the original request with the new token
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return client(originalRequest);
        } else {
          isRefreshing = false;
          if (onUnauthorizedCallback) {
            onUnauthorizedCallback();
          }
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

export default client;
