// Saves a student's tags and employer-sharing consent into student_tags.
// Called from /api/apply after the student is saved. If this fails, the application still stands.
import { pool } from './db.mjs';
import { buildStudentTags } from './tags.mjs';

export async function saveStudentTags(studentId, { roleInProject, skills, projectTitle, shareConsent }) {
  const t = buildStudentTags({ roleInProject, skills, projectTitle });
  const consent = shareConsent === 'Yes';
  await pool.query(
    `INSERT INTO student_tags
       (student_id, role_family, tech_tags, domain_tags, project_summary, outreach_consent, consent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (student_id) DO UPDATE SET
       role_family = EXCLUDED.role_family,
       tech_tags = EXCLUDED.tech_tags,
       domain_tags = EXCLUDED.domain_tags,
       project_summary = EXCLUDED.project_summary,
       outreach_consent = EXCLUDED.outreach_consent,
       consent_at = EXCLUDED.consent_at`,
    [studentId, t.roleFamily, t.techTags, t.domainTags, t.projectSummary, consent, consent ? new Date() : null]
  );
  return t;
}
