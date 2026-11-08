-- Catalogue authority handoff. Existing Central values can be imported first;
-- Finance can then take ownership and publish every approved change to Central.
CREATE TABLE IF NOT EXISTS central_billing_catalogue_control (
  id SMALLINT PRIMARY KEY DEFAULT 1 CHECK (id=1),
  price_owner TEXT NOT NULL DEFAULT 'CENTRAL' CHECK (price_owner IN ('CENTRAL','NEXT')),
  source_version TEXT,
  source_hash TEXT,
  synced_at TIMESTAMPTZ,
  sync_status TEXT NOT NULL DEFAULT 'NOT_SYNCED' CHECK (sync_status IN ('NOT_SYNCED','SYNCED','PENDING','FAILED')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
INSERT INTO central_billing_catalogue_control(id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE central_addon_products DROP CONSTRAINT IF EXISTS central_addon_products_price_kobo_check;
ALTER TABLE central_addon_products ADD CONSTRAINT central_addon_products_price_kobo_check
  CHECK (price_kobo >= 0 AND (NOT active OR price_kobo > 0));

CREATE TABLE IF NOT EXISTS central_billing_catalogue_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id UUID,
  source_version TEXT NOT NULL,
  source_hash TEXT NOT NULL,
  before_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  after_snapshot JSONB NOT NULL,
  central_sync_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (central_sync_status IN ('PENDING','SYNCED','FAILED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE central_billing_catalogue_control ENABLE ROW LEVEL SECURITY;
ALTER TABLE central_billing_catalogue_audit ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS sr_central_billing_catalogue_control_all ON central_billing_catalogue_control;
CREATE POLICY sr_central_billing_catalogue_control_all ON central_billing_catalogue_control FOR ALL TO service_role USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS sr_central_billing_catalogue_audit_all ON central_billing_catalogue_audit;
CREATE POLICY sr_central_billing_catalogue_audit_all ON central_billing_catalogue_audit FOR ALL TO service_role USING (true) WITH CHECK (true);
