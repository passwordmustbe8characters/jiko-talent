// Adds clearly-fake test students so you can try batching and the admin screens.
//   node src/lead-pipeline/scripts/seed-test-students.mjs --yes      add 32 fake students
//   node src/lead-pipeline/scripts/seed-test-students.mjs --clean    remove every fake student again
// Fake students use matric numbers like TEST/0001 and emails ending @example.invalid,
// so they can never be confused with real applicants. They all "agree" to sharing.
import { pool, closeDb } from '../db.mjs';
import { saveStudentTags } from '../studentTags.mjs';

const args = process.argv.slice(2);

const PROFILES = [
  ['Frontend Developer', 'React, JavaScript, HTML/CSS, Tailwind CSS', 'Campus e-learning platform', 7],
  ['Frontend Developer', 'React, TypeScript, Next.js, Figma', 'Online shop for local fashion brands', 4],
  ['Backend Developer', 'Node.js, Express, PostgreSQL, REST APIs', 'Loan management app for small businesses', 5],
  ['Backend Developer', 'Python, Django, MySQL, Docker', 'Hospital appointment booking system', 3],
  ['Full Stack Developer', 'React, Node.js, MongoDB, JavaScript', 'Farm produce marketplace', 4],
  ['Data Analyst', 'Python, Pandas/NumPy, Power BI/Tableau, SQL, Excel', 'Student performance dashboard', 3],
  ['AI Developer', 'Python, Machine Learning, Deep Learning, NLP', 'Crop disease detection with machine learning', 2],
  ['Mobile App Developer', 'Flutter, Firebase, Kotlin', 'Delivery tracking app for riders', 2],
  ['UI/UX Designer', 'Figma, UI/UX Design, Graphic Design', 'Redesign of a bank mobile app', 1],
  ['Cybersecurity Analyst', 'Networking, Cybersecurity, Linux', 'Network intrusion detection system', 1],
];

try {
  if (args.includes('--clean')) {
    const { rowCount } = await pool.query(`DELETE FROM jiko_students WHERE matric_number LIKE 'TEST/%'`);
    const empty = await pool.query(
      `DELETE FROM batches b
       WHERE b.notes LIKE 'Auto-batched%'
         AND NOT EXISTS (SELECT 1 FROM batch_students bs WHERE bs.batch_id = b.id)
         AND NOT EXISTS (SELECT 1 FROM batch_leads bl WHERE bl.batch_id = b.id)`
    );
    console.log(`✅ Removed ${rowCount} fake student(s) and ${empty.rowCount} empty auto-created batch(es).`);
  } else if (args.includes('--yes')) {
    let n = 0;
    for (const [role, skills, title, count] of PROFILES) {
      for (let i = 0; i < count; i++) {
        n += 1;
        const num = String(n).padStart(4, '0');
        const { rowCount } = await pool.query(
          `INSERT INTO jiko_students (matric_number, name, email, whatsapp_number, project_title, role_in_project, is_group_project, skills)
           VALUES ($1, $2, $3, '0000000000', $4, $5, 'No', $6)
           ON CONFLICT (matric_number) DO NOTHING`,
          [`TEST/${num}`, `TEST Student ${num}`, `test${num}@example.invalid`, title, role, skills]
        );
        if (rowCount) {
          const { rows } = await pool.query(`SELECT id FROM jiko_students WHERE matric_number = $1`, [`TEST/${num}`]);
          await saveStudentTags(rows[0].id, { roleInProject: role, skills, projectTitle: title, shareConsent: 'Yes' });
        }
      }
    }
    console.log(`✅ Added up to ${n} fake students (existing ones were skipped). Now click "Find new batches" in /admin.`);
    console.log('   Remove them later with:  node src/lead-pipeline/scripts/seed-test-students.mjs --clean');
  } else {
    console.log('This adds 32 FAKE students to your database for testing. Run with --yes to proceed, or --clean to remove them.');
  }
} catch (err) {
  console.error('❌ Failed:', err.message);
  process.exitCode = 1;
} finally {
  await closeDb();
}
