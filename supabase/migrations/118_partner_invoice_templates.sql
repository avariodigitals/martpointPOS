-- Carry the same industry-aware commercial context from a partner quote into
-- the invoice that follows it. These are snapshots: changing the settings or
-- template later must not rewrite an already issued document.

ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS template_industry TEXT;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS bank_details TEXT,
  ADD COLUMN IF NOT EXISTS template_industry TEXT;

-- A customer assignment can be paused without deleting the relationship
-- history. This is distinct from permanently moving/revoking the assignment.
ALTER TABLE partner_customer_assignments
  DROP CONSTRAINT IF EXISTS partner_customer_assignments_status_check;

ALTER TABLE partner_customer_assignments
  ADD CONSTRAINT partner_customer_assignments_status_check
  CHECK (status IN ('ACTIVE','SUSPENDED','EXPIRED','REVOKED'));
