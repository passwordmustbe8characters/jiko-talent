// Everything about WHAT an outreach email says, kept as pure functions so it can be tested.
// The model writes only the middle of the email. Greeting rules, the signature and the opt-out line are added by code.
import { humanTag } from '../discovery/queries.mjs';

const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
const NOTE = ' This is a rule of thumb based on the contact details found; your outreach log will show what really works.';

/** Which way to reach the company, from the contact details that were actually found. */
export function recommendChannel(lead, contacts) {
  const named = contacts.find((c) => c.full_name && c.email);
  if (named) {
    return {
      channel: 'email', contactId: named.id,
      reasoning: `${named.full_name}${named.job_title ? ` (${named.job_title})` : ''} is named with an email on the company's own website, so a direct email is the best first step.${NOTE}`,
    };
  }
  const anyEmail = contacts.find((c) => c.email);
  if (anyEmail) {
    return {
      channel: 'email', contactId: anyEmail.id,
      reasoning: `Only a general inbox (${anyEmail.email}) was found, so expect slower replies. If you can find a named hiring manager, use that person instead.${NOTE}`,
    };
  }
  const phone = contacts.find((c) => c.phone);
  if (phone && lead.region === 'local') {
    return { channel: 'call', contactId: phone.id, reasoning: `No email was found, but a phone number is listed and the company is in Nigeria, so a short call is realistic.${NOTE}` };
  }
  return {
    channel: 'other', contactId: null,
    reasoning: `No contact was listed on the pages we read. Find a named person (through the company's social pages or your own network) before sending anything.${NOTE}`,
  };
}

export function buildDraftPrompt({ sender, lead, facts, contact, cohort }) {
  const system =
    'You write short, honest first-contact emails from a person who helps final-year Nigerian computer science graduates find their first jobs. ' +
    'Rules: 90 to 130 words in the body. Plain, warm and professional. No hype, flattery or false urgency. ' +
    'Mention at most two specific facts about the company, and ONLY facts from the list provided. Never invent facts, numbers, names or links. ' +
    'Do not name individual students. Offer to share the graduates\' project reports and short demo videos. ' +
    'Make one clear, low-pressure ask (a short reply or a 15-minute call). Use Nigerian/British English spelling. ' +
    'The body must start with a greeting. Do NOT write a signature or any unsubscribe line; those are added automatically. ' +
    'Do not use square brackets or placeholders. Reply with JSON only.';

  const factLines = facts.map((f) => `- [${f.id}] ${f.claim}${f.evidence_quote ? ` (page says: "${clip(f.evidence_quote, 160)}")` : ''}`).join('\n');
  const user = [
    `Company: ${lead.company_name} (${lead.domain})`,
    `What it does (AI summary, may be imperfect): ${lead.summary ?? 'unknown'}`,
    `Industry/location: ${[lead.industry, lead.city, lead.country].filter(Boolean).join(', ') || 'unknown'}`,
    '',
    'Verified facts you may mention (at most two, and list the ids you used in used_fact_ids):',
    factLines || '- (none; keep the email general and do not claim anything about the company)',
    '',
    `Recipient: ${contact?.full_name ? `${contact.full_name}${contact.job_title ? `, ${contact.job_title}` : ''}` : 'unknown person (use a neutral greeting such as "Hello")'}`,
    '',
    'The graduates you represent (do not name individuals):',
    `- ${cohort.size} final-year computer science graduates from ${sender.university}, mostly ${cohort.roleLabel}`,
    `- Skills the company already uses that the best-matching graduates have: ${cohort.skills.length ? cohort.skills.map(humanTag).join(', ') : 'general software skills'}`,
    `- Example projects they built: ${cohort.projects.length ? cohort.projects.join('; ') : 'various final-year projects'}`,
    '- Each has a verified project report and demo available to share.',
    '',
    `Sender: ${sender.senderName}, ${sender.senderTitle}, ${sender.orgName}`,
    '',
    'Return JSON exactly like: {"subject": "...", "body": "...", "used_fact_ids": ["..."]}',
  ].join('\n');
  return { system, user };
}

const wordCount = (s) => s.trim().split(/\s+/).filter(Boolean).length;

/** Checks the model's draft and adds the signature and opt-out line. -> { ok, reason } | { ok, subject, body, usedFactIds } */
export function finalizeDraft({ data, facts, sender }) {
  const subject = String(data?.subject ?? '').replace(/\s+/g, ' ').trim();
  const body = String(data?.body ?? '').replace(/\r/g, '').trim();
  if (subject.length < 5 || subject.length > 100) return { ok: false, reason: 'subject has the wrong length' };
  const words = wordCount(body);
  if (words < 40) return { ok: false, reason: 'body is too short' };
  if (words > 220) return { ok: false, reason: 'body is too long' };
  if (/[\[\]]|\{\{|\}\}/.test(`${subject} ${body}`)) return { ok: false, reason: 'contains a placeholder' };
  if (/https?:\/\/|www\./i.test(body)) return { ok: false, reason: 'contains a link' };
  if (!/^(hi|hello|dear|good (morning|afternoon|evening))\b/i.test(body)) return { ok: false, reason: 'does not start with a greeting' };

  const known = new Set(facts.map((f) => f.id));
  const usedFactIds = (Array.isArray(data?.used_fact_ids) ? data.used_fact_ids : []).filter((id) => known.has(id)).slice(0, 4);

  const signature = `\n\n${sender.senderName}\n${sender.senderTitle}, ${sender.orgName}\n${sender.replyEmail}`;
  const optOut = '\n\nIf this is not relevant to you, just reply "no thanks" and I will not contact you again.';
  return { ok: true, subject, body: body + signature + optOut, usedFactIds };
}
