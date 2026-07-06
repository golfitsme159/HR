import { useEffect, useState } from 'react';
import { getValidIdToken, reauthenticate } from '../../lib/liff';
import { setLineIdToken } from '../../api/tokenStore';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { Alert, Button, Field, inputClass } from '../common/ui.jsx';

// Preserve the entered National ID across a LINE re-auth redirect, and cap how
// many times we auto-refresh so a skewed clock can't cause a redirect loop.
const NID_KEY = 'nilecon_pending_nid';
const REAUTH_KEY = 'nilecon_liff_reauth_count';
const MAX_REAUTH = 2;

/**
 * First-time onboarding: the employee proves who they are with the last 6
 * digits of their national id, which HR pre-registered. We send it together
 * with a FRESH LINE id token so the backend links lineUserId to that record.
 */
export default function AccountLinking({ profile, onLinked }) {
  const [nid, setNid] = useState(() => sessionStorage.getItem(NID_KEY) || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    // Returning from a token-refresh redirect: the NID was preserved.
    if (sessionStorage.getItem(NID_KEY)) {
      setInfo('Your LINE login was refreshed — tap “Link my account” again.');
    }
  }, []);

  const valid = /^\d{6}$/.test(nid);

  /** Increments and checks the re-auth guard. Returns true if we may refresh. */
  const mayReauth = () => {
    const n = Number(sessionStorage.getItem(REAUTH_KEY) || '0');
    if (n >= MAX_REAUTH) return false;
    sessionStorage.setItem(REAUTH_KEY, String(n + 1));
    return true;
  };

  const startReauth = () => {
    sessionStorage.setItem(NID_KEY, nid); // restore after redirect
    reauthenticate(); // redirects to LINE; page reloads with a fresh token
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError('');
    setInfo('');

    try {
      // Always send a freshly-validated token — never the one cached at load.
      const token = await getValidIdToken();
      if (!token) {
        // No valid token (expired or logged out): refresh it, preserving the NID.
        if (mayReauth()) {
          setInfo('Refreshing your LINE session…');
          startReauth();
          return; // a redirect is in progress; stop here
        }
        setError('Your LINE session expired. Please close and reopen this page from LINE.');
        setSubmitting(false);
        return;
      }

      setLineIdToken(token); // used by later /auth/me calls after linking
      await authApi.linkLine(token, nid);

      // Success — clear the preserved state.
      sessionStorage.removeItem(NID_KEY);
      sessionStorage.removeItem(REAUTH_KEY);
      await onLinked();
    } catch (err) {
      const msg = apiErrorMessage(err, 'Could not link your account');
      // The token can still expire in the gap between fetch and verification.
      if (/expired|jws format/i.test(msg) && mayReauth()) {
        setInfo('Your LINE session expired — refreshing…');
        startReauth();
        return;
      }
      setError(msg);
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl ring-1 ring-slate-200">
        <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-line/10 px-3 py-1 text-xs font-semibold text-line-dark">
          LINE Account Linking
        </div>
        <h1 className="mt-3 text-xl font-bold text-slate-900">
          Welcome{profile?.displayName ? `, ${profile.displayName}` : ''} 👋
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          To activate your account, enter the last <strong>6 digits</strong> of your National ID
          as registered by HR.
        </p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="National ID — last 6 digits">
            <input
              className={`${inputClass} tracking-[0.5em] text-center text-lg`}
              inputMode="numeric"
              autoComplete="off"
              maxLength={6}
              placeholder="••••••"
              value={nid}
              onChange={(e) => {
                setNid(e.target.value.replace(/\D/g, '').slice(0, 6));
                setError('');
                setInfo('');
              }}
            />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}
          {info && !error && <Alert tone="info">{info}</Alert>}

          <Button type="submit" variant="line" className="w-full" disabled={!valid || submitting}>
            {submitting ? 'Linking…' : 'Link my account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
