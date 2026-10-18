-- Azera merchant identity bridge.
-- Additive only. Maps the legacy PHP store id to the canonical business UUID.
-- Rows must be created by an administrator after verifying the merchant identity.

CREATE TABLE IF NOT EXISTS azera_business_store_mappings (
  store_id BIGINT PRIMARY KEY,
  business_id UUID NOT NULL UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE azera_business_store_mappings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_azera_business_store_mappings_all" ON azera_business_store_mappings;
CREATE POLICY "sr_azera_business_store_mappings_all"
  ON azera_business_store_mappings FOR ALL TO service_role
  USING (true) WITH CHECK (true);

