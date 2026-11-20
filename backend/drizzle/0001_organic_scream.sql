CREATE TABLE "department_directory" (
	"matric_number" varchar(50) PRIMARY KEY NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jiko_students" ALTER COLUMN "project_title" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jiko_students" ALTER COLUMN "github_link" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jiko_students" ALTER COLUMN "skills" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "jiko_students" ADD COLUMN "email" varchar(255) NOT NULL;--> statement-breakpoint
ALTER TABLE "jiko_students" ADD COLUMN "whatsapp_number" varchar(20) NOT NULL;--> statement-breakpoint
ALTER TABLE "jiko_students" ADD COLUMN "is_group_project" varchar(10);--> statement-breakpoint
ALTER TABLE "jiko_students" ADD COLUMN "group_id" varchar(100);--> statement-breakpoint
ALTER TABLE "jiko_students" ADD COLUMN "drive_link" text;--> statement-breakpoint
ALTER TABLE "jiko_students" DROP COLUMN "demo_link";--> statement-breakpoint
ALTER TABLE "jiko_students" ADD CONSTRAINT "jiko_students_email_unique" UNIQUE("email");