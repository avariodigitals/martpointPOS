-- Onboarding table migration
-- Audit found onboarding table exists in production but had no migration file.
-- This captures the actual production schema (inferred from application code) using
-- CREATE TABLE IF NOT EXISTS so it will NOT recreate/drop an existing production table.
-- It then adds an additive business_id column for the new canonical businesses model
-- while retaining lead_id during transition. Existing onboarding URLs remain valid.

CREATE TABLE IF NOT EXISTS onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id TEXT,
  full_name TEXT NOT NULL DEFAULT '',
  business_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  product_interest TEXT NOT NULL DEFAULT 'retail',
  status TEXT NOT NULL DEFAULT 'Pending',
  setup_questions_sent BOOLEAN NOT NULL DEFAULT false,
  client_responses JSONB NOT NULL DEFAULT '{}'::jsonb,
  documents JSONB NOT NULL DEFAULT '[]'::jsonb,
  signature_url TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE onboarding ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_onboarding_all" ON onboarding;
CREATE POLICY "sr_onboarding_all" ON onboarding FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public client onboarding form reads/updates by record id (anon). This preserves the
-- existing public onboarding URL behaviour. Restrict to non-final statuses via app logic.
DROP POLICY IF EXISTS "anon_onboarding_select" ON onboarding;
CREATE POLICY "anon_onboarding_select" ON onboarding FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_onboarding_update" ON onboarding;
CREATE POLICY "anon_onboarding_update" ON onboarding FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS onboarding_lead_id_idx ON onboarding (lead_id);
CREATE INDEX IF NOT EXISTS onboarding_status_idx ON onboarding (status);
CREATE INDEX IF NOT EXISTS onboarding_created_at_idx ON onboarding (created_at DESC);

-- Additive: link onboarding to canonical business while keeping lead_id for transition.
ALTER TABLE onboarding ADD COLUMN IF NOT EXISTS business_id UUID;
CREATE INDEX IF NOT EXISTS onboarding_business_id_idx ON onboarding (business_id);
