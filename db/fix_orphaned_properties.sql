-- Run this SQL to assign orphaned properties to landlords
-- Step 1: Find the landlord user by email and get their ID
-- Replace 'landlord@example.com' with the actual landlord email
SELECT u.id, u.email, p.organization_id 
FROM auth.users u
JOIN profiles p ON p.user_id = u.id
WHERE p.role = 'project_manager' AND u.email = 'landlord@example.com';

-- Step 2: If no organization_id exists, create one for this landlord
-- First get the user_id from step 1
-- INSERT INTO organizations (id, name) VALUES (gen_random_uuid(), 'Landlord Name Organization');
-- Then update profile with:
-- UPDATE profiles SET organization_id = '<org-id>' WHERE user_id = '<user-id>';

-- Step 3: Assign orphaned properties (organization_id IS NULL) to this landlord's organization
UPDATE properties 
SET organization_id = '<org-id>'
WHERE id IN (
  SELECT p.id FROM properties p WHERE p.organization_id IS NULL
);

-- Alternatively, to see all orphaned properties:
SELECT id, name, address FROM properties WHERE organization_id IS NULL;