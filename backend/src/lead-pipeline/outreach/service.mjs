// The outreach record: what you did, what happened, and the results that show what is working.
import { pool } from '../db.mjs';

const httpError = (status, message) => Object.assign(new Error(message), { status });
export const EVENT_TYPES = ['sent', 'followed_up', 'called', 'replied', 'interview', 'offer', 'declined', 'no_response'];
const CHANNELS = ['email', 'call', 'whatsapp', 'linkedin', 'other'];
// What each event means for the company's status in your list (no_response leaves it unchanged)
const STATUS_AFTER = { sent: 'contacted', followed_up: 'contacted', called: 'contacted', replied: 'replied', interview: 'replied', offer: 'replied', declined: 'closed' };

export async function logEvent(leadId, { eventType, channel, notes, studentId, contactId, draftId, occurredAt }) {
  if (!EVENT_TYPES.includes(eventType)) throw httpError(400, 'Invalid event type.');
  if (!CHANNELS.includes(channel)) throw httpError(400, 'Invalid channel.');
  const { rows: [lead] } = await pool.query('SELECT id FROM leads WHERE id = $1 AND deleted_at IS NULL', [leadId]);
  if (!lead) throw httpError(404, 'Company not found.');
  let when = new Date();
  if (occurredAt) { when = new Date(occurredAt); if (Number.isNaN(+when) || when > new Date(Date.now() + 86400000)) throw httpError(400, 'Invalid date.'); }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows: [ev] } = await client.query(
      `INSERT INTO outreach_log (lead_id, draft_id, contact_id, student_id, channel, event_type, notes, occurred_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`,
      [leadId, draftId ?? null, contactId ?? null, studentId ?? null, channel, eventType, notes ? String(notes).slice(0, 3000) : null, when]);
    if (STATUS_AFTER[eventType]) await client.query('UPDATE leads SET status = $2 WHERE id = $1', [leadId, STATUS_AFTER[eventType]]);
    if (eventType === 'sent' && draftId) await client.query(`UPDATE drafts SET status = 'sent' WHERE id = $1`, [draftId]);
    await client.query('COMMIT');
    return { id: ev.id };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

export async function listEvents(leadId) {
  const { rows } = await pool.query(
    `SELECT o.id, o.event_type, o.channel, o.notes, o.occurred_at, o.student_id, s.name AS student_name, c.full_name AS contact_name, c.email AS contact_email
     FROM outreach_log o LEFT JOIN jiko_students s ON s.id = o.student_id LEFT JOIN lead_contacts c ON c.id = o.contact_id
     WHERE o.lead_id = $1 ORDER BY o.occurred_at DESC, o.created_at DESC`, [leadId]);
  return rows;
}

/** Counts of companies (not messages) at each stage, so one company replying twice is still one reply. */
export async function results() {
  const stage = (types) => `count(DISTINCT o.lead_id) FILTER (WHERE o.event_type = ANY(${types}))::int`;
  const CONTACTED = `ARRAY['sent','followed_up','called']`;
  const { rows: [total] } = await pool.query(`
    SELECT ${stage(CONTACTED)} AS contacted, ${stage(`ARRAY['replied']`)} AS replied,
           ${stage(`ARRAY['interview']`)} AS interviews, ${stage(`ARRAY['offer']`)} AS offers,
           ${stage(`ARRAY['declined']`)} AS declined, count(DISTINCT o.student_id) FILTER (WHERE o.event_type = 'offer')::int AS students_with_offers
    FROM outreach_log o`);
  const grouped = (sel, join = '') => pool.query(`
    SELECT ${sel} AS label, ${stage(CONTACTED)} AS contacted, ${stage(`ARRAY['replied']`)} AS replied,
           ${stage(`ARRAY['interview']`)} AS interviews, ${stage(`ARRAY['offer']`)} AS offers
    FROM outreach_log o JOIN leads l ON l.id = o.lead_id ${join}
    GROUP BY 1 ORDER BY contacted DESC, label`);
  const byHiring = (await grouped('l.hiring_signal')).rows;
  const byRegion = (await grouped('l.region')).rows;
  const byChannel = (await pool.query(`
    SELECT o.channel AS label, ${stage(CONTACTED)} AS contacted, ${stage(`ARRAY['replied']`)} AS replied,
           ${stage(`ARRAY['interview']`)} AS interviews, ${stage(`ARRAY['offer']`)} AS offers
    FROM outreach_log o GROUP BY 1 ORDER BY contacted DESC, label`)).rows;
  const byBatch = (await grouped('b.name', 'JOIN batch_leads bl ON bl.lead_id = l.id JOIN batches b ON b.id = bl.batch_id')).rows;
  const { rows: [pipeline] } = await pool.query(`
    SELECT count(*) FILTER (WHERE kind = 'employer' AND status <> 'rejected')::int AS companies,
           count(*) FILTER (WHERE kind = 'employer' AND status = 'approved')::int AS approved,
           count(*) FILTER (WHERE kind = 'channel')::int AS channels FROM leads WHERE deleted_at IS NULL`);
  return { total, byHiring, byRegion, byChannel, byBatch, pipeline };
}
