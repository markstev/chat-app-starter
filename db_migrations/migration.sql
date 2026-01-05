-- Complete database migration for ChatGPT Apps SDK Next.js Starter
-- This migration creates all tables, relationships, and RLS policies
-- Run this script against your empty PostgreSQL database

-- Enable the pgcrypto extension for UUID generation
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enums
CREATE TYPE "todo_status" AS ENUM('pending', 'in_progress', 'completed', 'cancelled');
CREATE TYPE "message_role" AS ENUM('system', 'user', 'assistant');

-- Create the posts table
CREATE TABLE "posts" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid()),
	"title" text NOT NULL,
	"content" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create the standup table
CREATE TABLE "standup" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid()),
	"user_id" text NOT NULL,
	"date" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create the todos table
CREATE TABLE "todos" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid()),
	"user_id" text NOT NULL,
	"text" text NOT NULL,
	"parent_todo_id" text,
	"status" "todo_status" DEFAULT 'pending' NOT NULL,
	"standup_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create the dev_session table
CREATE TABLE "dev_session" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid()),
	"name" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Create the dev_message table
CREATE TABLE "dev_message" (
	"id" text PRIMARY KEY DEFAULT (gen_random_uuid()),
	"content" text NOT NULL,
	"structured_content" jsonb,
	"widget_id" text,
	"role" "message_role" NOT NULL,
	"session_id" text NOT NULL,
	"user_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);

-- Add foreign key constraints
-- Self-referencing foreign key for parent-child relationship in todos
ALTER TABLE "todos" ADD CONSTRAINT "todos_parent_todo_id_todos_id_fk" 
FOREIGN KEY ("parent_todo_id") REFERENCES "todos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Foreign key from todos to standup
ALTER TABLE "todos" ADD CONSTRAINT "todos_standup_id_standup_id_fk" 
FOREIGN KEY ("standup_id") REFERENCES "standup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Foreign key from dev_message to dev_session
ALTER TABLE "dev_message" ADD CONSTRAINT "dev_message_session_id_dev_session_id_fk" 
FOREIGN KEY ("session_id") REFERENCES "dev_session"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes for better performance
CREATE INDEX "posts_user_id_idx" ON "posts" ("user_id");
CREATE INDEX "standup_user_id_idx" ON "standup" ("user_id");
CREATE INDEX "todos_user_id_idx" ON "todos" ("user_id");
CREATE INDEX "todos_parent_todo_id_idx" ON "todos" ("parent_todo_id");
CREATE INDEX "todos_standup_id_idx" ON "todos" ("standup_id");
CREATE INDEX "todos_status_idx" ON "todos" ("status");
CREATE INDEX "dev_session_user_id_idx" ON "dev_session" ("user_id");
CREATE INDEX "dev_message_session_id_idx" ON "dev_message" ("session_id");
CREATE INDEX "dev_message_user_id_idx" ON "dev_message" ("user_id");
CREATE INDEX "dev_message_role_idx" ON "dev_message" ("role");

-- Create function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply the trigger to all tables
CREATE TRIGGER update_posts_updated_at BEFORE UPDATE ON "posts" 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_standup_updated_at BEFORE UPDATE ON "standup" 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_todos_updated_at BEFORE UPDATE ON "todos" 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dev_session_updated_at BEFORE UPDATE ON "dev_session" 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dev_message_updated_at BEFORE UPDATE ON "dev_message" 
	FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add check constraint to prevent circular references in todos
ALTER TABLE "todos" ADD CONSTRAINT "todos_no_self_reference" 
CHECK ("parent_todo_id" != "id");

-- Enable Row Level Security on all tables with user_id
ALTER TABLE "posts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "standup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "todos" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dev_session" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "dev_message" ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for all tables with user_id
-- Each policy uses FOR ALL to cover SELECT, INSERT, UPDATE, and DELETE operations

CREATE POLICY "posts_policy" ON "posts"
	FOR ALL
	USING ("user_id" = current_setting('app.current_user_id', TRUE))
	WITH CHECK ("user_id" = current_setting('app.current_user_id', TRUE));

CREATE POLICY "standup_policy" ON "standup"
	FOR ALL
	USING ("user_id" = current_setting('app.current_user_id', TRUE))
	WITH CHECK ("user_id" = current_setting('app.current_user_id', TRUE));

CREATE POLICY "todos_policy" ON "todos"
	FOR ALL
	USING ("user_id" = current_setting('app.current_user_id', TRUE))
	WITH CHECK ("user_id" = current_setting('app.current_user_id', TRUE));

CREATE POLICY "dev_session_policy" ON "dev_session"
	FOR ALL
	USING ("user_id" = current_setting('app.current_user_id', TRUE))
	WITH CHECK ("user_id" = current_setting('app.current_user_id', TRUE));

CREATE POLICY "dev_message_policy" ON "dev_message"
	FOR ALL
	USING ("user_id" = current_setting('app.current_user_id', TRUE))
	WITH CHECK ("user_id" = current_setting('app.current_user_id', TRUE));

-- Note: To use these RLS policies, you need to set the user_id in each database session:
-- SET LOCAL app.current_user_id = 'user_id_from_clerk';
-- This should be done at the beginning of each database transaction in your application code.
-- The application uses the withUserContext helper function from server/db/index.ts to handle this automatically.
