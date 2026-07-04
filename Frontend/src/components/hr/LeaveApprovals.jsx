import { useCallback, useEffect, useState } from 'react';
import { hrApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { formatDate } from '../../lib/dates';
import { Alert, Button, Card, Spinner, StatusBadge, inputClass } from '../common/ui.jsx';

export default function LeaveApprovals({ actingUser }) {
  const [leaves, setLeaves] = useState([]);
  const [staff, setStaff] = useState([]);
  const [actingAs, setActingAs] = useState(actingUser?._id || '');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, staffList] = await Promise.all([hrApi.listLeaves('PENDING'), hrApi.staff()]);
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setLeaves(list);
      setStaff(staffList);
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load leave requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const decide = async (id, status) => {
    if (!actingAs) return;
    setBusyId(id);
    setError('');
    setNotice('');
    try {
      await hrApi.decideLeave(id, status);
      setNotice(`Leave ${status.toLowerCase()}.${status === 'APPROVED' ? ' Annual quota updated.' : ''}`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update leave request'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="Pending Leave Requests" subtitle={`${leaves.length} awaiting review`}>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <div className="mb-3"><Alert tone="success">{notice}</Alert></div>}

      {/* Confirmation gate — mirrors the WFH approvals UI. The authoritative
          approver is always the JWT holder server-side; this is a UX guard. */}
      <div className="mb-4">
        <span className="mb-1 block text-sm font-medium text-slate-700">Acting as (approver)</span>
        <select className={inputClass} value={actingAs} onChange={(e) => setActingAs(e.target.value)}>
          <option value="">— Select your name —</option>
          {staff.map((s) => (
            <option key={s._id} value={s._id}>
              {s.fullName} ({s.role})
            </option>
          ))}
        </select>
        {!actingAs && (
          <p className="mt-1 text-xs text-amber-600">Select your name to enable the actions.</p>
        )}
      </div>

      {loading ? (
        <Spinner />
      ) : leaves.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">Nothing pending 🎉</p>
      ) : (
        <ul className="space-y-3">
          {leaves.map((r) => (
            <li key={r._id} className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-900">{r.userId?.fullName || 'Employee'}</span>
                    <span className="rounded-md bg-white px-2 py-0.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                      {r.leaveType}
                    </span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className="mt-1 text-sm text-slate-600">
                    {formatDate(r.startDate)}
                    {formatDate(r.startDate) !== formatDate(r.endDate) && <> → {formatDate(r.endDate)}</>}
                    <span className="ml-2 text-slate-400">· {r.numberOfDays} working day(s)</span>
                  </div>
                  {r.leaveType === 'ANNUAL' && (
                    <div className="mt-1 text-xs text-slate-400">
                      Remaining annual quota: {r.userId?.annualLeaveQuota ?? '—'}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button variant="approve" disabled={!actingAs || busyId === r._id} onClick={() => decide(r._id, 'APPROVED')}>
                    Approve
                  </Button>
                  <Button variant="reject" disabled={!actingAs || busyId === r._id} onClick={() => decide(r._id, 'REJECTED')}>
                    Reject
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
