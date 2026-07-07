-- Run this SQL in Supabase SQL editor to assign existing properties to landlords
-- REPLACE 'PROPERTY_NAME_OR_ID' with actual property names/IDs and emails with actual landlords

-- First, create organizations for landlords without them
INSERT INTO organizations (name)
SELECT DISTINCT p.name || ' Organization'
FROM profiles p
WHERE p.role = 'project_manager' AND p.organization_id IS NULL
ON CONFLICT DO NOTHING;

-- Update profiles with their organization IDs
UPDATE profiles 
SET organization_id = org.id
FROM (
  SELECT 
    p.id as profile_id,
    p.email,
    o.id as org_id
  FROM profiles p
  JOIN organizations o ON o.name = p.email || ' Organization'
  WHERE p.role = 'project_manager' AND p.organization_id IS NULL
) AS org
WHERE profiles.id = org.profile_id;

-- Assign properties to landlords by matching email in ownership_info or other logic
-- You need to manually specify which properties belong to which landlord
-- Example (adjust as needed):
-- UPDATE properties SET organization_id = (SELECT id FROM organizations WHERE name = 'johnson254@gmail.com Organization') WHERE ...;
-- UPDATE properties SET organization_id = (SELECT id FROM organizations WHERE name = 'test1@gmail.com Organization') WHERE ...;

-- Verify assignment
SELECT 
  pr.name as property,
  o.name as organization,
  p.email as landlord_email
FROM properties pr
JOIN organizations o ON pr.organization_id = o.id
JOIN profiles p ON o.id = p.organization_id
WHERE pr.organization_id IS NOT NULL;