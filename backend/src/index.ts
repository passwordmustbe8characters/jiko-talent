import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Client } from 'pg';
import { eq } from 'drizzle-orm';
import { departmentDirectory, candidates } from './db/schema';

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Initialize Database Connection
const client = new Client({
  connectionString: process.env.DATABASE_URL,
});
client.connect();
const db = drizzle(client);

// Basic health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'Jiko Talent API is running!' });
});

// The Student Application Endpoint
app.post('/api/apply', async (req, res): Promise<any> => {
  try {
    const { matricNumber, name, projectTitle, roleInProject, githubLink, skills } = req.body;

    // 1. Verify the student exists in your UNN CS master list
    const studentRecord = await db
      .select()
      .from(departmentDirectory)
      .where(eq(departmentDirectory.matricNumber, matricNumber));

    if (studentRecord.length === 0) {
      return res.status(403).json({ 
        error: 'Verification failed: Matriculation number not found in the UNN CS directory.' 
      });
    }

    // 2. Prevent duplicate applications from the same student
    if (studentRecord[0].hasApplied) {
      return res.status(400).json({ 
        error: 'An application with this matriculation number has already been submitted.' 
      });
    }

    // 3. Save the valid application to the candidates table
    await db.insert(candidates).values({
      matricNumber,
      name,
      projectTitle,
      roleInProject,
      githubLink,
      skills
    });

    // 4. Update the directory to lock this matric number from applying again
    await db.update(departmentDirectory)
      .set({ hasApplied: true })
      .where(eq(departmentDirectory.matricNumber, matricNumber));

    res.status(201).json({ message: 'Application submitted successfully!' });

  } catch (error) {
    console.error('Application error:', error);
    res.status(500).json({ error: 'Internal server error while processing application.' });
  }
});

app.listen(port, () => {
  console.log(`Server is listening on port ${port}`);
});