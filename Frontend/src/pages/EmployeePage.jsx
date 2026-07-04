import { useCallback, useEffect, useState } from 'react';
import { initLiff } from '../lib/liff';
import { setLineIdToken } from '../api/tokenStore';
import { authApi } from '../api/endpoints';
import { apiErrorMessage } from '../api/client';
import { Spinner, Alert } from '../components/common/ui.jsx';
import AccountLinking from '../components/employee/AccountLinking.jsx';
import EmployeeDashboard from '../components/employee/EmployeeDashboard.jsx';

// Auth phases for the employee (LIFF) experience.
const PHASE = { BOOT: 'BOOT', LINKING: 'LINKING', READY: 'READY', ERROR: 'ERROR' };

export default function EmployeePage() {
  const [phase, setPhase] = useState(PHASE.BOOT);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState('');

  // Resolve the current employee from /auth/me. A 401 means "not linked yet".
  const resolveUser = useCallback(async () => {
    try {
      const me = await authApi.me();
      setUser(me);
      setPhase(PHASE.READY);
    } catch (err) {
      if (err.response?.status === 401) {
        setPhase(PHASE.LINKING);
      } else {
        setError(apiErrorMessage(err, 'Failed to load your profile'));
        setPhase(PHASE.ERROR);
      }
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const session = await initLiff();
        if (!session || cancelled) return; // login redirect in progress
        setLineIdToken(session.idToken);
        setProfile(session.profile);
        await resolveUser();
      } catch (err) {
        if (!cancelled) {
          setError(apiErrorMessage(err, 'Could not initialize LINE'));
          setPhase(PHASE.ERROR);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [resolveUser]);

  if (phase === PHASE.BOOT) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Spinner label="Connecting to LINE…" />
      </div>
    );
  }

  if (phase === PHASE.ERROR) {
    return (
      <div className="mx-auto max-w-md p-6">
        <Alert tone="error">{error}</Alert>
      </div>
    );
  }

  if (phase === PHASE.LINKING) {
    return <AccountLinking profile={profile} onLinked={resolveUser} />;
  }

  return <EmployeeDashboard user={user} onUserChange={setUser} />;
}
