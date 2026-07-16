-- Add shortcode column to payment_settings table
ALTER TABLE payment_settings ADD COLUMN IF NOT EXISTS shortcode text;

-- Add new utility types to bills table
ALTER TABLE bills 
DROP CONSTRAINT IF EXISTS bills_transaction_type_check;

ALTER TABLE bills ADD CONSTRAINT bills_transaction_type_check 
CHECK (transaction_type in ('deposit', 'rent', 'overdue', 'tenancy_agreement', 'water', 'service_charge', 'utility', 'other', 'garbage', 'parking', 'security', 'internet', 'laundry', 'pet_fees'));

-- Add new utility types to invoices table if needed
ALTER TABLE invoices 
DROP CONSTRAINT IF EXISTS invoices_invoice_type_check;

ALTER TABLE invoices ADD CONSTRAINT invoices_invoice_type_check 
CHECK (invoice_type in ('rent', 'water', 'utility', 'other', 'garbage', 'service_charge', 'parking', 'security', 'internet', 'laundry', 'pet_fees'));

-- Update payments table to allow all transaction types (already flexible, but adding for clarity)
-- The payments table doesn't have a check constraint, so no changes needed there