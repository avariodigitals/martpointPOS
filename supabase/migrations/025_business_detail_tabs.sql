-- Business detail tabs: branches, business users, onboarding stage tracker
-- Enables the Branches / Users / Subscription / Onboarding tabs on the
-- admin 360° business record.

-- Per-business onboarding stage progress. Stored as a JSONB map:
--   { "CONVERTED": { "completedAt": "...", "completedBy": "..." }, ... }
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS onboarding_stages JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Branches belonging to a business
CREATE TABLE IF NOT EXISTS business_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  is_headquarters BOOLEAN NOT NULL DEFAULT false,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','INACTIVE')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE business_branches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_business_branches_all" ON business_branches;
CREATE POLICY "sr_business_branches_all" ON business_branches FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS business_branches_business_idx ON business_branches (business_id);

-- Users belonging to a business (tenant staff / POS users)
CREATE TABLE IF NOT EXISTS business_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  phone TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'STAFF'
    CHECK (role IN ('OWNER','MANAGER','CASHIER','STAFF','ACCOUNTANT')),
  branch_id UUID REFERENCES business_branches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED')),
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE business_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_business_users_all" ON business_users;
CREATE POLICY "sr_business_users_all" ON business_users FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS business_users_business_idx ON business_users (business_id);
CREATE INDEX IF NOT EXISTS business_users_branch_idx ON business_users (branch_id);
