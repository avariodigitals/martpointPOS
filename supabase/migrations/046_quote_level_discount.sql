-- Quote-level discount on quotations: a single discount applied to the whole
-- quote on top of per-line discounts. discount_type is 'none', 'percent' or
-- 'fixed'; discount_value holds the raw input (percentage points or NGN).
ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS discount_type TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS discount_value NUMERIC(14,2) NOT NULL DEFAULT 0;

ALTER TABLE lead_quotations
  DROP CONSTRAINT IF EXISTS lead_quotations_discount_type_check;
ALTER TABLE lead_quotations
  ADD CONSTRAINT lead_quotations_discount_type_check
  CHECK (discount_type IN ('none', 'percent', 'fixed'));
