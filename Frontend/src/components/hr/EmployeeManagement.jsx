import { useCallback, useEffect, useState } from 'react';
import { hrApi } from '../../api/endpoints';
import { apiErrorMessage } from '../../api/client';
import { Alert, Button, Card, Field, Spinner, inputClass } from '../common/ui.jsx';

const EMPTY = {
  fullName: '',
  nickname: '',
  nationalIdLast6: '',
  maxWfhPerMonth: 10,
  annualLeaveQuota: 6,
};

const onlyDigits6 = (v) => v.replace(/\D/g, '').slice(0, 6);

export default function EmployeeManagement() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');

  // Create form
  const [form, setForm] = useState(EMPTY);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');

  // Edit modal
  const [editing, setEditing] = useState(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError('');
    try {
      setEmployees(await hrApi.listEmployees());
    } catch (err) {
      setListError(apiErrorMessage(err, 'Failed to load employees'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setField = (key) => (e) => {
    const value = key === 'nationalIdLast6' ? onlyDigits6(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setCreateError('');
    setCreateSuccess('');
  };

  const nidValid = /^\d{6}$/.test(form.nationalIdLast6);
  const canCreate = form.fullName.trim() && nidValid && !creating;

  const create = async (e) => {
    e.preventDefault();
    if (!canCreate) return;
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    try {
      const created = await hrApi.createEmployee({
        ...form,
        maxWfhPerMonth: Number(form.maxWfhPerMonth),
        annualLeaveQuota: Number(form.annualLeaveQuota),
      });
      setCreateSuccess(`Registered ${created.fullName}. They can link via LINE using ID ${created.nationalIdLast6}.`);
      setForm(EMPTY);
      await refresh(); // table reflects the new employee immediately
    } catch (err) {
      setCreateError(apiErrorMessage(err, 'Could not register employee'));
    } finally {
      setCreating(false);
    }
  };

  const remove = async (emp) => {
    if (
      !window.confirm(
        `Delete ${emp.fullName}?\n\nThis also removes their WFH & leave requests and cannot be undone.`
      )
    ) {
      return;
    }
    setListError('');
    try {
      await hrApi.deleteEmployee(emp._id);
      await refresh();
    } catch (err) {
      setListError(apiErrorMessage(err, 'Could not delete employee'));
    }
  };

  return (
    <div className="space-y-5">
      {/* ---- Pre-register form ---- */}
      <Card title="Pre-register Employee" subtitle="New hires link their LINE account later using their National ID.">
        <form onSubmit={create} className="grid gap-4 sm:grid-cols-2">
          <Field label="Real name">
            <input className={inputClass} value={form.fullName} onChange={setField('fullName')} placeholder="Somchai Jaidee" />
          </Field>
          <Field label="Nickname">
            <input className={inputClass} value={form.nickname} onChange={setField('nickname')} placeholder="Chai" />
          </Field>
          <Field
            label="National ID — last 6 digits"
            hint={nidValid || !form.nationalIdLast6 ? undefined : 'Must be exactly 6 digits'}
          >
            <input
              className={`${inputClass} tracking-[0.3em]`}
              inputMode="numeric"
              maxLength={6}
              value={form.nationalIdLast6}
              onChange={setField('nationalIdLast6')}
              placeholder="123456"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WFH / month">
              <input type="number" min={0} className={inputClass} value={form.maxWfhPerMonth} onChange={setField('maxWfhPerMonth')} />
            </Field>
            <Field label="Annual leave">
              <input type="number" min={0} className={inputClass} value={form.annualLeaveQuota} onChange={setField('annualLeaveQuota')} />
            </Field>
          </div>

          <div className="sm:col-span-2 space-y-3">
            {createError && <Alert tone="error">{createError}</Alert>}
            {createSuccess && <Alert tone="success">{createSuccess}</Alert>}
            <Button type="submit" variant="primary" className="w-full" disabled={!canCreate}>
              {creating ? 'Registering…' : 'Register employee'}
            </Button>
          </div>
        </form>
      </Card>

      {/* ---- Employee table ---- */}
      <Card
        title="Employees"
        subtitle={`${employees.length} registered`}
        action={<Button variant="ghost" onClick={refresh} disabled={loading}>Refresh</Button>}
      >
        {listError && <div className="mb-3"><Alert tone="error">{listError}</Alert></div>}

        {loading ? (
          <Spinner />
        ) : employees.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-400">No employees registered yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                  <th className="py-2 pr-3 font-medium">Real name</th>
                  <th className="py-2 pr-3 font-medium">Nickname</th>
                  <th className="py-2 pr-3 font-medium">National ID</th>
                  <th className="py-2 pr-3 font-medium text-center">WFH / mo</th>
                  <th className="py-2 pr-3 font-medium text-center">Annual</th>
                  <th className="py-2 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => (
                  <tr key={emp._id} className="border-b border-slate-50 last:border-0">
                    <td className="py-2.5 pr-3">
                      <span className="font-medium text-slate-800">{emp.fullName}</span>
                      {emp.lineUserId ? (
                        <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">LINE linked</span>
                      ) : (
                        <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500">Unlinked</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3 text-slate-600">{emp.nickname || '—'}</td>
                    <td className="py-2.5 pr-3 font-mono text-slate-600">{emp.nationalIdLast6}</td>
                    <td className="py-2.5 pr-3 text-center text-slate-600">{emp.maxWfhPerMonth}</td>
                    <td className="py-2.5 pr-3 text-center text-slate-600">{emp.annualLeaveQuota}</td>
                    <td className="py-2.5 text-right">
                      <div className="inline-flex gap-1.5">
                        <Button variant="ghost" className="!px-2.5 !py-1 text-xs" onClick={() => setEditing(emp)}>
                          Edit
                        </Button>
                        <Button variant="reject" className="!px-2.5 !py-1 text-xs" onClick={() => remove(emp)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {editing && (
        <EditEmployeeModal
          employee={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => {
            setEditing(null);
            await refresh(); // reflect the edit immediately
          }}
        />
      )}
    </div>
  );
}

/** Modal to edit an existing employee's details. */
function EditEmployeeModal({ employee, onClose, onSaved }) {
  const [form, setForm] = useState({
    fullName: employee.fullName || '',
    nickname: employee.nickname || '',
    nationalIdLast6: employee.nationalIdLast6 || '',
    maxWfhPerMonth: employee.maxWfhPerMonth ?? 0,
    annualLeaveQuota: employee.annualLeaveQuota ?? 0,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const setField = (key) => (e) => {
    const value = key === 'nationalIdLast6' ? onlyDigits6(e.target.value) : e.target.value;
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };

  const nidValid = /^\d{6}$/.test(form.nationalIdLast6);
  const canSave = form.fullName.trim() && nidValid && !saving;

  const save = async (e) => {
    e.preventDefault();
    if (!canSave) return;
    setSaving(true);
    setError('');
    try {
      await hrApi.updateEmployee(employee._id, {
        ...form,
        maxWfhPerMonth: Number(form.maxWfhPerMonth),
        annualLeaveQuota: Number(form.annualLeaveQuota),
      });
      await onSaved();
    } catch (err) {
      setError(apiErrorMessage(err, 'Could not update employee'));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-slate-200">
        <h3 className="text-base font-semibold text-slate-900">Edit employee</h3>
        <p className="mt-0.5 text-sm text-slate-500">Update details for {employee.fullName}.</p>

        <form onSubmit={save} className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Real name">
            <input className={inputClass} value={form.fullName} onChange={setField('fullName')} />
          </Field>
          <Field label="Nickname">
            <input className={inputClass} value={form.nickname} onChange={setField('nickname')} />
          </Field>
          <Field
            label="National ID — last 6 digits"
            hint={nidValid || !form.nationalIdLast6 ? undefined : 'Must be exactly 6 digits'}
          >
            <input
              className={`${inputClass} tracking-[0.3em]`}
              inputMode="numeric"
              maxLength={6}
              value={form.nationalIdLast6}
              onChange={setField('nationalIdLast6')}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="WFH / month">
              <input type="number" min={0} className={inputClass} value={form.maxWfhPerMonth} onChange={setField('maxWfhPerMonth')} />
            </Field>
            <Field label="Annual leave">
              <input type="number" min={0} className={inputClass} value={form.annualLeaveQuota} onChange={setField('annualLeaveQuota')} />
            </Field>
          </div>

          <div className="sm:col-span-2 space-y-3">
            {error && <Alert tone="error">{error}</Alert>}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={!canSave}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
