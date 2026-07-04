import { useMemo, useState } from 'react';
import { employeeApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { businessDaysBetween, evaluateWfhDate, formatDate, toISODate } from '../../lib/dates';
import { Alert, Button, Card, Spinner, StatusBadge, inputClass } from '../common/ui.jsx';

/**
 * Merges the employee's WFH and leave requests into a single history table,
 * sorted newest-submitted first. WFH rows that are still active (PENDING/
 * APPROVED) and outside the 1-business-day notice window can be modified or
 * cancelled — mirroring the backend rules in wfhService.updateWfhRequest.
 */
export default function RequestsHistory({ wfh, leaves, loading, onChanged }) {
  const [editing, setEditing] = useState(null); // { id, current }
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState('');

  const rows = useMemo(() => {
    const today = new Date();
    const wfhRows = wfh.map((r) => ({
      id: `w-${r._id}`,
      wfhId: r._id,
      kind: 'WFH',
      detail: formatDate(r.requestedDate),
      status: r.status,
      createdAt: r.createdAt,
      // Modifiable/cancellable only while active AND ≥1 business day of notice
      // remains on the current date (matches the server-side guard).
      actionable:
        ['PENDING', 'APPROVED'].includes(r.status) &&
        businessDaysBetween(today, new Date(r.requestedDate)) >= 1,
    }));
    const leaveRows = leaves.map((r) => ({
      id: `l-${r._id}`,
      wfhId: null,
      kind: `${r.leaveType} LEAVE`,
      detail:
        r.startDate === r.endDate || formatDate(r.startDate) === formatDate(r.endDate)
          ? formatDate(r.startDate)
          : `${formatDate(r.startDate)} → ${formatDate(r.endDate)} (${r.numberOfDays}d)`,
      status: r.status,
      createdAt: r.createdAt,
      actionable: false,
    }));
    return [...wfhRows, ...leaveRows].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );
  }, [wfh, leaves]);

  const cancel = async (id) => {
    if (!window.confirm('Cancel this WFH request?')) return;
    setBusyId(id);
    setError('');
    try {
      await employeeApi.cancelWfh(id);
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not cancel the request'));
    } finally {
      setBusyId(null);
    }
  };

  const saveModify = async (id, isoDate) => {
    setBusyId(id);
    setError('');
    try {
      await employeeApi.modifyWfh(id, isoDate);
      setEditing(null);
      onChanged?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not modify the request'));
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card title="My Requests History" subtitle="All your WFH and leave submissions.">
      {error && <div className="mb-3"><Alert tone="error">{error}</Alert></div>}
      {loading ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-slate-400">No requests yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="py-2 pr-3 font-medium">Type</th>
                <th className="py-2 pr-3 font-medium">Date(s)</th>
                <th className="py-2 pr-3 font-medium">Status</th>
                <th className="py-2 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-slate-50 last:border-0">
                  <td className="py-2.5 pr-3">
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                      {r.kind}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-700">{r.detail}</td>
                  <td className="py-2.5 pr-3"><StatusBadge status={r.status} /></td>
                  <td className="py-2.5 text-right">
                    {r.actionable ? (
                      <div className="inline-flex gap-1.5">
                        <Button
                          variant="ghost"
                          className="!px-2.5 !py-1 text-xs"
                          disabled={busyId === r.wfhId}
                          onClick={() => setEditing({ id: r.wfhId, current: r.detail })}
                        >
                          Modify
                        </Button>
                        <Button
                          variant="reject"
                          className="!px-2.5 !py-1 text-xs"
                          disabled={busyId === r.wfhId}
                          onClick={() => cancel(r.wfhId)}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <ModifyDialog
          current={editing.current}
          busy={busyId === editing.id}
          onClose={() => setEditing(null)}
          onSave={(iso) => saveModify(editing.id, iso)}
        />
      )}
    </Card>
  );
}

/** Small modal to pick a new WFH date, validated with the same client rules. */
function ModifyDialog({ current, busy, onClose, onSave }) {
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const [date, setDate] = useState('');

  const evaluation = useMemo(() => {
    if (!date) return null;
    // Parse as local date to keep weekday/holiday checks in the user's tz.
    const [y, m, d] = date.split('-').map(Number);
    return evaluateWfhDate(new Date(y, m - 1, d));
  }, [date]);

  const canSave = Boolean(date) && evaluation?.selectable && !busy;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Modify WFH date</h3>
        <p className="mt-1 text-sm text-slate-500">
          Currently <span className="font-medium text-slate-700">{current}</span>. Pick a new Tue/Wed/Thu
          date with at least 1 business day notice.
        </p>

        <div className="mt-4">
          <input
            type="date"
            className={inputClass}
            min={todayIso}
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>

        {date && evaluation && !evaluation.selectable && (
          <div className="mt-3">
            <Alert tone="error">{evaluation.holiday || evaluation.reason}</Alert>
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button variant="line" disabled={!canSave} onClick={() => onSave(date)}>
            {busy ? 'Saving…' : 'Save new date'}
          </Button>
        </div>
      </div>
    </div>
  );
}
