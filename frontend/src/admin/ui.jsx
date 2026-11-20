// Small shared pieces for the admin screens.
export const STATUS_LABEL = {
  draft: 'Draft',
  researching: 'Researching',
  ready_for_review: 'Ready for review',
  archived: 'Archived',
};

const STATUS_STYLE = {
  draft: 'bg-slate-100 text-slate-600',
  researching: 'bg-amber-100 text-amber-800',
  ready_for_review: 'bg-emerald-100 text-emerald-800',
  archived: 'bg-slate-200 text-slate-500',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${STATUS_STYLE[status] ?? STATUS_STYLE.draft}`}>
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

export function TagChip({ children }) {
  return (
    <span className="inline-block px-2.5 py-1 rounded-full bg-rose-50 text-rose-900 text-xs font-bold border border-rose-900/10">
      {children}
    </span>
  );
}

export function ErrorBox({ children }) {
  if (!children) return null;
  return <div className="mb-6 p-4 bg-red-100 text-red-700 rounded-lg text-sm font-medium border border-red-200">{children}</div>;
}

export const primaryBtn =
  'bg-rose-900 text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-rose-950 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed';
export const ghostBtn =
  'px-5 py-2.5 rounded-full font-bold text-sm text-rose-900 border-2 border-rose-900/20 hover:border-rose-900 transition-colors cursor-pointer disabled:opacity-40';
