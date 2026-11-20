// Put this in backend/src/lead-pipeline/scripts/ and run from backend/:
//   node src/lead-pipeline/scripts/peek-skills.mjs
// Prints ONLY role, skills, project title and team type. No names, emails, WhatsApp numbers or matric numbers.
// Safe to paste the output into the chat.
import { pool, closeDb } from '../db.mjs';

try {
  const total = await pool.query('SELECT count(*)::int AS n FROM jiko_students');
  const types = await pool.query(
    `SELECT COALESCE(is_group_project, 'unknown') AS is_group_project, count(*)::int AS n
     FROM jiko_students GROUP BY 1 ORDER BY 2 DESC`
  );
  const rows = await pool.query(
    `SELECT role_in_project, skills, project_title, is_group_project
     FROM jiko_students
     ORDER BY created_at DESC
     LIMIT 40`
  );

  console.log(`Total students: ${total.rows[0].n}`);
  console.log('By team type:', JSON.stringify(types.rows));
  console.log('\n--- latest 40 (role | skills | project title | group?) ---');
  for (const r of rows.rows) {
    console.log(
      [r.role_in_project ?? '-', r.skills ?? '(no skills)', r.project_title ?? '(no title)', r.is_group_project ?? '-'].join(' | ')
    );
  }
} catch (err) {
  console.error('Failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
