import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { ErrorBox, TagChip } from './ui';
import { HiringBadge, RegionBadge, safeHref } from './leadUi';
import DiscoverPanel from './DiscoverPanel';

export default function LeadsTab({ batchId, onChanged }) {
  const [data, setData] = useState(null);
  const [showRejected, setShowRejected] = useState(false);
  const [error, setError] = useState('');

  const load = async (include = showRejected) => {
    try { setData(await api(`/batches/${batchId}/leads${include ? '?includeRejected=1' : ''}`)); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const setStatus = async (id, status) => {
    setError('');
    try {
      await api(`/leads/${id}`, { method: 'PATCH', body: status === 'rejected' ? { status, rejectReason: 'Marked not relevant from the list' } : { status } });
      await load();
    } catch (e) { setError(e.message); }
  };
  const toggleRejected = async () => { const next = !showRejected; setShowRejected(next); await load(next); };

  const leads = data?.leads;
  return (
    <div className="space-y-6">
      <DiscoverPanel batchId={batchId} onFinished={() => { load(); onChanged?.(); }} />
      <ErrorBox>{error}</ErrorBox>

      {leads?.length === 0 && <p className="text-slate-500">No companies yet. Run discovery to find some.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        {leads?.map((l) => (
          <div key={l.id} className={`bg-white rounded-2xl border border-slate-200 shadow-sm flex flex-col ${l.status === 'rejected' ? 'opacity-60' : ''}`}>
            <Link to={`/admin/leads/${l.id}`} className="block p-6 flex-grow hover:bg-slate-50/50 rounded-t-2xl transition">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-bold text-lg text-slate-900 font-['Sora',_sans-serif] leading-snug">{l.company_name}</h3>
                  <p className="text-xs text-slate-400">{l.domain}</p>
                </div>
                <HiringBadge signal={l.hiring_signal} />
              </div>
              {l.summary && <p className="mt-3 text-sm text-slate-600 line-clamp-3">{l.summary}</p>}
              <div className="mt-3 flex flex-wrap gap-1.5">
                <RegionBadge region={l.region} country={l.country} />
                {l.tech_stack.slice(0, 5).map((t) => <TagChip key={t}>{t}</TagChip>)}
              </div>
              {l.fit_note && <p className="mt-3 text-xs font-bold text-rose-900">{l.fit_note}</p>}
              <p className="mt-3 text-xs text-slate-400">
                {l.verified_count} verified fact{l.verified_count === 1 ? '' : 's'} &middot; {l.contact_count} contact{l.contact_count === 1 ? '' : 's'}
                {l.status !== 'new' && ` · ${l.status}`}
              </p>
            </Link>
            <div className="px-6 pb-4 flex justify-end">
              {l.status === 'rejected'
                ? <button onClick={() => setStatus(l.id, 'new')} className="text-xs font-bold text-slate-500 hover:text-rose-900 cursor-pointer">Restore</button>
                : <button onClick={() => setStatus(l.id, 'rejected')} className="text-xs font-bold text-slate-400 hover:text-rose-900 cursor-pointer">Not relevant</button>}
            </div>
          </div>
        ))}
      </div>

      {data && data.rejectedCount > 0 && (
        <button onClick={toggleRejected} className="text-sm font-bold text-slate-500 hover:text-rose-900 cursor-pointer">
          {showRejected ? 'Hide' : 'Show'} {data.rejectedCount} {data.rejectedCount === 1 ? 'company' : 'companies'} you marked not relevant
        </button>
      )}

      {data?.channels.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <h3 className="font-bold text-slate-900 font-['Sora',_sans-serif]">Sites students can register or apply on</h3>
          <p className="text-sm text-slate-500">These are job boards and marketplaces, not employers to pitch. You could share them with your students.</p>
          <ul className="divide-y divide-slate-100">
            {data.channels.map((c) => (
              <li key={c.id} className="py-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <a href={safeHref(c.website_url)} target="_blank" rel="noopener noreferrer" className="font-bold text-rose-900 hover:underline">{c.domain}</a>
                  {c.summary && <p className="text-xs text-slate-500">{c.summary}</p>}
                </div>
                <button onClick={() => setStatus(c.id, 'rejected')} className="text-xs font-bold text-slate-400 hover:text-rose-900 cursor-pointer">Remove</button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
