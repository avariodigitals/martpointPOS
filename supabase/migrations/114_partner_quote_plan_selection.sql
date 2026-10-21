-- Keep the partner's requested commercial plan linked to the live plan catalog.
-- plan_name remains for historical/display compatibility.

ALTER TABLE partner_quote_requests
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS pqr_plan_id_idx
  ON partner_quote_requests (plan_id);
