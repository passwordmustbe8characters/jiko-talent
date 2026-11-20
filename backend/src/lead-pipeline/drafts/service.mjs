// Generates, lists and edits outreach drafts. Students' names never go to the AI.
import { pool } from '../db.mjs';
import { config } from '../config.mjs';
import { chatJSON, currentModel } from '../llm.mjs';
import { roleFamilyFrom } from '../tags.mjs';
import { buildDraftPrompt, finalizeDraft, recommendChannel } from './prompt.mjs';

const httpError = (status, message) => Object.assign(new Error(message), { status });
const ROLE_LABEL = {
  frontend: 'frontend developers', backend: 'backend developers', fullstack: 'full-stack developers', 'data-ai': 'data and AI developers',
  mobile: 'mobile developers', design: 'UI/UX designers', devops: 'cloud and DevOps engineers', 'security-networking': 'security and networking graduates',
  'embedded-iot': 'embedded and IoT engineers', product: 'product-minded graduates', qa: 'QA engineers', other: 'software developers',
};

export async function generateDraft(batchId, leadId) {
  const { rows: [batch] } = await pool.query('SELECT * FROM batches WHERE id = $1', [batchId]);
  const { rows: [lead] } = await pool.query(
    `SELECT l.* FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
     WHERE bl.batch_id = $1 AND l.id = $2 AND l.kind = 'employer' AND l.deleted_at IS NULL`, [batchId, leadId]);
  if (!batch || !lead) throw httpError(404, 'That company is not in this batch.');

  const { rows: top } = await pool.query(
    `SELECT m.student_id, m.matched_tags, s.project_title
     FROM matches m JOIN jiko_students s ON s.id = m.student_id
     WHERE m.batch_id = $1 AND m.lead_id = $2 ORDER BY m.score DESC, s.name LIMIT 5`, [batchId, leadId]);
  if (!top.length) throw httpError(400, 'No students are matched to this company yet. Open the batch and calculate matches first.');

  const { rows: facts } = await pool.query(
    `SELECT id, category, claim, evidence_quote FROM lead_facts WHERE lead_id = $1 AND verified
     ORDER BY CASE category WHEN 'hiring' THEN 0 WHEN 'overview' THEN 1 WHEN 'tech_stack' THEN 2 ELSE 3 END, created_at LIMIT 8`, [leadId]);
  const { rows: contacts } = await pool.query(
    `SELECT id, full_name, job_title, email, phone FROM lead_contacts WHERE lead_id = $1 ORDER BY (full_name IS NULL), created_at`, [leadId]);
  const { rows: [size] } = await pool.query(
    `SELECT count(*)::int AS n FROM batch_students bs JOIN student_tags t ON t.student_id = bs.student_id
     WHERE bs.batch_id = $1 AND t.outreach_consent`, [batchId]);

  const rec = recommendChannel(lead, contacts);
  const contact = contacts.find((c) => c.id === rec.contactId) ?? null;
  const cohort = {
    size: size.n,
    roleLabel: ROLE_LABEL[roleFamilyFrom(batch.role_family)] ?? ROLE_LABEL.other,
    skills: [...new Set(top.flatMap((t) => t.matched_tags))].slice(0, 5),
    projects: [...new Set(top.map((t) => t.project_title).filter(Boolean))].slice(0, 3),
  };

  const sender = config.outreach;
  const { system, user } = buildDraftPrompt({ sender, lead, facts, contact, cohort });
  let result = null; let reason = '';
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    const { data } = await chatJSON({ system, user: attempt ? `${user}\n\nYour previous draft was rejected (${reason}). Fix that.` : user, tier: 'smart', maxTokens: 1500 });
    const fin = finalizeDraft({ data, facts, sender });
    if (fin.ok) result = fin; else reason = fin.reason;
  }
  if (!result) throw httpError(502, `The AI's draft did not pass the checks (${reason}). Try again.`);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`UPDATE drafts SET status = 'discarded' WHERE batch_id = $1 AND lead_id = $2 AND status IN ('draft', 'approved')`, [batchId, leadId]);
    const { rows: [draft] } = await client.query(
      `INSERT INTO drafts (batch_id, lead_id, contact_id, subject, body, featured_student_ids, recommended_channel, channel_reasoning, model, based_on_fact_ids)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING id`,
      [batchId, leadId, rec.contactId, result.subject, result.body, top.map((t) => t.student_id), rec.channel, rec.reasoning, currentModel('smart'), result.usedFactIds]);
    await client.query('COMMIT');
    return { id: draft.id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

/** Current (not discarded) drafts for a company, newest first, with the students they feature. */
export async function listDrafts(leadId) {
  const { rows } = await pool.query(
    `SELECT d.id, d.batch_id, b.name AS batch_name, d.contact_id, d.subject, d.body, d.featured_student_ids, d.recommended_channel,
            d.channel_reasoning, d.model, d.edited, d.status, d.based_on_fact_ids, d.created_at,
            c.email AS contact_email, c.full_name AS contact_name
     FROM drafts d JOIN batches b ON b.id = d.batch_id LEFT JOIN lead_contacts c ON c.id = d.contact_id
     WHERE d.lead_id = $1 AND d.status <> 'discarded' ORDER BY d.created_at DESC`, [leadId]);
  const ids = [...new Set(rows.flatMap((r) => r.featured_student_ids))];
  const names = ids.length ? (await pool.query('SELECT id, name FROM jiko_students WHERE id = ANY($1::int[])', [ids])).rows : [];
  const nameOf = new Map(names.map((n) => [n.id, n.name]));
  return rows.map((r) => ({ ...r, featured_students: r.featured_student_ids.map((id) => ({ id, name: nameOf.get(id) ?? `Student ${id}` })) }));
}

export async function updateDraft(id, { subject, body, status, contactId }) {
  const { rows: [d] } = await pool.query('SELECT subject, body, status FROM drafts WHERE id = $1', [id]);
  if (!d) throw httpError(404, 'Draft not found.');
  if (d.status === 'sent') throw httpError(400, 'This draft was already sent and cannot be edited. Generate a new one.');
  const sets = []; const vals = [];
  const push = (col, v) => { vals.push(v); sets.push(`${col} = $${vals.length}`); };
  if (subject !== undefined) { const s = String(subject).trim(); if (!s || s.length > 300) throw httpError(400, 'Subject must be 1-300 characters.'); push('subject', s); }
  if (body !== undefined) { const b = String(body).trim(); if (!b || b.length > 8000) throw httpError(400, 'Body must be 1-8000 characters.'); push('body', b); }
  if ((subject !== undefined && String(subject).trim() !== d.subject) || (body !== undefined && String(body).trim() !== d.body)) sets.push('edited = true');
  if (status !== undefined) { if (!['draft', 'approved', 'discarded'].includes(status)) throw httpError(400, 'Invalid status.'); push('status', status); }
  if (contactId !== undefined) push('contact_id', contactId);
  if (!sets.length) throw httpError(400, 'Nothing to update.');
  vals.push(id);
  await pool.query(`UPDATE drafts SET ${sets.join(', ')} WHERE id = $${vals.length}`, vals);
}
