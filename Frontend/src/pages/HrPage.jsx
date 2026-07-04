import { useState } from 'react';
import { getHrToken, getHrUser } from '../api/tokenStore';
import HrLogin from '../components/hr/HrLogin.jsx';
import HrConsole from '../components/hr/HrConsole.jsx';

export default function HrPage() {
  const [session, setSession] = useState(() =>
    getHrToken() ? { user: getHrUser() } : null
  );

  if (!session) {
    return <HrLogin onLoggedIn={(user) => setSession({ user })} />;
  }
  return <HrConsole user={session.user} onLogout={() => setSession(null)} />;
}
