-- External platform dedupe key for ad-platform leads (TikTok lead_id, Meta leadgen_id, ...)
ALTER TABLE leads ADD COLUMN IF NOT EXISTS external_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS leads_external_id_unique
  ON leads (external_id)
  WHERE external_id IS NOT NULL;
