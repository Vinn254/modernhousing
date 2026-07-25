-- Migration to make next_of_kin_relationship optional (remove check constraint)
-- Run this on existing databases to fix the constraint

-- Remove the check constraint on next_of_kin_relationship
-- Note: The exact constraint name may vary depending on Supabase version

-- First, check if constraint exists and drop it
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'tenants_next_of_kin_relationship_check' 
    AND conrelid = 'tenants'::regclass
  ) THEN
    ALTER TABLE tenants DROP CONSTRAINT tenants_next_of_kin_relationship_check;
  END IF;
END $$;

-- If the column has a constraint and we can't drop it directly, we may need to recreate the table
-- For PostgreSQL 11+, we can use:
-- ALTER TABLE tenants ALTER COLUMN next_of_kin_relationship DROP NOT NULL;
-- ALTER TABLE tenants ALTER COLUMN next_of_kin_relationship DROP DEFAULT;

-- For now, just ensure the column allows any text value (including empty or null)
-- This schema change was already applied to schema.sql
ALTER TABLE tenants ALTER COLUMN next_of_kin_relationship TYPE text;