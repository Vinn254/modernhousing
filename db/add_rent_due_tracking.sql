-- Add rent due date tracking to tenants table
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS next_due_date DATE;
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS rent_amount NUMERIC(12,2);
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS overdue_dates JSONB DEFAULT '[]'::jsonb;

-- Add due_date and overdue tracking to payments table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS due_date DATE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS is_overdue BOOLEAN DEFAULT FALSE;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS month_paid BOOLEAN DEFAULT FALSE;

-- Add indexes for performance on rent due checks
CREATE INDEX IF NOT EXISTS idx_tenants_next_due_date ON tenants(next_due_date);
CREATE INDEX IF NOT EXISTS idx_payments_due_date ON payments(due_date);
CREATE INDEX IF NOT EXISTS idx_payments_tenant_month ON payments(tenant_id, month_due);
