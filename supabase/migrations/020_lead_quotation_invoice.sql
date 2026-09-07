-- Lead quotation → invoice conversion support and payment terms.

ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS payment_terms TEXT,
  ADD COLUMN IF NOT EXISTS converted_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS converted_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL;

-- Replace any existing status check constraint with one that includes CONVERTED.
DO $$
DECLARE
  conname TEXT;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname = 'lead_quotations'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%'
    AND pg_get_constraintdef(c.oid) LIKE '%CHECK%'
  LIMIT 1;

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE lead_quotations DROP CONSTRAINT %I', conname);
  END IF;
END $$;

ALTER TABLE lead_quotations ADD CONSTRAINT lead_quotations_status_check
  CHECK (status IN ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','CONVERTED'));

CREATE INDEX IF NOT EXISTS lead_quotations_converted_business_id_idx ON lead_quotations (converted_business_id);
CREATE INDEX IF NOT EXISTS lead_quotations_converted_invoice_id_idx ON lead_quotations (converted_invoice_id);
