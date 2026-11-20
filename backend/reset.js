import pkg from 'pg';
import 'dotenv/config';

const { Client } = pkg;

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  // This ONLY deletes the test students table. Your directory remains safe.
  await client.query('DROP TABLE IF EXISTS jiko_students CASCADE;');
  
  console.log("✅ Old jiko_students table completely wiped.");
  await client.end();
}
run();