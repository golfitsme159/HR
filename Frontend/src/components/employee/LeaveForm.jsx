import { useMemo, useState } from 'react';
import { employeeApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { businessDaysInclusive, toISODate } from '../../lib/dates';
import { Alert, Button, Card, Field, inputClass } from '../common/ui.jsx';

const LEAVE_TYPES = [
  { value: 'ANNUAL', label: 'Annual leave' },
  { value: 'PERSONAL', label: 'Personal leave' },
  { value: 'SICK', label: 'Sick leave' },
];

export default function LeaveForm({ annualLeaveQuota, onSubmitted }) {
  const todayIso = useMemo(() => toISODate(new Date()), []);
  const [form, setForm] = useState({ leaveType: 'ANNUAL', startDate: '', endDate: '' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setError('');
    setSuccess('');
  };

  // Live estimate of business days requested (weekends excluded).
  const requestedDays = useMemo(() => {
    if (!form.startDate || !form.endDate) return 0;
    const s = new Date(form.startDate);
    const e = new Date(form.endDate);
    if (e < s) return 0;
    return businessDaysInclusive(s, e);
  }, [form.startDate, form.endDate]);

  const rangeInvalid = form.startDate && form.endDate && new Date(form.endDate) < new Date(form.startDate);
  const overQuota = form.leaveType === 'ANNUAL' && requestedDays > annualLeaveQuota;
  const canSubmit =
    form.startDate && form.endDate && requestedDays > 0 && !rangeInvalid && !overQuota && !submitting;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await employeeApi.requestLeave(form);
      setSuccess(`${form.leaveType} leave requested (${requestedDays} day(s)).`);
      setForm({ leaveType: 'ANNUAL', startDate: '', endDate: '' });
      onSubmitted?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit leave request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title="Leave Request"
      subtitle="Annual, personal or sick leave."
      action={
        <div className="rounded-xl bg-slate-900 px-3 py-1.5 text-right text-white">
          <div className="text-[10px] uppercase tracking-wide text-white/70">Annual left</div>
          <div className="text-sm font-bold">{annualLeaveQuota} days</div>
        </div>
      }
    >
      <form onSubmit={submit} className="space-y-4">
        <Field label="Leave type">
          <select className={inputClass} value={form.leaveType} onChange={set('leaveType')}>
            {LEAVE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Start date">
            <input type="date" className={inputClass} min={todayIso} value={form.startDate} onChange={set('startDate')} />
          </Field>
          <Field label="End date">
            <input type="date" className={inputClass} min={form.startDate || todayIso} value={form.endDate} onChange={set('endDate')} />
          </Field>
        </div>

        {requestedDays > 0 && !rangeInvalid && (
          <p className="text-sm text-slate-500">
            This request covers <span className="font-semibold text-slate-800">{requestedDays}</span> working day(s).
          </p>
        )}

        {rangeInvalid && <Alert tone="error">End date cannot be before the start date.</Alert>}
        {overQuota && (
          <Alert tone="error">
            Requested {requestedDays} day(s) exceeds your remaining annual quota ({annualLeaveQuota}).
          </Alert>
        )}
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}

        <Button type="submit" variant="primary" className="w-full" disabled={!canSubmit}>
          {submitting ? 'Submitting…' : 'Submit leave request'}
        </Button>
      </form>
    </Card>
  );
}
