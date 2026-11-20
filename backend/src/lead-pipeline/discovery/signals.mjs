// Deterministic checks on page text: technologies mentioned, hiring signals, emails, region.
// Every signal comes with a quote taken from the page, so it can be shown and verified.
import { TAG_ALIASES } from '../tags.mjs';

// Words too ambiguous to count as a technology mention on a company website.
const STOP = new Set([
  'go', 'c', 'js', 'ts', 'py', 'ml', 'dl', 'ai', 'ui', 'ux', 'api', 'apis', 'rest', 'git', 'security', 'analytics',
  'spring', 'containers', 'next', 'node', 'express', 'swift', 'flask', 'dart', 'bash', 'cisco', 's3', 'ec2',
  'ubuntu', 'authentication', 'excel', 'networking', 'embedded', 'bootstrap', 'spreadsheets', 'user interface',
  'user experience', 'cybersecurity', 'security', 'devops', 'data science', 'aws', 'sql', 'php', 'nlp', 'iot', 'vue',
]);
// Short names that are safe only when written exactly like this.
const EXACT_SHORT = { aws: 'AWS', sql: 'SQL', php: 'PHP', nlp: 'NLP', iot: 'IoT', vue: 'Vue', devops: 'DevOps' };

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const edge = (body, flags = '') => new RegExp(`(?<![A-Za-z0-9])${body}(?![A-Za-z0-9])`, flags);

const MATCHERS = [];
for (const [tag, aliases] of Object.entries(TAG_ALIASES)) {
  for (const alias of aliases) {
    if (EXACT_SHORT[alias]) { MATCHERS.push({ tag, re: edge(esc(EXACT_SHORT[alias])) }); continue; }
    if (STOP.has(alias) || alias.length <= 3) continue;
    MATCHERS.push({ tag, re: edge(esc(alias), 'i') });
  }
}

export function windowAround(text, index, length, pad = 70) {
  const start = Math.max(0, index - pad);
  const end = Math.min(text.length, index + length + pad);
  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

/** -> Map(tag -> { quote }) using the first mention of each technology */
export function detectTech(text) {
  const found = new Map();
  for (const { tag, re } of MATCHERS) {
    if (found.has(tag)) continue;
    const m = re.exec(text);
    if (m) found.set(tag, { quote: windowAround(text, m.index, m[0].length) });
  }
  return found;
}

const NONE = /(no (current |open )?(openings|vacancies|positions|roles)|not (currently )?hiring|no (job )?(openings|vacancies))/i;
const ACTIVE = /(open positions|current openings|current vacancies|open roles|we(?:'|\u2019)re hiring|we are hiring|now hiring|apply now|job openings|available positions|join our team)/i;
const ROLE = /(developer|engineer|designer|analyst|programmer|software)/i;

/** -> { signal: 'none'|'unknown'|'possible'|'active', quote, claim } */
export function detectHiring(text) {
  const none = NONE.exec(text);
  // Ignore "open positions"-style phrases that sit inside a "no open positions" sentence
  const noneSpans = [...text.matchAll(new RegExp(NONE.source, 'gi'))].map((m) => [m.index, m.index + m[0].length]);
  let act = null;
  for (const m of text.matchAll(new RegExp(ACTIVE.source, 'gi'))) {
    if (noneSpans.some(([a, b]) => m.index >= a - 15 && m.index < b)) continue;
    act = m;
    break;
  }
  if (act) {
    const hasRole = ROLE.test(text);
    return {
      signal: hasRole ? 'active' : 'possible',
      quote: windowAround(text, act.index, act[0].length),
      claim: hasRole ? 'Mentions open or advertised roles for developers, engineers or analysts' : 'Mentions hiring or joining the team',
    };
  }
  if (none) return { signal: 'none', quote: windowAround(text, none.index, none[0].length), claim: 'Says it has no open positions right now' };
  return { signal: 'unknown', quote: null, claim: null };
}

const HIRING_RANK = { unknown: 0, none: 1, possible: 2, active: 3 };
export const bestHiring = (a, b) => (HIRING_RANK[b.signal] > HIRING_RANK[a.signal] ? b : a);

const JUNK_DOMAIN = /(\.(png|jpe?g|gif|svg|webp|css|js)$|^example\.|sentry|wixpress|yourdomain|domain\.com$)/i;
const GENERIC_LOCAL = new Set(['info', 'hello', 'contact', 'careers', 'jobs', 'hr', 'talent', 'recruitment', 'people', 'team', 'support', 'admin', 'enquiries', 'inquiries']);

export function extractEmails(text) {
  const found = new Set();
  for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/g)) {
    const email = m[0].toLowerCase().replace(/[.,;:]+$/, '');
    const domain = email.split('@')[1];
    if (!JUNK_DOMAIN.test(domain)) found.add(email);
  }
  return [...found];
}
export const isGenericInbox = (email) => GENERIC_LOCAL.has(email.split('@')[0]);

const NIGERIA = /\b(Lagos|Abuja|Nigeria|Port Harcourt|Ibadan|Kano|Enugu|Lekki|Ikeja|Yaba)\b/;
export function regionOf(domain, text) {
  const local = domain.endsWith('.ng') || NIGERIA.test(text);
  return { region: local ? 'local' : 'international', country: local ? 'Nigeria' : null };
}
