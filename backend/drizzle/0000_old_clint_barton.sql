CREATE TABLE "jiko_students" (
	"id" serial PRIMARY KEY NOT NULL,
	"matric_number" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"project_title" varchar(255) NOT NULL,
	"role_in_project" varchar(255) NOT NULL,
	"github_link" text NOT NULL,
	"skills" text NOT NULL,
	"demo_link" text,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "jiko_students_matric_number_unique" UNIQUE("matric_number")
);
