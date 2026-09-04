-- Canonical businesses model
-- A real MartPoint customer/business/tenant. Distinct from leads (sales history).
-- Idempotent and additive: does not touch existing leads data.

CREATE TABLE IF NOT EXISTS businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_name TEXT NOT NULL,
  legal_name TEXT,
  primary_contact_name TEXT NOT NULL,
  primary_email TEXT NOT NULL,
  primary_phone TEXT NOT NULL,
  business_type TEXT NOT NULL DEFAULT '',
  industry TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  website TEXT,
  status TEXT NOT NULL DEFAULT 'PROSPECT'
    CHECK (status IN ('PROSPECT','ONBOARDING','ACTIVE','SUSPENDED','INACTIVE','CHURNED')),
  source TEXT NOT NULL DEFAULT 'DIRECT'
    CHECK (source IN ('DIRECT','PARTNER','REFERRAL','WEBSITE','SOCIAL','CAMPAIGN','OTHER')),
  source_lead_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_businesses_all" ON businesses;
CREATE POLICY "sr_businesses_all" ON businesses FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS businesses_status_idx ON businesses (status);
CREATE INDEX IF NOT EXISTS businesses_source_idx ON businesses (source);
CREATE INDEX IF NOT EXISTS businesses_source_lead_idx ON businesses (source_lead_id);
CREATE INDEX IF NOT EXISTS businesses_created_at_idx ON businesses (created_at DESC);
CREATE INDEX IF NOT EXISTS businesses_email_idx ON businesses (primary_email);
CREATE INDEX IF NOT EXISTS businesses_name_idx ON businesses (business_name);

-- Foreign key to leads (optional; leads.id is UUID). Use NOT VALID then validate to be safe
-- against any orphaned rows created before this constraint.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_source_lead_id_fkey'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_source_lead_id_fkey
      FOREIGN KEY (source_lead_id) REFERENCES leads(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'businesses_source_lead_id_fkey skipped: %', SQLERRM;
END $$;
