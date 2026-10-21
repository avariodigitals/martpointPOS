-- Commercial partner quotes need the same payment-terms block as normal
-- quotations. Existing quotes remain valid and can be updated later.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS payment_terms TEXT;
