import { useState } from 'react';
import { getLineIdToken } from '../../api/tokenStore';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { Alert, Button, Field, inputClass } from '../common/ui.jsx';

/**
 * First-time onboarding: the employee proves who they are with the last 6
 * digits of their national id, which HR pre-registered. We send it together
 * with the LINE id token so the backend links lineUserId to that record.
 */
export default function AccountLinking({ profile, onLinked }) {
  const [nid, setNid] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const valid = /^\d{6}$/.test(nid);

  const submit = async (e) => {
    e.preventDefault();
    if (!valid) return;
    setSubmitting(true);
    setError('');
    try {
      await authApi.linkLine(getLineIdToken(), nid);
      await onLinked();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not link your account'));
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
              onChange={(e) => setNid(e.target.value.replace(/\D/g, '').slice(0, 6))}
            />
          </Field>

          <Alert tone="error">{error}</Alert>

          <Button type="submit" variant="line" className="w-full" disabled={!valid || submitting}>
            {submitting ? 'Linking…' : 'Link my account'}
          </Button>
        </form>
      </div>
    </div>
  );
}
