import liff from '@line/liff';
import { config, isLiffBypassed } from '../config';

/**
 * Initializes the LINE LIFF SDK and returns the employee's id token + profile.
 *
 * In development (no VITE_LIFF_ID, or VITE_DEV_LINE_TOKEN set) the SDK is
 * bypassed and a fixed dev token is returned so the app runs in a plain browser.
 *
 * @returns {Promise<{ idToken: string, profile: object } | null>}
 *   null means a login redirect is in progress (caller should stop rendering).
 */
export async function initLiff() {
  if (isLiffBypassed) {
    return {
      idToken: config.devLineToken || 'emp-somchai',
      profile: { userId: 'dev', displayName: 'Dev Employee' },
    };
  }

  await liff.init({ liffId: config.liffId });

  if (!liff.isLoggedIn()) {
    liff.login();
    return null; // redirecting to LINE login
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
