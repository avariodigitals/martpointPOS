-- Add configurable tax rates for quotations and invoices.
CREATE TABLE IF NOT EXISTS tax_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  rate NUMERIC(5,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed common Nigerian tax rates. Avoid duplicates if rerun.
INSERT INTO tax_rates (name, rate, is_active) VALUES
  ('VAT 7.5%', 7.5, true),
  ('Zero Rated 0%', 0, true),
  ('Standard 5%', 5, true),
  ('Standard 10%', 10, true)
ON CONFLICT DO NOTHING;

-- Add tax_rate to quotation line items so quotes remember the applied rate.
ALTER TABLE lead_quotation_items
  ADD COLUMN IF NOT EXISTS tax_rate NUMERIC(5,2);
