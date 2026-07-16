-- Create audit_trails table for document signing audit trail
CREATE TABLE IF NOT EXISTS audit_trails (
    id uuid primary key default uuid_generate_v4(),
    document_id uuid references documents(id) on delete cascade,
    tenant_id uuid references tenants(id) on delete cascade,
    tenant_name text,
    tenant_email text,
    tenant_national_id text,
    ip_address text,
    device text,
    signature_type text,
    security_authentication text default 'Electronic Signature',
    disclosure_consent text,
    consent_accepted_at timestamp with time zone,
    sent_at timestamp with time zone,
    viewed_at timestamp with time zone,
    signed_at timestamp with time zone,
    completed_at timestamp with time zone,
    audit_events jsonb,
    created_at timestamp with time zone default now()
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS audit_trails_document_id_idx ON audit_trails(document_id);
CREATE INDEX IF NOT EXISTS audit_trails_tenant_id_idx ON audit_trails(tenant_id);
CREATE INDEX IF NOT EXISTS audit_trails_created_at_idx ON audit_trails(created_at DESC);