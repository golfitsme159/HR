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
