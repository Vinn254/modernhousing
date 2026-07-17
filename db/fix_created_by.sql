-- Add created_by column to properties table if it doesn't exist
ALTER TABLE properties ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Create index for created_by queries
CREATE INDEX IF NOT EXISTS properties_created_by_idx ON properties(created_by);

-- Assign orphaned properties to users - run AFTER adding created_by column
-- Example: UPDATE properties SET created_by = '<user-id>' WHERE name = 'property250';