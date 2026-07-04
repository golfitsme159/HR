// Central runtime config, read from Vite env vars (VITE_*).
export const config = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || '/api',
  liffId: import.meta.env.VITE_LIFF_ID || '',
  // When set, the LINE SDK is bypassed and this string is used as the id token
  // (see lib/liff.js). Intended for local development outside the LINE app.
  devLineToken: import.meta.env.VITE_DEV_LINE_TOKEN || '',
};

// True when we should skip the real LIFF SDK (no LIFF id, or a dev token given).
export const isLiffBypassed = Boolean(config.devLineToken) || !config.liffId;
