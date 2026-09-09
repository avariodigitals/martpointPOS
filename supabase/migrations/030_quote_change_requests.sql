-- Quote change requests: lets a lead request scope changes or make a counter-offer
-- on a quotation, gated per-quote by the admin at send time.

-- ═══════════════════════════════════════════════════════════════════════════════
-- EXTEND lead_quotations
-- ═══════════════════════════════════════════════════════════════════════════════

-- Add new statuses to the existing check constraint.
ALTER TABLE lead_quotations
  DROP CONSTRAINT IF EXISTS lead_quotations_status_check;
ALTER TABLE lead_quotations
  ADD CONSTRAINT lead_quotations_status_check
  CHECK (status IN (
    'DRAFT', 'SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'CONVERTED',
    'CHANGE_REQUESTED', 'COUNTER_OFFERED', 'REVISED'
  ));

-- allow_changes:  when true, the public quote page shows a "Request changes" flow.
-- allow_counter_offer: when true (and allow_changes true), the page also shows a
-- "Make counter-offer" flow where the lead proposes a total + notes.
ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS allow_changes BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE lead_quotations
  ADD COLUMN IF NOT EXISTS allow_counter_offer BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHANGE REQUESTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_quote_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quotation_id UUID NOT NULL REFERENCES lead_quotations(id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN ('scope', 'counter_offer')),
  -- For 'scope': array of { item_id, description, quantity } for the items the
  --   lead wants to keep, with adjusted quantities. Removed items are simply
  --   omitted from the array. Also carries proposed_budget + notes.
  -- For 'counter_offer': { proposed_total } + notes.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  client_note TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'declined')),
  admin_note TEXT,
  resolved_by TEXT,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS lead_quote_change_requests_quotation_id_idx
  ON lead_quote_change_requests (quotation_id);
CREATE INDEX IF NOT EXISTS lead_quote_change_requests_status_idx
  ON lead_quote_change_requests (status);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE lead_quote_change_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_lead_quote_change_requests_all" ON lead_quote_change_requests;
CREATE POLICY "sr_lead_quote_change_requests_all" ON lead_quote_change_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ═══════════════════════════════════════════════════════════════════════════════
-- UPDATED_AT TRIGGER
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS lead_quote_change_requests_updated_at
  ON lead_quote_change_requests;
CREATE TRIGGER lead_quote_change_requests_updated_at
  BEFORE UPDATE ON lead_quote_change_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
