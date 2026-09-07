-- Lead Quotations: standalone quotes for pre-sale leads.
-- Public access is by secret token (UUID) so leads can view, share and respond.

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_quotations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  quote_number TEXT NOT NULL UNIQUE,
  title TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED')),
  currency TEXT NOT NULL DEFAULT 'NGN',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes_public TEXT,
  notes_internal TEXT,
  public_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  token_expires_at TIMESTAMPTZ,
  viewed_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS lead_quotation_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES lead_quotations(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS lead_quotation_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_lead_quote_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO lead_quotation_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = lead_quotation_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPLQ-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS lead_quotations_lead_id_idx ON lead_quotations (lead_id);
CREATE INDEX IF NOT EXISTS lead_quotations_status_idx ON lead_quotations (status);
CREATE INDEX IF NOT EXISTS lead_quotations_public_token_idx ON lead_quotations (public_token);
CREATE INDEX IF NOT EXISTS lead_quotation_items_quotation_id_idx ON lead_quotation_items (quotation_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE lead_quotations ENABLE ROW LEVEL SECURITY;
ALTER TABLE lead_quotation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_lead_quotations_all" ON lead_quotations;
CREATE POLICY "sr_lead_quotations_all" ON lead_quotations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_lead_quotation_items_all" ON lead_quotation_items;
CREATE POLICY "sr_lead_quotation_items_all" ON lead_quotation_items FOR ALL TO service_role USING (true) WITH CHECK (true);
