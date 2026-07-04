import { useState } from 'react';
import { hrApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { Alert, Button, Card, Field, inputClass } from '../common/ui.jsx';

const EMPTY = {
  fullName: '',
  nickname: '',
  nationalIdLast6: '',
  maxWfhPerMonth: 10,
  annualLeaveQuota: 6,
};

export default function EmployeeManagement() {
  const [form, setForm] = useState(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const set = (key) => (e) => {
    const value = key === 'nationalIdLast6' ? e.target.value.replace(/\D/g, '').slice(0, 6) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
    setSuccess('');
  };

  const nidValid = /^\d{6}$/.test(form.nationalIdLast6);
  const canSubmit = form.fullName.trim() && nidValid && !submitting;

  const submit = async (e) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const created = await hrApi.createEmployee({
        ...form,
        maxWfhPerMonth: Number(form.maxWfhPerMonth),
        annualLeaveQuota: Number(form.annualLeaveQuota),
      });
      setSuccess(`Registered ${created.fullName}. They can now link via LINE using ID ${created.nationalIdLast6}.`);
      setForm(EMPTY);
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not register employee'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card title="Pre-register Employee" subtitle="New hires link their LINE account later using their National ID.">
      <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
        <Field label="Real name">
          <input className={inputClass} value={form.fullName} onChange={set('fullName')} placeholder="Somchai Jaidee" />
        </Field>
        <Field label="Nickname">
          <input className={inputClass} value={form.nickname} onChange={set('nickname')} placeholder="Chai" />
        </Field>
        <Field label="National ID — last 6 digits" hint={nidValid || !form.nationalIdLast6 ? undefined : 'Must be exactly 6 digits'}>
          <input
            className={`${inputClass} tracking-[0.3em]`}
            inputMode="numeric"
            maxLength={6}
            value={form.nationalIdLast6}
            onChange={set('nationalIdLast6')}
            placeholder="123456"
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="WFH / month">
            <input type="number" min={0} className={inputClass} value={form.maxWfhPerMonth} onChange={set('maxWfhPerMonth')} />
          </Field>
          <Field label="Annual leave">
            <input type="number" min={0} className={inputClass} value={form.annualLeaveQuota} onChange={set('annualLeaveQuota')} />
          </Field>
        </div>

        <div className="sm:col-span-2 space-y-3">
          {error && <Alert tone="error">{error}</Alert>}
          {success && <Alert tone="success">{success}</Alert>}
          <Button type="submit" variant="primary" className="w-full" disabled={!canSubmit}>
            {submitting ? 'Registering…' : 'Register employee'}
          </Button>
        </div>
      </form>
    </Card>
  );
}
