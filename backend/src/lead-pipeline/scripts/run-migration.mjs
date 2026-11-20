// Usage (from the backend folder):
//   node src/lead-pipeline/scripts/run-migration.mjs
// Runs migrations/001_lead_pipeline.sql once. Safe to re-run only after the rollback
// statement at the bottom of that file, because the tables are created without IF NOT EXISTS.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closeDb } from '../db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const file = process.argv[2] ?? path.join(here, '..', 'migrations', '001_lead_pipeline.sql');

try {
  const exists = await pool.query(`SELECT to_regclass('public.jiko_students') AS t`);
  if (!exists.rows[0].t) throw new Error('jiko_students table not found. Check DATABASE_URL points to the right database.');
  const already = await pool.query(`SELECT to_regclass('public.batches') AS t`);
  if (already.rows[0].t) throw new Error('Table "batches" already exists, so this migration looks already applied.');

  await pool.query(fs.readFileSync(file, 'utf8'));
  console.log('✅ Lead pipeline tables created.');
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
