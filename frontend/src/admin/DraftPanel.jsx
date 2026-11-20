import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox, TagChip, primaryBtn, ghostBtn } from './ui';

const CHANNEL_LABEL = { email: 'Email', call: 'Phone call', whatsapp: 'WhatsApp', linkedin: 'LinkedIn', other: 'Find a contact first' };

export default function DraftPanel({ leadId, batches, facts, onChanged }) {
  const [drafts, setDrafts] = useState(null);
  const [batchId, setBatchId] = useState(batches[0]?.id ?? '');
  const [form, setForm] = useState({ subject: '', body: '' });
  const [channel, setChannel] = useState('email');
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState('');
  const [error, setError] = useState('');

  const draft = drafts?.find((d) => d.batch_id === batchId) ?? null;

  const load = async () => {
    try { setDrafts((await api(`/leads/${leadId}/drafts`)).drafts); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [leadId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (draft) {
      setForm({ subject: draft.subject, body: draft.body });
      setChannel(draft.recommended_channel === 'call' || draft.recommended_channel === 'other' ? 'email' : draft.recommended_channel);
    }
  }, [draft?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (label, fn) => {
    setBusy(label); setError(''); setMsg('');
    try { await fn(); } catch (e) { setError(e.message); } finally { setBusy(''); }
  };

  const generate = () => run('generate', async () => {
    await api(`/batches/${batchId}/leads/${leadId}/draft`, { method: 'POST' });
    await load();
  });

  const changed = draft && (form.subject !== draft.subject || form.body !== draft.body);
  const save = () => run('save', async () => {
    await api(`/drafts/${draft.id}`, { method: 'PATCH', body: { subject: form.subject, body: form.body } });
    setMsg('Draft saved'); await load();
  });
  const approve = () => run('approve', async () => {
    await api(`/drafts/${draft.id}`, { method: 'PATCH', body: { subject: form.subject, body: form.body, status: 'approved' } });
    setMsg('Draft approved'); await load();
  });
  const markSent = () => run('sent', async () => {
    if (changed) await api(`/drafts/${draft.id}`, { method: 'PATCH', body: { subject: form.subject, body: form.body } });
    await api(`/leads/${leadId}/outreach`, {
      method: 'POST',
      body: { eventType: 'sent', channel, draftId: draft.id, contactId: draft.contact_id ?? undefined, notes: `Sent: "${form.subject}"` },
    });
    setMsg('Logged as sent'); await load(); onChanged?.();
  });
  const copy = async () => {
    try { await navigator.clipboard.writeText(`Subject: ${form.subject}\n\n${form.body}`); setMsg('Copied'); }
    catch { setMsg('Copy failed. Select the text and copy it by hand.'); }
  };

  const basedOn = draft ? facts.filter((f) => draft.based_on_fact_ids.includes(f.id)) : [];
  const sent = draft?.status === 'sent';
  const mailto = draft?.contact_email
    ? `mailto:${draft.contact_email}?subject=${encodeURIComponent(form.subject)}&body=${encodeURIComponent(form.body)}`
    : null;

  return (
    <section className="space-y-4">
      <h2 className="text-xl font-bold font-['Sora',_sans-serif] text-slate-900">Email draft</h2>
      <ErrorBox>{error}</ErrorBox>

      {batches.length > 1 && (
        <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
          For batch
          <select value={batchId} onChange={(e) => setBatchId(e.target.value)} className="mt-1 block bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 normal-case tracking-normal font-medium">
            {batches.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
        </label>
      )}

      {drafts && !draft && (
        <div className="bg-white rounded-2xl border border-dashed border-slate-300 p-6 space-y-3">
          <p className="text-slate-500 text-sm">
            No draft yet. The AI writes a short email from this company's verified facts and a summary of your best-matching students. It never sees student names.
            Students must be matched first (batch page, Matches tab).
          </p>
          <button onClick={generate} disabled={!batchId || busy === 'generate'} className={primaryBtn}>{busy === 'generate' ? 'Writing...' : 'Write a draft'}</button>
        </div>
      )}

      {draft && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5">
          <div className="rounded-xl bg-rose-50 border border-rose-900/10 p-4 space-y-1">
            <p className="text-xs font-bold text-rose-900 uppercase tracking-wider">Suggested approach: {CHANNEL_LABEL[draft.recommended_channel]}</p>
            <p className="text-sm text-slate-700">{draft.channel_reasoning}</p>
            {draft.contact_email && <p className="text-sm font-bold text-slate-900">To: {draft.contact_name ? `${draft.contact_name} <${draft.contact_email}>` : draft.contact_email}</p>}
          </div>

          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Students this email is about (names are not in the email)</p>
            <div className="flex flex-wrap gap-1.5">{draft.featured_students.map((s) => <TagChip key={s.id}>{s.name}</TagChip>)}</div>
          </div>

          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Subject
            <input value={form.subject} disabled={sent} onChange={(e) => { setForm({ ...form, subject: e.target.value }); setMsg(''); }}
              className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm normal-case tracking-normal font-medium disabled:opacity-60" />
          </label>
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">
            Email
            <textarea value={form.body} disabled={sent} rows={16} onChange={(e) => { setForm({ ...form, body: e.target.value }); setMsg(''); }}
              className="mt-1 block w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm normal-case tracking-normal leading-relaxed disabled:opacity-60" />
          </label>

          {basedOn.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Facts about the company this email uses (check them below)</p>
              <ul className="text-sm text-slate-600 list-disc pl-5">{basedOn.map((f) => <li key={f.id}>{f.claim}</li>)}</ul>
            </div>
          )}
          <p className="text-xs text-slate-400">
            {draft.edited ? 'You have edited this draft. ' : ''}Written by {draft.model}. The signature and the "no thanks" line are added automatically. Read it before you send it.
          </p>

          {sent ? (
            <p className="font-bold text-emerald-700">Sent. Log replies in the outreach record below.</p>
          ) : (
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={save} disabled={!changed || !!busy} className={ghostBtn}>{busy === 'save' ? 'Saving...' : 'Save changes'}</button>
              <button onClick={approve} disabled={!!busy} className={ghostBtn}>Approve</button>
              <button onClick={copy} className={ghostBtn}>Copy email</button>
              {mailto && <a href={mailto} className={ghostBtn}>Open in email app</a>}
              <button onClick={generate} disabled={!!busy} className={ghostBtn}>{busy === 'generate' ? 'Writing...' : 'Write a new draft'}</button>
            </div>
          )}
          {!sent && (
            <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
              <span className="text-sm text-slate-500">After you have sent it:</span>
              <select value={channel} onChange={(e) => setChannel(e.target.value)} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm font-medium text-slate-900">
                {['email', 'whatsapp', 'linkedin', 'call', 'other'].map((c) => <option key={c} value={c}>Sent by {c}</option>)}
              </select>
              <button onClick={markSent} disabled={!!busy} className={primaryBtn}>{busy === 'sent' ? 'Saving...' : 'Mark as sent'}</button>
            </div>
          )}
          {msg && <p className="text-sm font-bold text-emerald-700">{msg}</p>}
        </div>
      )}
    </section>
  );
}
