import { pgTable, serial, text, varchar, timestamp, integer, boolean } from "drizzle-orm/pg-core";

// Your master list of valid UNN CS students
export const departmentDirectory = pgTable('department_directory', {
  id: serial('id').primaryKey(),
  matricNumber: varchar('matric_number', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  hasApplied: boolean('has_applied').default(false) // We can flip this so nobody applies twice
});

// The actual applicants
export const candidates = pgTable('candidates', {
  id: serial('id').primaryKey(),
  matricNumber: varchar('matric_number', { length: 50 }).references(() => departmentDirectory.matricNumber),
  name: varchar('name', { length: 255 }).notNull(),
  projectTitle: varchar('project_title', { length: 255 }).notNull(),
  roleInProject: text('role_in_project').notNull(), // e.g., "Built the Node.js API" or "Designed the UI"
  githubLink: text('github_link'),
  skills: text('skills'),
  status: varchar('status', { length: 50 }).default('available'),
  createdAt: timestamp('created_at').defaultNow()
});

export const employerInquiries = pgTable('employer_inquiries', {
  id: serial('id').primaryKey(),
  companyName: varchar('company_name', { length: 255 }).notNull(),
  role: varchar('role', { length: 255 }).notNull(),
  candidateId: integer('candidate_id').references(() => candidates.id),
  message: text('message'),
  createdAt: timestamp('created_at').defaultNow()
});