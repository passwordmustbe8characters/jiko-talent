import { defineConfig } from 'drizzle-kit';
import 'dotenv/config';

export default defineConfig({
  schema: './db/schema.js',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: (globalThis as typeof globalThis & {
      process: { env: Record<string, string | undefined> };
    }).process.env.DATABASE_URL!,
  },
  // THIS IS THE SHIELD: It tells Drizzle to only touch this one table
  tablesFilter: ['jiko_students'],
});