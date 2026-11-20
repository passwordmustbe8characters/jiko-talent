// Decides what kind of website this is, so job boards, investors and recruiters are not pitched as employers.
// Plain-code check first (cheap, explainable); the AI's own "company_type" is a second opinion in run.mjs.

const BOARD = [
  /post a job/i, /browse (all )?jobs/i, /find (your next |a )?job/i, /job seekers?/i, /job (listings|alerts|board|openings in)/i,
  /(upload|create|build) your (cv|resume)/i, /search jobs/i, /apply (for|to) (jobs|multiple)/i, /remote jobs/i,
  /talent marketplace/i, /pre-?vetted (talent|developers|candidates)/i, /(hire|find) (top )?(talent|developers|freelancers)/i,
  /(thousands|millions) of (jobs|candidates)/i, /recruiters? (and|&) (employers|companies)/i, /candidates? (and|&) employers/i,
];
const INVESTOR = [
  /our portfolio/i, /portfolio companies/i, /venture capital/i, /we invest in/i, /(seed|early-stage) (fund|investor)/i,
  /limited partners/i, /backs? (mission-driven )?(founders|entrepreneurs)/i,
];
const RECRUITER = [/recruitment (agency|firm|consult)/i, /staffing (agency|solutions|firm)/i, /executive search/i, /headhunt/i, /talent acquisition (partner|firm)/i];
const TRAINING = [/bootcamp/i, /enrol(l)? (now|today)/i, /learn to code/i, /our (courses|curriculum|cohorts)/i];

const count = (list, text) => list.filter((re) => re.test(text)).length;

/** -> { kind: 'employer'|'job_board'|'investor'|'recruiter'|'training', label, reason } */
export function classifySite({ domain, text }) {
  const board = count(BOARD, text);
  const stem = domain.split('.')[0];
  const nameHint = /job|recruit|talent|hire|cv|resume|career/i.test(stem);
  if (board >= 3 || (board >= 2 && nameHint)) return { kind: 'job_board', label: 'a job board or marketplace', reason: `${board} job-board phrases` };
  const inv = count(INVESTOR, text);
  if (inv >= 2) return { kind: 'investor', label: 'an investor', reason: `${inv} investor phrases` };
  const rec = count(RECRUITER, text);
  if (rec >= 2) return { kind: 'recruiter', label: 'a recruitment agency', reason: `${rec} recruiter phrases` };
  const tr = count(TRAINING, text);
  if (tr >= 3) return { kind: 'training', label: 'a training provider', reason: `${tr} training phrases` };
  return { kind: 'employer', label: 'an employer', reason: null };
}

/** The AI's company_type -> what we do with the site: 'employer' | 'channel' | 'skip' */
export function kindFromType(type) {
  if (type === 'job_board' || type === 'directory') return 'channel';
  if (['recruiter', 'investor', 'training', 'media'].includes(type)) return 'skip';
  return 'employer';
}

/** Fallback company name from the website address: "sage-grey.com" -> "Sage Grey" */
export function domainName(domain) {
  return domain.split('.')[0].split(/[-_]/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1)).join(' ') || domain;
}
