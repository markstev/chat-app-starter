-- Migration to add index column to domains table
-- This adds an index field to domains for ordering lessons

-- Add index column if it doesn't exist
DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1 FROM information_schema.columns 
		WHERE table_name = 'domains' AND column_name = 'index'
	) THEN
		ALTER TABLE "domains" ADD COLUMN "index" integer;
	END IF;
END $$;

