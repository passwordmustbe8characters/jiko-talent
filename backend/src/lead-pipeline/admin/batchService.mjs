// Batch preview/creation used by the admin screens (same rules as scripts/make-batches.mjs).
import { pool } from '../db.mjs';
import { planBatches, FAMILY_LABEL } from '../batching.mjs';

const UNBATCHED = `NOT EXISTS (
  SELECT 1 FROM batch_students bs JOIN batches b ON b.id = bs.batch_id
  WHERE bs.student_id = t.student_id AND b.status <> 'archived')`;

export async function previewBatches({ max = 30, min = 3 } = {}) {
  const stats = (await pool.query(`
    SELECT count(*)::int AS tagged,
           count(*) FILTER (WHERE NOT t.outreach_consent)::int AS no_consent
    FROM student_tags t`)).rows[0];

  const { rows } = await pool.query(`
    SELECT t.student_id AS id, t.role_family, t.tech_tags, s.name, s.role_in_project
    FROM student_tags t JOIN jiko_students s ON s.id = t.student_id
    WHERE t.outreach_consent = true AND ${UNBATCHED}
    ORDER BY t.student_id`);

  const byId = new Map(rows.map((r) => [r.id, r]));
  const plan = planBatches(rows.map((r) => ({ id: r.id, roleFamily: r.role_family, techTags: r.tech_tags })), { max, min })
    .map((b) => ({
      ...b,
      students: b.studentIds.map((id) => ({ id, name: byId.get(id).name, role: byId.get(id).role_in_project })),
    }));
  return { stats: { ...stats, available: rows.length }, plan };
}

export async function saveBatches(options) {
  const { plan } = await previewBatches(options);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const b of plan) {
      const { rows: [batch] } = await client.query(
        `INSERT INTO batches (name, role_family, defining_tags, status, notes)
         VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
        [b.name, FAMILY_LABEL[b.roleFamily] ?? b.roleFamily, b.definingTags, `Auto-batched ${new Date().toISOString().slice(0, 10)}`]
      );
      await client.query(`INSERT INTO batch_students (batch_id, student_id) SELECT $1, unnest($2::int[])`, [batch.id, b.studentIds]);
    }
    await client.query('COMMIT');
    return { created: plan.length };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
