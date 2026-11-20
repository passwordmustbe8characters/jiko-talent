import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, primaryBtn } from './ui';

export const EVENT_LABEL = {
  sent: 'Message sent', followed_up: 'Followed up', called: 'Called', replied: 'They replied',
  interview: 'Interview', offer: 'Offer', declined: 'Declined', no_response: 'No response yet',
};
const NEEDS_STUDENT = ['interview', 'offer', 'declined'];

export default function OutreachPanel({ leadId, refreshKey = 0, onChanged }) {
  const [events, setEvents] = useState(null);
  const [students, setStudents] = useState([]);
  const [form, setForm] = useState({ eventType: 'replied', channel: 'email', studentId: '', notes: '', date: '' });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      setEvents((await api(`/leads/${leadId}/outreach`)).events);
      const m = (await api(`/leads/${leadId}/matches`)).matches;
      setStudents([...new Map(m.map((x) => [x.student_id, { id: x.student_id, name: x.name }])).values()]);
    } catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [leadId, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      await api(`/leads/${leadId}/outreach`, {
        method: 'POST',
        body: {
          eventType: form.eventType, channel: form.channel, notes: form.notes || undefined,
          studentId: NEEDS_STUDENT.includes(form.eventType) && form.studentId ? Number(form.studentId) : undefined,
          occurredAt: form.date ? new Date(form.date).toISOString() : undefined,
        },
      });
      setForm({ ...form, notes: '', date: '' });
      await load(); onChanged?.();
    } catch (err) { setError(err.message); }
    finally { setBusy(false); }
  };

  const field = 'mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 normal-case tracking-normal font-medium';
  const label = 'block text-xs font-bold text-slate-400 uppercase tracking-wider';

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold font-['Sora',_sans-serif] text-slate-900">Outreach record</h2>
      <ErrorBox>{error}</ErrorBox>

      <form onSubmit={save} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
        <p className="text-sm text-slate-500">Write down what happened, so you can see later what works. Marking a reply or an offer updates this company's status for you.</p>
        <div className="grid gap-4 md:grid-cols-4">
          <label className={label}>What happened
            <select value={form.eventType} onChange={(e) => setForm({ ...form, eventType: e.target.value })} className={field}>
              {Object.entries(EVENT_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
          </label>
          <label className={label}>How
            <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className={field}>
              {['email', 'call', 'whatsapp', 'linkedin', 'other'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
          <label className={label}>When (optional)
            <input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} className={field} />
          </label>
          {NEEDS_STUDENT.includes(form.eventType) && (
            <label className={label}>Which student
              <select value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })} className={field}>
                <option value="">Not about one student</option>
                {students.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </div>
        <label className={label}>Notes
          <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className={field} placeholder="What they said, who you spoke to, next step..." />
        </label>
        <button type="submit" disabled={busy} className={primaryBtn}>{busy ? 'Saving...' : 'Add to record'}</button>
      </form>

      {events?.length === 0 && <p className="text-slate-500 text-sm">Nothing recorded for this company yet.</p>}
      <ol className="space-y-3">
        {events?.map((ev) => (
          <li key={ev.id} className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{EVENT_LABEL[ev.event_type]} <span className="text-xs font-bold text-slate-400">&middot; {ev.channel}</span></p>
              <p className="text-xs text-slate-400">{new Date(ev.occurred_at).toLocaleDateString()}</p>
            </div>
            {(ev.student_name || ev.contact_name) && (
              <p className="text-sm text-slate-600">{[ev.student_name && `Student: ${ev.student_name}`, ev.contact_name && `Contact: ${ev.contact_name}`].filter(Boolean).join(' · ')}</p>
            )}
            {ev.notes && <p className="text-sm text-slate-600 mt-1">{ev.notes}</p>}
          </li>
        ))}
      </ol>
    </section>
  );
}
