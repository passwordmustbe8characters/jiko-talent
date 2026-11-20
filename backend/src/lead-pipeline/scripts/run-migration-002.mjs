// Usage (from backend/):  node src/lead-pipeline/scripts/run-migration-002.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { pool, closeDb } from '../db.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
try {
  const { rows } = await pool.query(
    `SELECT 1 FROM information_schema.columns WHERE table_name = 'leads' AND column_name = 'kind'`);
  if (rows.length) {
    console.log('Migration 002 was already applied. Nothing to do.');
  } else {
    await pool.query(fs.readFileSync(path.join(here, '..', 'migrations', '002_outreach.sql'), 'utf8'));
    console.log('✅ Migration 002 applied.');
  }
} catch (err) {
  console.error('❌ Migration failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
