// backend/db/schema.js
import { pgTable, serial, varchar, text, timestamp } from 'drizzle-orm/pg-core';

export const students = pgTable('jiko_students', {
  id: serial('id').primaryKey(),
  matricNumber: varchar('matric_number', { length: 50 }).notNull().unique(),
  name: varchar('name', { length: 255 }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(), // NEW: Contact Email
  whatsappNumber: varchar('whatsapp_number', { length: 20 }).notNull(), // NEW: WhatsApp
  projectTitle: varchar('project_title', { length: 255 }), // Can be empty for teammates
  roleInProject: varchar('role_in_project', { length: 255 }).notNull(),
  isGroupProject: varchar('is_group_project', { length: 10 }), // NEW: 'Yes' or 'No'
  groupId: varchar('group_id', { length: 100 }), // NEW: To link teammates together
  githubLink: text('github_link'), 
  driveLink: text('drive_link'), // NEW: For the Report/Demo/Assets
  skills: text('skills'),
  createdAt: timestamp('created_at').defaultNow()
});
// ADD THIS: Reference to your existing live directory
export const departmentDirectory = pgTable('department_directory', {
  // Assuming the column is named 'matric_number' based on your other tables
  matricNumber: varchar('matric_number', { length: 50 }).primaryKey(), 
});