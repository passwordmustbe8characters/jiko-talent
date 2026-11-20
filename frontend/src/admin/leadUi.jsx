// Badges and labels shared by the leads screens.
export const HIRING_LABEL = {
  active: 'Advertises roles',
  possible: 'Mentions hiring',
  unknown: 'Hiring unknown',
  none: 'Says no openings',
};
const HIRING_STYLE = {
  active: 'bg-emerald-100 text-emerald-800',
  possible: 'bg-amber-100 text-amber-800',
  unknown: 'bg-slate-100 text-slate-500',
  none: 'bg-slate-200 text-slate-500',
};

export function HiringBadge({ signal }) {
  return (
    <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${HIRING_STYLE[signal] ?? HIRING_STYLE.unknown}`}>
      {HIRING_LABEL[signal] ?? signal}
    </span>
  );
}

export function RegionBadge({ region, country }) {
  return (
    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800">
      {region === 'local' ? country || 'Nigeria' : 'International'}
    </span>
  );
}

export const FACT_CATEGORY_LABEL = {
  overview: 'What they do',
  tech_stack: 'Technology',
  hiring: 'Hiring',
  funding: 'Funding',
  culture: 'Culture',
  contact: 'Contact',
  other: 'Other',
};

export const LEAD_STATUS_LABEL = {
  new: 'New',
  reviewing: 'Reviewing',
  approved: 'Approved',
  contacted: 'Contacted',
  replied: 'Replied',
  closed: 'Closed',
  rejected: 'Rejected',
};

/** Show a source link as "domain/path" so you can see where a claim came from at a glance. */
export function shortUrl(url) {
  try {
    const u = new URL(url);
    return `${u.hostname.replace(/^www\./, '')}${u.pathname === '/' ? '' : u.pathname}`;
  } catch {
    return url;
  }
}

export const safeHref = (url) => (/^https?:\/\//i.test(url) ? url : undefined);
