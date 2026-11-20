import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { ErrorBox, primaryBtn } from './ui';
import { HiringBadge } from './leadUi';

export default function MatchesTab({ batchId }) {
  const [companies, setCompanies] = useState(null);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try { setCompanies((await api(`/batches/${batchId}/matches`)).companies); }
    catch (e) { setError(e.message); }
  };
  useEffect(() => { load(); }, [batchId]); // eslint-disable-line react-hooks/exhaustive-deps

  const calculate = async () => {
    setBusy(true); setError(''); setNote('');
    try {
      const r = await api(`/batches/${batchId}/match`, { method: 'POST' });
      setNote(`${r.matches} match${r.matches === 1 ? '' : 'es'} found between ${r.students} student${r.students === 1 ? '' : 's'} and ${r.leads} compan${r.leads === 1 ? 'y' : 'ies'}.`);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
        <h3 className="font-bold text-slate-900 font-['Sora',_sans-serif]">Which students fit which companies</h3>
        <p className="text-sm text-slate-500">
          Scores come from skills the company's own website mentions that the student has, whether the student's project fits the company's
          industry, and whether the company advertises roles. Only students who agreed to sharing are included. Run this again after discovery finds new companies.
        </p>
        <div className="flex items-center gap-3">
          <button onClick={calculate} disabled={busy} className={primaryBtn}>{busy ? 'Calculating...' : 'Calculate matches'}</button>
          {note && <span className="text-sm font-bold text-emerald-700">{note}</span>}
        </div>
      </div>
      <ErrorBox>{error}</ErrorBox>

      {companies?.length === 0 && <p className="text-slate-500">No companies in this batch yet. Run discovery on the Leads tab first.</p>}

      {companies?.map((c) => (
        <div key={c.id} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <Link to={`/admin/leads/${c.id}`} className="font-bold text-lg text-slate-900 font-['Sora',_sans-serif] hover:text-rose-900">{c.company_name}</Link>
              <p className="text-xs text-slate-400">{c.domain}</p>
            </div>
            <div className="flex items-center gap-3">
              <HiringBadge signal={c.hiring_signal} />
              <Link to={`/admin/leads/${c.id}`} className="text-sm font-bold text-rose-900 hover:underline">Write email &rarr;</Link>
            </div>
          </div>
          {c.students.length === 0 ? (
            <p className="text-sm text-slate-400">No student matches yet. Click "Calculate matches".</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {c.students.map((s) => (
                  <li key={s.studentId} className="py-2 flex items-start gap-4">
                    <span className="w-14 shrink-0 text-right font-bold text-rose-900">{Math.round(s.score)}</span>
                    <div className="flex-grow">
                      <p className="font-bold text-slate-900 text-sm">{s.name}</p>
                      <p className="text-xs text-slate-500">{s.reason}</p>
                    </div>
                  </li>
                ))}
              </ul>
              {c.totalMatched > c.students.length && <p className="text-xs text-slate-400">+ {c.totalMatched - c.students.length} more students matched</p>}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
