import pkg from 'pg';
import 'dotenv/config';

const { Client } = pkg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  
  try {
    await client.connect();
    
    await client.query(`
      CREATE TABLE jiko_students (
        id SERIAL PRIMARY KEY,
        matric_number VARCHAR(50) NOT NULL UNIQUE,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) NOT NULL UNIQUE,
        whatsapp_number VARCHAR(20) NOT NULL,
        project_title VARCHAR(255),
        role_in_project VARCHAR(255) NOT NULL,
        is_group_project VARCHAR(10),
        group_id VARCHAR(100),
        github_link TEXT,
        drive_link TEXT,
        skills TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    console.log("✅ jiko_students table perfectly built from scratch!");
  } catch (err) {
    console.error("❌ Error building table:", err.message);
  } finally {
    await client.end();
  }
}

run();