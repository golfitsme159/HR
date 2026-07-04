import { useCallback, useEffect, useMemo, useState } from 'react';
import { hrApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { formatDate } from '../../lib/dates';
import { Alert, Button, Card, Spinner, StatusBadge, inputClass } from '../common/ui.jsx';

export default function WfhApprovals({ actingUser }) {
  const [requests, setRequests] = useState([]);
  const [staff, setStaff] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [actingAs, setActingAs] = useState(actingUser?._id || '');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [list, staffList] = await Promise.all([hrApi.listWfh('PENDING'), hrApi.staff()]);
      // Newest first (by submission time).
      list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRequests(list);
      setStaff(staffList);
      setSelectedId((prev) => (list.some((r) => r._id === prev) ? prev : list[0]?._id || null));
    } catch (err) {
      setError(apiErrorMessage(err, 'Failed to load WFH requests'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = useMemo(
    () => requests.find((r) => r._id === selectedId) || null,
    [requests, selectedId]
  );

  const decide = async (status) => {
    if (!selected || !actingAs) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await hrApi.decideWfh(selected._id, status);
      setNotice(`Request ${status.toLowerCase()}.`);
      await load();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update request'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Card><Spinner /></Card>;

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_1.1fr]">
      {/* List */}
      <Card title="Pending WFH" subtitle={`${requests.length} awaiting review`}>
        {requests.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">Nothing pending 🎉</p>
        ) : (
          <ul className="space-y-2">
            {requests.map((r) => (
              <li key={r._id}>
                <button
                  onClick={() => setSelectedId(r._id)}
                  className={[
                    'w-full rounded-xl px-4 py-3 text-left transition ring-1',
                    r._id === selectedId
                      ? 'bg-slate-900 text-white ring-slate-900'
                      : 'bg-white ring-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{r.userId?.fullName || 'Employee'}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  <div className={r._id === selectedId ? 'text-sm text-white/70' : 'text-sm text-slate-500'}>
                    {formatDate(r.requestedDate)}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Detail */}
      <Card title="Request detail">
        {!selected ? (
          <p className="py-6 text-center text-sm text-slate-400">Select a request to review.</p>
        ) : (
          <div className="space-y-4">
            <DetailRow label="Employee" value={selected.userId?.fullName} />
            <DetailRow label="Nickname" value={selected.userId?.nickname || '—'} />
            <DetailRow label="WFH date" value={formatDate(selected.requestedDate)} />
            <DetailRow label="Submitted" value={formatDate(selected.createdAt)} />

            <div>
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

            {error && <Alert tone="error">{error}</Alert>}
            {notice && <Alert tone="success">{notice}</Alert>}

            <div className="flex gap-3">
              <Button variant="approve" className="flex-1" disabled={!actingAs || busy} onClick={() => decide('APPROVED')}>
                Approve
              </Button>
              <Button variant="reject" className="flex-1" disabled={!actingAs || busy} onClick={() => decide('REJECTED')}>
                Reject
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-slate-50 pb-2">
      <span className="text-sm text-slate-500">{label}</span>
      <span className="text-sm font-medium text-slate-800">{value || '—'}</span>
    </div>
  );
}
