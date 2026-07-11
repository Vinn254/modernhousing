-- Create documents table for agreement workflow
CREATE TABLE IF NOT EXISTS documents (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references tenants(id) on delete cascade,
    property_id uuid references properties(id) on delete set null,
    uploaded_by uuid references profiles(id) on delete set null,
    document_name text not null,
    document_url text not null,
    document_type text not null check (document_type in ('agreement', 'id_document', 'signed_agreement')),
    status text not null default 'sent' check (status in ('sent', 'downloaded', 'awaiting_signature', 'signed', 'approved', 'rejected')),
    notes text,
    created_at timestamp with time zone default now(),
    updated_at timestamp with time zone default now()
);

-- Add signed agreement URL to tenants table (optional quick reference)
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS signed_agreement_url text,
ADD COLUMN IF NOT EXISTS id_document_url text,
ADD COLUMN IF NOT EXISTS passport_photo_url text;