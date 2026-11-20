// Student-to-company scoring. Pure code: no AI, so every score can be explained and checked.
//   score = skills the company uses that the student has (25 for one, 47.5 for two, 70 for three or more)
//         + project-industry fit (15)  + hiring signal (+15 / +8 / -5)
import { humanTag } from '../discovery/queries.mjs';

const INDUSTRY = {
  fintech: /fintech|financ|bank|payment|lending|insur/i, health: /health|medical|clinic|pharma/i,
  education: /educat|school|learning|edtech/i, agriculture: /agri|farm/i, ecommerce: /commerce|retail|marketplace|shop/i,
  logistics: /logistic|delivery|transport|mobility/i, security: /security|cyber/i, iot: /\biot\b|hardware|embedded/i,
  'ai-ml': /\bai\b|machine learning|artificial/i, civic: /govern|civic|public sector/i,
  'real-estate': /real estate|proptech|property|housing/i, media: /media|entertainment|streaming|content/i,
  'hr-jobs': /\bhr\b|recruit|talent|payroll|workforce/i,
};
const HIRING_BONUS = { active: 15, possible: 8, unknown: 0, none: -5 };
const round1 = (n) => Math.round(n * 10) / 10;

/**
 * student: { techTags: [], domainTags: [] }   lead: { techStack: [], industry, summary, hiringSignal }
 * Returns null when there is no real overlap (hiring alone is not a match).
 */
export function scoreStudentLead(student, lead) {
  const have = new Set(lead.techStack ?? []);
  const matched = (student.techTags ?? []).filter((t) => have.has(t));
  // 1 shared skill = 25, 2 = 47.5, 3 or more = 70. How many skills the student lists does not matter, only how many the company uses.
  const stackScore = matched.length ? Math.min(70, 25 + 22.5 * (matched.length - 1)) : 0;

  const text = `${lead.industry ?? ''} ${lead.summary ?? ''}`;
  const domainHit = (student.domainTags ?? []).find((d) => INDUSTRY[d]?.test(text)) ?? null;
  const domainBonus = domainHit ? 15 : 0;

  if (matched.length === 0 && !domainHit) return null;

  const hiringBonus = HIRING_BONUS[lead.hiringSignal] ?? 0;
  const score = Math.max(0, Math.min(100, round1(stackScore + domainBonus + hiringBonus)));

  const parts = [];
  if (matched.length) parts.push(`Uses ${matched.map(humanTag).join(', ')} (${matched.length} of the student's ${student.techTags.length} skills)`);
  if (domainHit) parts.push(`the student's ${domainHit} project fits the company's industry`);
  if (lead.hiringSignal === 'active') parts.push('company advertises roles');
  else if (lead.hiringSignal === 'possible') parts.push('company mentions hiring');
  else if (lead.hiringSignal === 'none') parts.push('company says it has no openings');

  return { score, stackScore: round1(stackScore), domainBonus, matchedTags: matched, reason: parts.join('; ') };
}
