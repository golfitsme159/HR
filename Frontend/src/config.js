// Central runtime config, read from Vite env vars (VITE_*).

/**
 * Resolves the API base URL used by the axios client.
 *
 * Priority: VITE_API_URL (the Vercel/production convention) → legacy
 * VITE_API_BASE_URL. The backend mounts every route under `/api`, so whatever
 * host is supplied is normalized to always target that `/api` root.
 *
 * In PRODUCTION we NEVER silently fall back to a relative path or the current
 * origin — doing so is exactly what made requests hit the Vercel domain
 * (https://<app>.vercel.app/api/...) and 404. If no URL is configured in a
 * production build we throw loudly so the misconfiguration is obvious.
 *
 * In development an unset value falls back to `/api`, which the Vite dev server
 * proxies to the backend (see vite.config.js).
 */
function resolveApiBaseUrl() {
  const raw = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE_URL || '').trim();

  if (raw) {
    const trimmed = raw.replace(/\/+$/, ''); // strip trailing slash(es)
    // Ensure the `/api` suffix exactly once, whether or not it was supplied.
    return /\/api$/i.test(trimmed) ? trimmed : `${trimmed}/api`;
  }

  if (import.meta.env.PROD) {
    throw new Error(
      'VITE_API_URL is not set. In production the frontend must point explicitly ' +
        'at the backend (e.g. https://nilecon-hr-backend.onrender.com); refusing ' +
        'to fall back to a relative path against the current origin.'
    );
  }

  // Dev only: relative path proxied by the Vite dev server.
  return '/api';
}

export const config = {
  apiBaseUrl: resolveApiBaseUrl(),
  liffId: import.meta.env.VITE_LIFF_ID || '',
  // When set, the LINE SDK is bypassed and this string is used as the id token
  // (see lib/liff.js). Intended for local development outside the LINE app.
  devLineToken: import.meta.env.VITE_DEV_LINE_TOKEN || '',
};

// True when we should skip the real LIFF SDK (no LIFF id, or a dev token given).
export const isLiffBypassed = Boolean(config.devLineToken) || !config.liffId;
