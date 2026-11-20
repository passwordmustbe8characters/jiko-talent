// Calculates and reads student-to-company matches for a batch.
import { pool } from '../db.mjs';
import { scoreStudentLead } from './score.mjs';

/** Recalculates every match in the batch (old ones are replaced). Only students who agreed to sharing are included. */
export async function computeMatches(batchId) {
  const { rows: students } = await pool.query(
    `SELECT bs.student_id AS id, t.tech_tags, t.domain_tags
     FROM batch_students bs JOIN student_tags t ON t.student_id = bs.student_id
     WHERE bs.batch_id = $1 AND t.outreach_consent = true`, [batchId]);
  const { rows: leads } = await pool.query(
    `SELECT l.id, l.tech_stack, l.industry, l.summary, l.hiring_signal
     FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
     WHERE bl.batch_id = $1 AND l.kind = 'employer' AND l.deleted_at IS NULL AND l.status <> 'rejected'`, [batchId]);

  const rows = [];
  for (const l of leads) {
    for (const s of students) {
      const m = scoreStudentLead(
        { techTags: s.tech_tags, domainTags: s.domain_tags },
        { techStack: l.tech_stack, industry: l.industry, summary: l.summary, hiringSignal: l.hiring_signal });
      if (m) rows.push([l.id, s.id, m.score, m.stackScore, m.domainBonus, m.matchedTags.join(','), m.reason]);
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM matches WHERE batch_id = $1', [batchId]);
    if (rows.length) {
      await client.query(
        `INSERT INTO matches (batch_id, lead_id, student_id, score, stack_score, domain_bonus, matched_tags, reason)
         SELECT $1, lead_id, student_id, score, stack_score, domain_bonus,
                COALESCE(string_to_array(NULLIF(tags, ''), ','), '{}'), reason
         FROM unnest($2::uuid[], $3::int[], $4::numeric[], $5::numeric[], $6::numeric[], $7::text[], $8::text[])
              AS t(lead_id, student_id, score, stack_score, domain_bonus, tags, reason)`,
        [batchId, ...[0, 1, 2, 3, 4, 5, 6].map((i) => rows.map((r) => r[i]))]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
  return { students: students.length, leads: leads.length, matches: rows.length };
}

/** Companies in the batch with their best-matching students (top 8 each). */
export async function getMatches(batchId) {
  const { rows: leads } = await pool.query(
    `SELECT l.id, l.company_name, l.domain, l.region, l.hiring_signal, l.status, l.tech_stack
     FROM batch_leads bl JOIN leads l ON l.id = bl.lead_id
     WHERE bl.batch_id = $1 AND l.kind = 'employer' AND l.deleted_at IS NULL AND l.status <> 'rejected'`, [batchId]);
  const { rows: m } = await pool.query(
    `SELECT * FROM (
       SELECT x.lead_id, x.student_id, x.score, x.reason, x.matched_tags, s.name,
              ROW_NUMBER() OVER (PARTITION BY x.lead_id ORDER BY x.score DESC, s.name) AS rn,
              COUNT(*) OVER (PARTITION BY x.lead_id)::int AS total
       FROM matches x JOIN jiko_students s ON s.id = x.student_id WHERE x.batch_id = $1) q
     WHERE rn <= 8 ORDER BY lead_id, rn`, [batchId]);
  const by = new Map();
  for (const r of m) {
    if (!by.has(r.lead_id)) by.set(r.lead_id, []);
    by.get(r.lead_id).push({ studentId: r.student_id, name: r.name, score: Number(r.score), reason: r.reason, matchedTags: r.matched_tags, total: r.total });
  }
  const out = leads.map((l) => ({ ...l, students: by.get(l.id) ?? [], totalMatched: by.get(l.id)?.[0]?.total ?? 0 }));
  out.sort((a, b) => (b.students[0]?.score ?? -1) - (a.students[0]?.score ?? -1) || a.company_name.localeCompare(b.company_name));
  return out;
}
