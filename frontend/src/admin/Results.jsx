import { useEffect, useState } from 'react';
import { api } from './api';
import { ErrorBox } from './ui';
import { HIRING_LABEL } from './leadUi';

const rate = (num, den) => (den ? `${Math.round((100 * num) / den)}%` : '-');

function Table({ title, rows, labelOf = (x) => x }) {
  if (!rows?.length) return null;
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-x-auto">
      <p className="px-4 pt-4 text-xs font-bold text-slate-400 uppercase tracking-wider">{title}</p>
      <table className="w-full text-sm text-left mt-2">
        <thead className="text-xs uppercase tracking-wider text-slate-400 bg-slate-50">
          <tr><th className="px-4 py-2">Group</th><th className="px-4 py-2">Contacted</th><th className="px-4 py-2">Replied</th><th className="px-4 py-2">Reply rate</th><th className="px-4 py-2">Interviews</th><th className="px-4 py-2">Offers</th></tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((r) => (
            <tr key={r.label}>
              <td className="px-4 py-2 font-bold text-slate-900">{labelOf(r.label)}</td>
              <td className="px-4 py-2">{r.contacted}</td><td className="px-4 py-2">{r.replied}</td>
              <td className="px-4 py-2">{rate(r.replied, r.contacted)}</td><td className="px-4 py-2">{r.interviews}</td><td className="px-4 py-2">{r.offers}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function Results() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => { api('/results').then(setData).catch((e) => setError(e.message)); }, []);
  if (!data) return error ? <ErrorBox>{error}</ErrorBox> : <p className="text-slate-400">Loading...</p>;
  const { total, pipeline } = data;

  const cards = [
    ['Companies contacted', total.contacted],
    ['Replied', `${total.replied} (${rate(total.replied, total.contacted)})`],
    ['Interviews', total.interviews],
    ['Offers', `${total.offers}${total.students_with_offers ? ` · ${total.students_with_offers} student${total.students_with_offers === 1 ? '' : 's'}` : ''}`],
    ['Declined', total.declined],
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold font-['Sora',_sans-serif] text-slate-900">Results</h1>
      <p className="text-sm text-slate-500">
        You have {pipeline.companies} companies in your list{pipeline.approved ? `, ${pipeline.approved} approved` : ''}, and {pipeline.channels} site{pipeline.channels === 1 ? '' : 's'} students can register on.
        Numbers below count companies, not messages.
      </p>
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        {cards.map(([label, value]) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-200 p-5">
            <p className="text-2xl font-bold text-rose-900 font-['Sora',_sans-serif]">{value}</p>
            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">{label}</p>
          </div>
        ))}
      </div>
      {total.contacted === 0 && <p className="text-slate-500">Nothing has been logged yet. Mark a draft as sent on a company page and it will show up here.</p>}
      <Table title="By hiring signal (is it better to contact companies that are hiring?)" rows={data.byHiring} labelOf={(x) => HIRING_LABEL[x] ?? x} />
      <Table title="By region" rows={data.byRegion} labelOf={(x) => (x === 'local' ? 'Nigeria' : 'International')} />
      <Table title="By how you reached out" rows={data.byChannel} />
      <Table title="By batch" rows={data.byBatch} />
    </div>
  );
}
