// Usage (from backend/):
//   node src/lead-pipeline/scripts/make-batches.mjs              preview only (changes nothing)
//   node src/lead-pipeline/scripts/make-batches.mjs --save       create the batches
// Options: --max=30  --min=3  --include-unconsented (testing only)
// Only students who agreed to be shared are batched, and students already in an active batch are skipped.
// Output shows student ids only, never names or contact details.
import { pool, closeDb } from '../db.mjs';
import { planBatches, FAMILY_LABEL } from '../batching.mjs';

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const a = args.find((x) => x.startsWith(`--${name}=`));
  return a ? Number(a.split('=')[1]) : fallback;
};
const SAVE = args.includes('--save');
const INCLUDE_UNCONSENTED = args.includes('--include-unconsented');
const MAX = flag('max', 30);
const MIN = flag('min', 3);

try {
  const counts = (await pool.query(`
    SELECT count(*)::int AS tagged,
           count(*) FILTER (WHERE NOT outreach_consent)::int AS no_consent,
           count(*) FILTER (WHERE EXISTS (
             SELECT 1 FROM batch_students bs JOIN batches b ON b.id = bs.batch_id
             WHERE bs.student_id = student_tags.student_id AND b.status <> 'archived'))::int AS already_batched
    FROM student_tags`)).rows[0];

  const { rows } = await pool.query(`
    SELECT t.student_id AS id, t.role_family, t.tech_tags
    FROM student_tags t
    WHERE NOT EXISTS (
      SELECT 1 FROM batch_students bs JOIN batches b ON b.id = bs.batch_id
      WHERE bs.student_id = t.student_id AND b.status <> 'archived')
    ${INCLUDE_UNCONSENTED ? '' : 'AND t.outreach_consent = true'}
    ORDER BY t.student_id`);

  console.log(`Tagged students: ${counts.tagged} | not agreed to sharing: ${counts.no_consent} | already in a batch: ${counts.already_batched}`);
  console.log(`Available to batch now: ${rows.length}\n`);
  if (rows.length === 0) {
    console.log('Nothing to batch. (Students need a student_tags row, consent = Yes, and no active batch.)');
  } else {
    const plan = planBatches(rows.map((r) => ({ id: r.id, roleFamily: r.role_family, techTags: r.tech_tags })), { max: MAX, min: MIN });
    for (const b of plan) {
      console.log(`• ${b.name}  [${b.studentIds.length} students]`);
      console.log(`    tags: ${b.definingTags.join(', ') || '(none)'}`);
      console.log(`    student ids: ${b.studentIds.join(', ')}`);
    }

    if (!SAVE) {
      console.log(`\nPreview only. Run again with --save to create these ${plan.length} batch(es).`);
    } else {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const b of plan) {
          const { rows: [batch] } = await client.query(
            `INSERT INTO batches (name, role_family, defining_tags, status, notes)
             VALUES ($1, $2, $3, 'draft', $4) RETURNING id`,
            [b.name, FAMILY_LABEL[b.roleFamily] ?? b.roleFamily, b.definingTags, `Auto-batched ${new Date().toISOString().slice(0, 10)}`]
          );
          await client.query(
            `INSERT INTO batch_students (batch_id, student_id) SELECT $1, unnest($2::int[])`,
            [batch.id, b.studentIds]
          );
        }
        await client.query('COMMIT');
        console.log(`\n✅ Created ${plan.length} batch(es) with status "draft".`);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      } finally {
        client.release();
      }
    }
  }
} catch (err) {
  console.error('❌ Batching failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
