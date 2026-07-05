import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { initLiff } from '../lib/liff';
import { setLineIdToken } from '../api/tokenStore';
import { isLiffBypassed } from '../config';
import { Spinner } from '../components/common/ui.jsx';

export default function LandingPage() {
  const navigate = useNavigate();

  // The LINE LIFF Endpoint URL is the root ("/"). When real LIFF is configured
  // we treat the root as a LINE entrypoint: resolve the session on load and, if
  // the user already has a valid LINE profile session, save the id token and
  // forward them straight to /employee. Plain web / local-dev (bypass mode)
  // keeps showing the chooser below.
  const [checking, setChecking] = useState(!isLiffBypassed);

  useEffect(() => {
    if (isLiffBypassed) return; // web/dev: show the landing chooser immediately

    let cancelled = false;
    (async () => {
      try {
        // Only forward an already-authenticated user; don't force LINE login here.
        const session = await initLiff({ loginIfNeeded: false });
        if (cancelled) return;
        if (session?.idToken && window.location.pathname === '/') {
          setLineIdToken(session.idToken); // passed on every API call by the axios interceptor
          navigate('/employee', { replace: true });
          return;
        }
      } catch {
        // Initialization failed — fall through to the landing chooser.
      }
      if (!cancelled) setChecking(false);
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Spinner label="Connecting to LINE…" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-100 to-slate-200 p-6">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-xl ring-1 ring-slate-200">
        <h1 className="text-2xl font-bold text-slate-900">Nilecon HR</h1>
        <p className="mt-1 text-sm text-slate-500">WFH &amp; Leave Management</p>

        <div className="mt-8 space-y-3">
          <Link
            to="/employee"
            className="flex items-center justify-between rounded-2xl bg-line px-5 py-4 text-white transition hover:bg-line-dark"
          >
            <span className="font-semibold">Employee (LINE)</span>
            <span aria-hidden>→</span>
          </Link>
          <Link
            to="/hr"
            className="flex items-center justify-between rounded-2xl bg-slate-900 px-5 py-4 text-white transition hover:bg-slate-800"
          >
            <span className="font-semibold">HR / Admin Console</span>
            <span aria-hidden>→</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
