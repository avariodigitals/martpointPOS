-- Commercial partner quote lines need the same tax-rate semantics as normal
-- quotations. NULL means a fixed tax amount; 0 means explicitly no tax.
ALTER TABLE quote_items
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);

CREATE INDEX IF NOT EXISTS quote_items_tax_rate_idx
  ON quote_items (tax_rate);
