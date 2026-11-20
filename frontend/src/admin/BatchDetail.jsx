import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from './api';
import { STATUS_LABEL, StatusBadge, TagChip, ErrorBox, primaryBtn } from './ui';
import LeadsTab from './LeadsTab';
import MatchesTab from './MatchesTab';

export default function BatchDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('students');
  const [form, setForm] = useState({ name: '', status: 'draft', notes: '' });
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const d = await api(`/batches/${id}`);
      setData(d);
      setForm({ name: d.batch.name, status: d.batch.status, notes: d.batch.notes ?? '' });
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true); setError(''); setSaved(false);
    try {
      await api(`/batches/${id}`, { method: 'PATCH', body: form });
      setSaved(true);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const moveStudent = async (studentId, toBatchId) => {
    setError('');
    try {
      await api(`/batches/${id}/students/${studentId}/move`, { method: 'POST', body: { toBatchId } });
      await load();
    } catch (e) { setError(e.message); }
  };

  if (!data) return <div>{error ? <ErrorBox>{error}</ErrorBox> : <p className="text-slate-400">Loading...</p>}</div>;
  const { batch, students, otherBatches } = data;
  const changed = form.name !== batch.name || form.status !== batch.status || form.notes !== (batch.notes ?? '');

  return (
    <div className="space-y-8">
      <Link to="/admin" className="text-sm font-bold text-rose-900 hover:underline">&larr; All batches</Link>
      <ErrorBox>{error}</ErrorBox>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-5">
        <div className="flex flex-wrap items-center gap-3">
          <input
            value={form.name}
            onChange={(e) => { setForm({ ...form, name: e.target.value }); setSaved(false); }}
            className="flex-grow min-w-[16rem] text-2xl font-bold font-['Sora',_sans-serif] text-slate-900 bg-transparent border-b-2 border-transparent hover:border-slate-200 focus:border-rose-900 focus:outline-none py-1"
          />
          <StatusBadge status={batch.status} />
        </div>
        <div className="flex flex-wrap gap-1.5">{batch.defining_tags.map((t) => <TagChip key={t}>{t}</TagChip>)}</div>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Status
            <select
              value={form.status}
              onChange={(e) => { setForm({ ...form, status: e.target.value }); setSaved(false); }}
              className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm normal-case tracking-normal font-medium"
            >
              {Object.entries(STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider md:col-span-2">
            Notes
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => { setForm({ ...form, notes: e.target.value }); setSaved(false); }}
              className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm normal-case tracking-normal font-medium"
            />
          </label>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={save} disabled={busy || !changed} className={primaryBtn}>{busy ? 'Saving...' : 'Save changes'}</button>
          {saved && <span className="text-sm font-bold text-emerald-700">Saved</span>}
        </div>
      </div>

      <div>
        <div className="flex gap-2 border-b border-slate-200 mb-6">
          {[
            ['students', `Students (${students.length})`],
            ['leads', `Leads (${batch.lead_count})`],
            ['matches', 'Matches'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm font-bold -mb-px border-b-2 cursor-pointer transition-colors ${
                tab === key ? 'border-rose-900 text-rose-900' : 'border-transparent text-slate-400 hover:text-slate-700'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === 'students' && (
          students.length === 0 ? (
            <p className="text-slate-500">No students in this batch.</p>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-50">
                  <tr>
                    <th className="px-4 py-3">Student</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Skills</th>
                    <th className="px-4 py-3">Project</th>
                    <th className="px-4 py-3">Move</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {students.map((s) => (
                    <tr key={s.id} className="align-top">
                      <td className="px-4 py-3 font-bold text-slate-900">{s.name}</td>
                      <td className="px-4 py-3 text-slate-600">{s.role_in_project}</td>
                      <td className="px-4 py-3"><div className="flex flex-wrap gap-1">{s.tech_tags.map((t) => <TagChip key={t}>{t}</TagChip>)}</div></td>
                      <td className="px-4 py-3 text-slate-600">{s.project_title}</td>
                      <td className="px-4 py-3">
                        <select
                          value=""
                          onChange={(e) => e.target.value && moveStudent(s.id, e.target.value === 'none' ? null : e.target.value)}
                          className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1.5 text-xs font-medium text-slate-700 max-w-[12rem]"
                        >
                          <option value="">Move to...</option>
                          {otherBatches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
                          <option value="none">Remove from batches</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}

        {tab === 'leads' && <LeadsTab batchId={id} onChanged={load} />}
        {tab === 'matches' && <MatchesTab batchId={id} />}
      </div>
    </div>
  );
}
