import { useEffect, useRef, useState } from 'react';
import { api } from './api';
import { ErrorBox, primaryBtn } from './ui';

export default function DiscoverPanel({ batchId, onFinished }) {
  const [job, setJob] = useState(null);
  const [maxCompanies, setMaxCompanies] = useState(10);
  const [error, setError] = useState('');
  const [starting, setStarting] = useState(false);
  const timer = useRef(null);

  // After a page refresh, pick up the most recent run for this batch (if the server still remembers it)
  useEffect(() => {
    api(`/batches/${batchId}/discovery`).then((d) => d.job && setJob(d.job)).catch(() => {});
    return () => clearTimeout(timer.current);
  }, [batchId]);

  // While a run is going, check on it every 2 seconds
  useEffect(() => {
    if (!job || job.status !== 'running') return undefined;
    timer.current = setTimeout(async () => {
      try {
        const d = await api(`/discovery/${job.id}`);
        setJob(d.job);
        if (d.job.status !== 'running') onFinished?.();
      } catch (e) {
        setError(e.message);
      }
    }, 2000);
    return () => clearTimeout(timer.current);
  }, [job]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = async () => {
    setStarting(true); setError('');
    try {
      const d = await api(`/batches/${batchId}/discover`, { method: 'POST', body: { maxCompanies } });
      setJob(d.job);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  };

  const running = job?.status === 'running';
  const s = job?.stats;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
      <ErrorBox>{error}</ErrorBox>

      {!running && (
        <>
          <div>
            <h3 className="font-bold text-slate-900 font-['Sora',_sans-serif]">Find companies for this batch</h3>
            <p className="text-sm text-slate-500 mt-1">
              Searches the web using this batch's skills, reads each company's own website, and keeps only facts it can back up with a
              quote from the page. It uses about 6 of your monthly search credits and takes a few minutes.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-4">
            <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Companies to look at
              <input
                type="number" min={1} max={20} value={maxCompanies}
                onChange={(e) => setMaxCompanies(e.target.value)}
                className="mt-1 block w-28 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 text-sm normal-case tracking-normal font-medium"
              />
            </label>
            <button onClick={start} disabled={starting} className={primaryBtn}>
              {starting ? 'Starting...' : job ? 'Run again' : 'Run discovery'}
            </button>
          </div>
        </>
      )}

      {running && (
        <div className="flex items-center gap-3">
          <span className="inline-block w-3 h-3 rounded-full bg-rose-900 animate-pulse" />
          <span className="font-bold text-rose-900">Discovery is running. You can leave this page open or come back later.</span>
        </div>
      )}

      {job?.status === 'error' && <ErrorBox>Discovery stopped: {job.error}</ErrorBox>}

      {s && (
        <p className="text-sm text-slate-600">
          {s.leadsNew} new, {s.leadsReused} reused, {s.channels ?? 0} job site{s.channels === 1 ? '' : 's'}, {s.skipped} skipped &middot; {s.factsSaved} verified facts
          {s.factsRejected > 0 && ` (${s.factsRejected} rejected because they could not be checked)`}
          {running && ` · looked at ${s.processed} of ${s.candidates} companies`}
        </p>
      )}

      {job?.log?.length > 0 && (
        <pre className="text-xs text-slate-500 bg-slate-50 border border-slate-100 rounded-lg p-3 max-h-48 overflow-auto whitespace-pre-wrap">
          {job.log.slice(-10).join('\n')}
        </pre>
      )}
    </div>
  );
}
