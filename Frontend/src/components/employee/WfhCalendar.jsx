import { useMemo, useState } from 'react';
import { employeeApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import {
  buildMonthGrid,
  evaluateWfhDate,
  formatDate,
  monthName,
  toISODate,
} from '../../lib/dates';
import { Alert, Button, Card } from '../common/ui.jsx';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function WfhCalendar({ onSubmitted }) {
  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState({ year: today.getFullYear(), month: today.getMonth() });
  const [selected, setSelected] = useState(null); // ISO string
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const weeks = useMemo(() => buildMonthGrid(view.year, view.month), [view]);

  const changeMonth = (delta) => {
    setError('');
    setSuccess('');
    const d = new Date(view.year, view.month + delta, 1);
    setView({ year: d.getFullYear(), month: d.getMonth() });
  };

  const submit = async () => {
    if (!selected) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      await employeeApi.requestWfh(selected);
      setSuccess(`WFH request submitted for ${formatDate(selected)}.`);
      setSelected(null);
      onSubmitted?.();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not submit WFH request'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card
      title="WFH Scheduler"
      subtitle="Work-from-home is allowed on Tue / Wed / Thu only."
      action={
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="!px-2.5" onClick={() => changeMonth(-1)} aria-label="Previous month">‹</Button>
          <span className="w-32 text-center text-sm font-semibold text-slate-700">
            {monthName(view.month)} {view.year}
          </span>
          <Button variant="ghost" className="!px-2.5" onClick={() => changeMonth(1)} aria-label="Next month">›</Button>
        </div>
      }
    >
      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-400">
        {WEEKDAYS.map((d) => (
          <div key={d} className="py-1">{d}</div>
        ))}
      </div>

      <div className="mt-1 grid grid-cols-7 gap-1">
        {weeks.flat().map((date) => {
          const iso = toISODate(date);
          const inMonth = date.getMonth() === view.month;
          const { selectable, reason, holiday } = evaluateWfhDate(date, today);
          const isSelected = selected === iso;

          return (
            <button
              key={iso}
              type="button"
              disabled={!selectable}
              onClick={() => selectable && setSelected(iso)}
              title={holiday || reason || 'Available'}
              className={[
                'relative aspect-square rounded-xl text-sm transition',
                !inMonth ? 'opacity-30' : '',
                isSelected
                  ? 'bg-line text-white font-semibold ring-2 ring-line-dark'
                  : selectable
                    ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 font-medium'
                    : 'bg-slate-50 text-slate-300 cursor-not-allowed',
              ].join(' ')}
            >
              {date.getDate()}
              {holiday && inMonth && (
                <span className="absolute inset-x-0 bottom-1 mx-auto h-1 w-1 rounded-full bg-rose-400" />
              )}
            </button>
          );
        })}
      </div>

      <Legend />

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">
          {selected ? (
            <>Selected: <span className="font-semibold text-slate-800">{formatDate(selected)}</span></>
          ) : (
            'Pick an available (green) date.'
          )}
        </p>
        <Button variant="line" disabled={!selected || submitting} onClick={submit}>
          {submitting ? 'Submitting…' : 'Request WFH'}
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {error && <Alert tone="error">{error}</Alert>}
        {success && <Alert tone="success">{success}</Alert>}
      </div>
    </Card>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-emerald-100 ring-1 ring-emerald-200" /> Available
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-3 w-3 rounded bg-slate-100 ring-1 ring-slate-200" /> Blocked
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="h-1.5 w-1.5 rounded-full bg-rose-400" /> Public holiday
      </span>
    </div>
  );
}
