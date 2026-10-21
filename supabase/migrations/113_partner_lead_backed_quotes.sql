-- Allow a quote to be prepared for a partner lead before that lead becomes
-- a customer/business. Once the quote is accepted, customer setup can attach
-- the quote to businesses.id before invoice conversion.

ALTER TABLE quotes
  ALTER COLUMN business_id DROP NOT NULL;

ALTER TABLE quotes
  DROP CONSTRAINT IF EXISTS quotes_business_or_lead_check;

ALTER TABLE quotes
  ADD CONSTRAINT quotes_business_or_lead_check
  CHECK (business_id IS NOT NULL OR partner_lead_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS quotes_partner_lead_id_idx
  ON quotes (partner_lead_id);
