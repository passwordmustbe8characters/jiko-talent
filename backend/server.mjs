import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import crypto from 'crypto'; // Native Node module to generate unique Group IDs
import { eq } from 'drizzle-orm'; 
import { db } from './db/index.js';
import adminRoutes from './src/lead-pipeline/admin/routes.mjs';
import { students, departmentDirectory } from './db/schema.js';
import { pool } from './src/lead-pipeline/db.mjs';
import { saveStudentTags } from './src/lead-pipeline/studentTags.mjs';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: 'http://localhost:5173' }));
app.use(express.json());
app.use('/api/admin', adminRoutes);

app.post('/api/apply', async (req, res) => {
  try {
    const { 
      matricNumber, name, email, whatsappNumber, roleInProject, 
      isGroupProject, driveLink, githubLink, skills, 
      teamGroupId, // This comes from the viral link URL
      shareConsent // 'Yes' or 'No': may we share this profile with employers?
    } = req.body;

    // 0. BASIC CHECKS (skills now required for everyone, teammates included)
    if (!skills || !String(skills).trim()) {
      return res.status(400).json({ error: "Please select at least one skill." });
    }
    if (!['Yes', 'No'].includes(shareConsent)) {
      return res.status(400).json({ error: "Please answer whether we may share your profile with employers." });
    }

    // 1. LIVE VETTING
    const validStudent = await db
      .select()
      .from(departmentDirectory)
      .where(eq(departmentDirectory.matricNumber, matricNumber))
      .limit(1);

    if (validStudent.length === 0) {
      return res.status(403).json({ 
        error: "Access Denied: Your matriculation number was not found in the department directory." 
      });
    }

    let finalGroupId = null;
    let finalProjectTitle = req.body.projectTitle;

    // 2. VIRAL LOOP LOGIC (TEAMMATE VS LEAD)
    if (teamGroupId) {
      // It's a Teammate! Look up the Lead's project to copy the title
      const leadRecord = await db.select().from(students).where(eq(students.groupId, teamGroupId)).limit(1);
      if (leadRecord.length === 0) {
        return res.status(400).json({ error: "Invalid Invite Link. Group not found." });
      }
      finalGroupId = teamGroupId;
      finalProjectTitle = leadRecord[0].projectTitle; // Inherit from Lead so it passes the notNull() check
    } else {
      // It's a Solo or Team Lead!
      if (isGroupProject === 'Yes') {
        finalGroupId = `grp_${crypto.randomBytes(4).toString('hex')}`; // e.g., grp_8f72a4b1
      }
    }

    // 3. INSERT INTO POSTGRESQL
    await db.insert(students).values({
      matricNumber,
      name,
      email,
      whatsappNumber,
      projectTitle: finalProjectTitle,
      roleInProject,
      isGroupProject: isGroupProject || 'No',
      groupId: finalGroupId,
      driveLink: driveLink || null,
      githubLink: githubLink || null,
      skills: skills || null
    });

    // 4. SAVE TAGS + CONSENT (never blocks the application if it fails)
    try {
      const { rows } = await pool.query('SELECT id FROM jiko_students WHERE matric_number = $1', [matricNumber]);
      if (rows[0]) {
        await saveStudentTags(rows[0].id, { roleInProject, skills, projectTitle: finalProjectTitle, shareConsent });
      }
    } catch (tagError) {
      console.error('Tagging failed (application was still saved):', tagError.message);
    }

    console.log(`✅ Profile saved for: ${matricNumber} | Group: ${finalGroupId || 'Solo'}`);
    
    // Return the groupId to the frontend so it can generate the shareable link!
    res.status(200).json({ 
      message: "Profile successfully saved to database.",
      generatedGroupId: finalGroupId 
    });

  } catch (error) {
    console.error("Database Insert Error:", error);
    // Drizzle wraps database errors, so the Postgres code can be on error.cause
    const pgCode = error.code ?? error.cause?.code;
    if (pgCode === '23505') {
      return res.status(400).json({ error: "A profile has already been submitted for this matriculation number or email." });
    }
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Jiko Talent Backend running on http://localhost:${PORT}`);
});