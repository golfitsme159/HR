import { useState } from 'react';
import { authApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { setHrSession } from '../../api/tokenStore';
import { Alert, Button, Field, inputClass } from '../common/ui.jsx';

export default function HrLogin({ onLoggedIn }) {
  const [form, setForm] = useState({ username: '', password: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      const { token, user } = await authApi.hrLogin(form.username, form.password);
      setHrSession(token, user);
      onLoggedIn(user);
    } catch (err) {
      setError(apiErrorMessage(err, 'Login failed'));
      setSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 p-6">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl">
        <h1 className="text-xl font-bold text-slate-900">HR / Admin Console</h1>
        <p className="mt-1 text-sm text-slate-500">Sign in to manage requests.</p>

        <form onSubmit={submit} className="mt-6 space-y-4">
          <Field label="Username">
            <input className={inputClass} autoComplete="username" value={form.username} onChange={set('username')} />
          </Field>
          <Field label="Password">
            <input type="password" className={inputClass} autoComplete="current-password" value={form.password} onChange={set('password')} />
          </Field>

          {error && <Alert tone="error">{error}</Alert>}

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={!form.username || !form.password || submitting}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  );
}
