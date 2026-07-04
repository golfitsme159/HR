import { useState } from 'react';
import { clearHrSession } from '../../api/tokenStore';
import { Button } from '../common/ui.jsx';
import WfhApprovals from './WfhApprovals.jsx';
import LeaveApprovals from './LeaveApprovals.jsx';
import EmployeeManagement from './EmployeeManagement.jsx';

const TABS = [
  { id: 'wfh', label: 'WFH Approvals' },
  { id: 'leave', label: 'Leave Approvals' },
  { id: 'employees', label: 'Employee Management' },
];

export default function HrConsole({ user, onLogout }) {
  const [tab, setTab] = useState('wfh');

  const logout = () => {
    clearHrSession();
    onLogout();
  };

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="bg-slate-900 text-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4">
          <div>
            <p className="text-xs text-white/60">Nilecon HR · Admin Console</p>
            <h1 className="text-lg font-bold">{user?.fullName || 'HR'}</h1>
          </div>
          <Button variant="ghost" onClick={logout}>Sign out</Button>
        </div>

        <nav className="mx-auto flex max-w-5xl gap-1 px-5">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={[
                'rounded-t-xl px-4 py-2.5 text-sm font-medium transition',
                tab === t.id ? 'bg-slate-100 text-slate-900' : 'text-white/70 hover:text-white',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl p-5">
        {tab === 'wfh' && <WfhApprovals actingUser={user} />}
        {tab === 'leave' && <LeaveApprovals actingUser={user} />}
        {tab === 'employees' && <EmployeeManagement />}
      </main>
    </div>
  );
}
