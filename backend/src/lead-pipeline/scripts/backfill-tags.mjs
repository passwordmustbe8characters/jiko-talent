// Usage (from backend/):  node src/lead-pipeline/scripts/backfill-tags.mjs
// Creates tags for students who applied before tagging existed (e.g. test entries).
// Consent is recorded as NOT given for these students, because they were never asked.
import { pool, closeDb } from '../db.mjs';
import { saveStudentTags } from '../studentTags.mjs';

try {
  const { rows } = await pool.query(
    `SELECT s.id, s.role_in_project, s.skills, s.project_title
     FROM jiko_students s LEFT JOIN student_tags t ON t.student_id = s.id
     WHERE t.id IS NULL`
  );
  for (const r of rows) {
    const t = await saveStudentTags(r.id, {
      roleInProject: r.role_in_project, skills: r.skills, projectTitle: r.project_title, shareConsent: 'No',
    });
    console.log(`student ${r.id}: ${t.roleFamily} | ${t.techTags.join(', ') || '(no skills)'} | ${t.domainTags.join(', ') || '(no domain)'}`);
  }
  console.log(`✅ Backfilled ${rows.length} student(s).`);
} catch (err) {
  console.error('❌ Backfill failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
