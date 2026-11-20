import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from './api';
import { StatusBadge, TagChip, ErrorBox, primaryBtn, ghostBtn } from './ui';

export default function Batches() {
  const [batches, setBatches] = useState(null);
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      setBatches((await api('/batches')).batches);
    } catch (e) {
      setError(e.message);
    }
  };
  useEffect(() => { load(); }, []);

  const findNew = async () => {
    setBusy(true); setError('');
    try { setPreview(await api('/batches/auto', { method: 'POST', body: { save: false } })); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  const createBatches = async () => {
    setBusy(true); setError('');
    try {
      await api('/batches/auto', { method: 'POST', body: { save: true } });
      setPreview(null);
      await load();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <h1 className="text-3xl font-bold font-['Sora',_sans-serif] text-slate-900">Batches</h1>
        <button onClick={findNew} disabled={busy} className={primaryBtn}>
          {busy && !preview ? 'Checking...' : 'Find new batches'}
        </button>
      </div>

      <ErrorBox>{error}</ErrorBox>

      {preview && (
        <div className="mb-8 bg-white border border-rose-900/20 rounded-2xl shadow-xl p-6 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-rose-900 font-['Sora',_sans-serif]">Proposed batches</h2>
              <p className="text-sm text-slate-500 font-['Alan_Sans',_sans-serif]">
                {preview.stats.available} student(s) ready to batch.
                {preview.stats.no_consent > 0 && ` ${preview.stats.no_consent} tagged student(s) are left out because they did not agree to sharing.`}
              </p>
            </div>
            <button onClick={() => setPreview(null)} className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer">Close</button>
          </div>

          {preview.plan.length === 0 ? (
            <p className="text-slate-500 text-sm">Nothing to batch right now. Students need to agree to sharing and must not already be in an active batch.</p>
          ) : (
            <>
              <ul className="divide-y divide-slate-100">
                {preview.plan.map((b) => (
                  <li key={b.name} className="py-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="font-bold text-slate-900">{b.name}</span>
                      <span className="text-xs font-bold text-slate-400">{b.students.length} students</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5">{b.definingTags.map((t) => <TagChip key={t}>{t}</TagChip>)}</div>
                    <p className="mt-2 text-xs text-slate-400">{b.students.map((s) => s.name).join(', ')}</p>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3">
                <button onClick={createBatches} disabled={busy} className={primaryBtn}>
                  {busy ? 'Creating...' : `Create ${preview.plan.length} batch${preview.plan.length === 1 ? '' : 'es'}`}
                </button>
                <button onClick={() => setPreview(null)} className={ghostBtn}>Cancel</button>
              </div>
            </>
          )}
        </div>
      )}

      {batches === null && !error && <p className="text-slate-400">Loading...</p>}
      {batches?.length === 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center text-slate-500">
          No batches yet. Once students have applied and agreed to sharing, click "Find new batches".
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {batches?.map((b) => (
          <Link
            key={b.id}
            to={`/admin/batches/${b.id}`}
            className="block bg-white rounded-2xl border border-slate-200 p-6 shadow-sm hover:shadow-lg hover:border-rose-900/30 transition"
          >
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-lg text-slate-900 font-['Sora',_sans-serif] leading-snug">{b.name}</h3>
              <StatusBadge status={b.status} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{b.defining_tags.slice(0, 5).map((t) => <TagChip key={t}>{t}</TagChip>)}</div>
            <p className="mt-4 text-sm text-slate-500 font-['Alan_Sans',_sans-serif]">
              {b.student_count} student{b.student_count === 1 ? '' : 's'} &middot; {b.lead_count} lead{b.lead_count === 1 ? '' : 's'}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
