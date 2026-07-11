-- Add missing water meter columns to units table
ALTER TABLE units 
ADD COLUMN IF NOT EXISTS previous_water_reading numeric(12,2),
ADD COLUMN IF NOT EXISTS current_water_reading numeric(12,2),
ADD COLUMN IF NOT EXISTS last_meter_update timestamp with time zone;

-- Add water_rate to properties table (if not exists)
ALTER TABLE properties 
ADD COLUMN IF NOT EXISTS water_rate numeric(12,2) DEFAULT 150;

-- Create invoices table (if not exists)
CREATE TABLE IF NOT EXISTS invoices (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references tenants(id) on delete cascade,
    property_id uuid references properties(id) on delete cascade,
    invoice_type text not null check (invoice_type in ('rent', 'water', 'utility', 'other')),
    description text,
    amount numeric(12,2) not null,
    water_consumption numeric(12,2),
    due_date date,
    status text not null default 'sent' check (status in ('sent', 'downloaded', 'paid', 'overdue')),
    month_due text,
    created_at timestamp with time zone default now()
);

-- Add payment_method to payments table (if not exists)
ALTER TABLE payments 
ADD COLUMN IF NOT EXISTS payment_method text;

-- Update invoices check constraint to include all utility types
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_invoice_type_check,
ADD CONSTRAINT invoices_invoice_type_check 
CHECK (invoice_type in ('rent', 'water', 'utility', 'other', 'garbage', 'service_charge', 'parking', 'security'));

-- Add organization_id to payment_settings if column does not exist
ALTER TABLE payment_settings 
ADD COLUMN IF NOT EXISTS organization_id uuid references organizations(id) on delete cascade;

-- Add index for payment_settings organization_id
CREATE INDEX IF NOT EXISTS payment_settings_org_id_idx ON payment_settings(organization_id);

-- Add ID fields to tenants table
ALTER TABLE tenants 
ADD COLUMN IF NOT EXISTS national_id text,
ADD COLUMN IF NOT EXISTS kra_pin text,
ADD COLUMN IF NOT EXISTS next_of_kin_id text;

-- Create bills/transactions table for monthly rent and utility tracking
CREATE TABLE IF NOT EXISTS bills (
    id uuid primary key default uuid_generate_v4(),
    tenant_id uuid references tenants(id) on delete cascade,
    unit_id uuid references units(id) on delete set null,
    property_id uuid references properties(id) on delete set null,
    description text not null,
    month_due text,
    due_amount numeric(12,2) not null default 0,
    paid_amount numeric(12,2) not null default 0,
    penalty_fee numeric(12,2) default 0,
    balance numeric(12,2) not null default 0,
    transaction_type text not null check (transaction_type in ('deposit', 'rent', 'overdue', 'water', 'service_charge', 'utility', 'other', 'garbage', 'parking', 'security')),
    transaction_number text,
    transaction_code text,
    payment_date date,
    payment_method text,
    reference_number text,
    created_at timestamp with time zone default now()
);

-- Update bills transaction_type constraint to include overdue (run after table exists)
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_transaction_type_check;
ALTER TABLE bills ADD CONSTRAINT bills_transaction_type_check 
CHECK (transaction_type in ('deposit', 'rent', 'overdue', 'water', 'service_charge', 'utility', 'other', 'garbage', 'parking', 'security'));