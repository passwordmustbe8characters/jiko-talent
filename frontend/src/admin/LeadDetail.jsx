import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from './api';
import { ErrorBox, TagChip, primaryBtn } from './ui';
import { HiringBadge, RegionBadge, FACT_CATEGORY_LABEL, LEAD_STATUS_LABEL, shortUrl, safeHref } from './leadUi';
import DraftPanel from './DraftPanel';
import OutreachPanel from './OutreachPanel';

function StudentMatches({ leadId }) {
  const [matches, setMatches] = useState(null);
  useEffect(() => { api(`/leads/${leadId}/matches`).then((d) => setMatches(d.matches)).catch(() => setMatches([])); }, [leadId]);
  if (!matches) return null;
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold font-['Sora',_sans-serif] text-slate-900">Best-matching students</h2>
      {matches.length === 0 ? (
        <p className="text-slate-500 text-sm">No matches yet. Open the batch and use "Calculate matches" on the Matches tab.</p>
      ) : (
        <ul className="bg-white rounded-2xl border border-slate-200 divide-y divide-slate-100">
          {matches.slice(0, 6).map((m) => (
            <li key={`${m.batch_id}-${m.student_id}`} className="p-4 flex items-start gap-4">
              <span className="w-12 shrink-0 text-right font-bold text-rose-900">{Math.round(m.score)}</span>
              <div>
                <p className="font-bold text-slate-900 text-sm">{m.name}</p>
                <p className="text-xs text-slate-500">{m.reason}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState('new');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0); // bumped when a draft is sent so the outreach record reloads

  const load = async () => {
    try {
      const d = await api(`/leads/${id}`);
      setData(d);
      setStatus(d.lead.status);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true); setError(''); setSaved(false);
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: { status } });
      setSaved(true);
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!data) return error ? <ErrorBox>{error}</ErrorBox> : <p className="text-slate-400">Loading...</p>;
  const { lead, facts, contacts, batches } = data;

  const grouped = facts.reduce((acc, f) => {
    (acc[f.category] ||= []).push(f);
    return acc;
  }, {});

  return (
    <div className="space-y-8">
      <Link to={batches[0] ? `/admin/batches/${batches[0].id}` : '/admin'} className="text-sm font-bold text-rose-900 hover:underline">
        &larr; {batches[0] ? batches[0].name : 'All batches'}
      </Link>
      <ErrorBox>{error}</ErrorBox>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold font-['Sora',_sans-serif] text-slate-900">{lead.company_name}</h1>
            <a href={safeHref(lead.website_url)} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-rose-900 hover:underline">
              {lead.domain}
            </a>
            {(lead.city || lead.industry) && (
              <p className="text-sm text-slate-500 mt-1">{[lead.industry, lead.city, lead.country].filter(Boolean).join(' · ')}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <RegionBadge region={lead.region} country={lead.country} />
            <HiringBadge signal={lead.hiring_signal} />
          </div>
        </div>

        {lead.summary && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">AI summary (check the sources below)</p>
            <p className="text-slate-700">{lead.summary}</p>
          </div>
        )}

        {lead.tech_stack.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Technologies mentioned on its website</p>
            <div className="flex flex-wrap gap-1.5">{lead.tech_stack.map((t) => <TagChip key={t}>{t}</TagChip>)}</div>
          </div>
        )}

        {batches.length > 0 && (
          <div>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Why it is in your batches</p>
            <ul className="text-sm text-slate-600 space-y-1">
              {batches.map((b) => <li key={b.id}><span className="font-bold">{b.name}:</span> {b.fit_note || 'No note'}</li>)}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setSaved(false); }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm font-medium"
          >
            {Object.entries(LEAD_STATUS_LABEL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
          <button onClick={save} disabled={busy || status === lead.status} className={primaryBtn}>{busy ? 'Saving...' : 'Save status'}</button>
          {saved && <span className="text-sm font-bold text-emerald-700">Saved</span>}
        </div>
      </div>

      <StudentMatches leadId={id} />
      <DraftPanel leadId={id} batches={batches} facts={facts} onChanged={() => { load(); setTick((t) => t + 1); }} />
      <OutreachPanel leadId={id} refreshKey={tick} onChanged={load} />

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-['Sora',_sans-serif] text-slate-900">Contacts found on its own website</h2>
        {contacts.length === 0 ? (
          <p className="text-slate-500">No contact was listed on the pages we read. You will need to find one by hand.</p>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-50">
                <tr><th className="px-4 py-3">Who</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Phone</th><th className="px-4 py-3">Found on</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {contacts.map((c) => (
                  <tr key={c.id} className="align-top">
                    <td className="px-4 py-3">
                      <p className="font-bold text-slate-900">{c.full_name || 'General contact'}</p>
                      {c.job_title && <p className="text-slate-500">{c.job_title}</p>}
                      {!c.full_name && c.notes && <p className="text-xs text-slate-400">{c.notes}</p>}
                    </td>
                    <td className="px-4 py-3">{c.email ? <a href={`mailto:${c.email}`} className="text-rose-900 font-bold hover:underline">{c.email}</a> : <span className="text-slate-300">none</span>}</td>
                    <td className="px-4 py-3 text-slate-600">{c.phone || <span className="text-slate-300">none</span>}</td>
                    <td className="px-4 py-3">
                      <a href={safeHref(c.source_url)} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-slate-500 hover:text-rose-900 hover:underline">{shortUrl(c.source_url)}</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-bold font-['Sora',_sans-serif] text-slate-900">What we found, with proof</h2>
        {facts.length === 0 && <p className="text-slate-500">No checkable facts were saved for this company.</p>}
        {Object.entries(grouped).map(([cat, list]) => (
          <div key={cat} className="space-y-3">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">{FACT_CATEGORY_LABEL[cat] ?? cat}</p>
            {list.map((f) => (
              <div key={f.id} className="bg-white rounded-2xl border border-slate-200 p-4 space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <p className="font-bold text-slate-900">{f.claim}</p>
                  <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${f.verified ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                    {f.verified ? 'Quote found on the page' : 'Not verified'}
                  </span>
                </div>
                <blockquote className="border-l-4 border-rose-900/20 pl-3 text-sm italic text-slate-600">{f.evidence_quote}</blockquote>
                <p className="text-xs text-slate-400">
                  Source:{' '}
                  <a href={safeHref(f.source_url)} target="_blank" rel="noopener noreferrer" className="font-bold text-slate-500 hover:text-rose-900 hover:underline">{shortUrl(f.source_url)}</a>
                  {' '}&middot; read {new Date(f.fetched_at).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        ))}
      </section>
    </div>
  );
}
