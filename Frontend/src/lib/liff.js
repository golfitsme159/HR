import liff from '@line/liff';
import { config, isLiffBypassed } from '../config';

// Memoize liff.init() so calling initLiff() from more than one place (e.g. the
// LandingPage root-path check, then EmployeePage) never re-initializes the SDK.
let initPromise = null;
function ensureInit() {
  if (!initPromise) initPromise = liff.init({ liffId: config.liffId });
  return initPromise;
}

/**
 * Initializes the LINE LIFF SDK and returns the employee's id token + profile.
 *
 * In development (no VITE_LIFF_ID, or VITE_DEV_LINE_TOKEN set) the SDK is
 * bypassed and a fixed dev token is returned so the app runs in a plain browser.
 *
 * @param {{ loginIfNeeded?: boolean }} [opts]
 *   loginIfNeeded (default true): when the user isn't logged in, trigger the
 *   LINE login redirect. Pass false for a "soft" session probe (e.g. on the root
 *   path) where we only want to forward an already-authenticated user.
 * @returns {Promise<{ idToken: string, profile: object } | null>}
 *   null means either a login redirect is in progress or there is no active
 *   session (when loginIfNeeded is false).
 */
export async function initLiff({ loginIfNeeded = true } = {}) {
  if (isLiffBypassed) {
    // Production guard: never silently bypass LIFF in a production build — that
    // ships the "Dev Employee" placeholder and an invalid token. Fail loudly so
    // the misconfiguration is obvious (the HR console is unaffected).
    if (import.meta.env.PROD) {
      throw new Error(
        'LINE LIFF is not configured for production. Set VITE_LIFF_ID (and remove ' +
          'VITE_DEV_LINE_TOKEN) on the host, then redeploy. Refusing to bypass LIFF ' +
          'with the "Dev Employee" placeholder in production.'
      );
    }
    return {
      idToken: config.devLineToken || 'emp-somchai',
      profile: { userId: 'dev', displayName: 'Dev Employee' },
    };
  }

  await ensureInit();

  if (!liff.isLoggedIn()) {
    if (loginIfNeeded) {
      liff.login(); // redirects to LINE login; the page reloads afterwards
      return null;
    }
    return null; // no active session, and we were asked not to force login
  }

  const idToken = liff.getIDToken();
  let profile = null;
  try {
    profile = await liff.getProfile();
  } catch {
    profile = null; // profile scope not granted — non-fatal
  }
  return { idToken, profile };
}

/** Decodes a base64url segment to a UTF-8 string (browser-safe). */
function decodeB64Url(segment) {
  const b64 = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = b64.padEnd(Math.ceil(b64.length / 4) * 4, '=');
  return atob(padded);
}

/**
 * True if a JWT's `exp` is in the past (with a small clock-skew margin). A LINE
 * ID token is a JWS/JWT, so we can read its expiry locally and avoid sending a
 * stale token that the backend would reject as "IdToken expired".
 */
export function isIdTokenExpired(token, skewSeconds = 30) {
  try {
    const parts = String(token).split('.');
    if (parts.length !== 3) return true; // not a JWT — treat as unusable
    const payload = JSON.parse(decodeB64Url(parts[1]));
    if (typeof payload.exp !== 'number') return false; // no exp — can't tell, assume ok
    return Date.now() / 1000 >= payload.exp - skewSeconds;
  } catch {
    return true; // undecodable — safest to treat as expired
  }
}

/**
 * Returns a currently-valid LINE ID token, or null if none is available (not
 * logged in, or the cached token has expired). Re-reads from the SDK after
 * ensuring init, so callers get the freshest token the SDK holds — never a
 * value cached at page load. In bypass mode returns the dev token unchanged.
 */
export async function getValidIdToken() {
  if (isLiffBypassed) return config.devLineToken || 'emp-somchai';
  await ensureInit();
  if (!liff.isLoggedIn()) return null;
  const token = liff.getIDToken();
  return token && !isIdTokenExpired(token) ? token : null;
}

/**
 * Re-authenticates with LINE to mint a FRESH ID token. LIFF has no silent
 * ID-token refresh, so this triggers a login redirect; the page reloads and
 * `getValidIdToken()` then returns a new token. No-op in bypass mode.
 */
export function reauthenticate() {
  if (isLiffBypassed) return;
  liff.login({ redirectUri: window.location.href });
}
