import { useCallback, useEffect, useState } from 'react';
import { employeeApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { Alert } from '../common/ui.jsx';
import WfhCalendar from './WfhCalendar.jsx';
import LeaveForm from './LeaveForm.jsx';
import RequestsHistory from './RequestsHistory.jsx';

export default function EmployeeDashboard({ user }) {
  const [wfh, setWfh] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadHistory = useCallback(async () => {
    try {
      const [w, l] = await Promise.all([employeeApi.myWfh(), employeeApi.myLeaves()]);
      setWfh(w);
      setLeaves(l);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load your requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <header className="bg-line px-5 pb-6 pt-7 text-white">
        <div className="mx-auto max-w-3xl">
          <p className="text-sm/5 text-white/80">Nilecon HR · Employee</p>
          <h1 className="mt-1 text-2xl font-bold">{user.fullName}</h1>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Annual leave left" value={`${user.annualLeaveQuota} days`} />
            <Stat label="WFH / month" value={`${user.maxWfhPerMonth} days`} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-5 p-5">
        {error && <Alert tone="error">{error}</Alert>}

        <WfhCalendar onSubmitted={loadHistory} />
        <LeaveForm annualLeaveQuota={user.annualLeaveQuota} onSubmitted={loadHistory} />
        <RequestsHistory wfh={wfh} leaves={leaves} loading={loading} onChanged={loadHistory} />
      </main>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="rounded-2xl bg-white/15 px-4 py-3 backdrop-blur">
      <div className="text-xs text-white/80">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
    </div>
  );
}
