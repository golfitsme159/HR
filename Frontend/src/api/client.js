import axios from 'axios';
import { config } from '../config';
import {
  getHrToken,
  getLineIdToken,
  clearHrSession,
} from './tokenStore';

const client = axios.create({ baseURL: config.apiBaseUrl });

// Request interceptor: attach the right token based on the current route.
//   /hr*  -> HR JWT (localStorage)
//   else  -> employee LINE id token (in-memory, set after LIFF init)
client.interceptors.request.use((cfg) => {
  const isHrContext = window.location.pathname.startsWith('/hr');
  const token = isHrContext ? getHrToken() : getLineIdToken();
  if (token) {
    cfg.headers.Authorization = `Bearer ${token}`;
  }
  return cfg;
});

// Response interceptor: if an HR request is rejected as unauthorized, drop the
// stale session so the app falls back to the login screen.
client.interceptors.response.use(
  (res) => res,
  (error) => {
    const status = error.response?.status;
    const isHrContext = window.location.pathname.startsWith('/hr');
    if (isHrContext && status === 401) {
      clearHrSession();
    }
    return Promise.reject(error);
  }
);

// Normalizes an axios error into a readable message from our API envelope.
export function apiErrorMessage(error, fallback = 'Something went wrong') {
  return (
    error?.response?.data?.error?.message ||
    error?.message ||
    fallback
  );
}

export default client;
