-- Sprint 3: Partner Leads, Opportunities, Assigned Customers & Partner-Assisted Onboarding
-- Additive only. Does not rebuild Sprint 1 or Sprint 2 objects.

-- ─────────────────────────── Partner leads ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  submitted_by_partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE SET NULL,

  business_name TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  phone TEXT,
  email TEXT,

  country TEXT,
  state TEXT,
  city TEXT,

  industry TEXT,
  business_type TEXT,

  estimated_branches INTEGER,
  estimated_users INTEGER,

  interested_product TEXT,
  estimated_deal_value NUMERIC(12,2),

  notes TEXT,

  status TEXT NOT NULL DEFAULT 'REGISTERED'
    CHECK (status IN ('REGISTERED','UNDER_REVIEW','QUALIFIED','DEMO','PROPOSAL','NEGOTIATION','WON','LOST','EXPIRED')),
  protection_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (protection_status IN ('PENDING','PROTECTED','REJECTED','EXPIRED')),
  protection_expires_at TIMESTAMPTZ,

  matched_lead_id UUID,
  matched_business_id UUID,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_leads_partner_id_idx ON partner_leads (partner_id);
CREATE INDEX IF NOT EXISTS partner_leads_status_idx ON partner_leads (status);
CREATE INDEX IF NOT EXISTS partner_leads_protection_idx ON partner_leads (protection_status);
CREATE INDEX IF NOT EXISTS partner_leads_phone_idx ON partner_leads (phone);
CREATE INDEX IF NOT EXISTS partner_leads_email_idx ON partner_leads (LOWER(email));

ALTER TABLE partner_leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_leads_all" ON partner_leads;
CREATE POLICY "sr_partner_leads_all" ON partner_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Lead protection settings ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_lead_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  default_protection_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO partner_lead_settings (default_protection_days)
SELECT 30
WHERE NOT EXISTS (SELECT 1 FROM partner_lead_settings);

-- ─────────────────────────── Business attribution ───────────────────────────
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS originating_partner_id UUID REFERENCES partners(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS partner_lead_id UUID REFERENCES partner_leads(id) ON DELETE SET NULL;
ALTER TABLE businesses ADD COLUMN IF NOT EXISTS acquisition_source TEXT DEFAULT 'DIRECT';

CREATE INDEX IF NOT EXISTS businesses_originating_partner_idx ON businesses (originating_partner_id);
CREATE INDEX IF NOT EXISTS businesses_partner_lead_idx ON businesses (partner_lead_id);

-- ─────────────────────────── Partner onboarding tasks ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  assignment_id UUID REFERENCES partner_customer_assignments(id) ON DELETE SET NULL,

  category TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,

  status TEXT NOT NULL DEFAULT 'NOT_STARTED'
    CHECK (status IN ('NOT_STARTED','IN_PROGRESS','BLOCKED','COMPLETED','VERIFIED')),
  required BOOLEAN NOT NULL DEFAULT false,

  completed_by UUID,
  completed_at TIMESTAMPTZ,

  verified_by UUID,
  verified_at TIMESTAMPTZ,

  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pot_business_id_idx ON partner_onboarding_tasks (business_id);
CREATE INDEX IF NOT EXISTS pot_status_idx ON partner_onboarding_tasks (business_id, status);

ALTER TABLE partner_onboarding_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_onboarding_tasks_all" ON partner_onboarding_tasks;
CREATE POLICY "sr_partner_onboarding_tasks_all" ON partner_onboarding_tasks FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Customer training records ───────────────────────────
CREATE TABLE IF NOT EXISTS customer_training_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  trainer_partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE SET NULL,

  training_type TEXT NOT NULL
    CHECK (training_type IN ('ADMIN','POS','INVENTORY','REPORTING','ONLINE_STORE','OTHER')),
  training_date DATE NOT NULL,

  attendees_count INTEGER NOT NULL DEFAULT 1,
  attendee_names TEXT,
  notes TEXT,
  evidence_path TEXT,

  customer_acknowledged BOOLEAN NOT NULL DEFAULT false,
  customer_acknowledged_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ctr_business_id_idx ON customer_training_records (business_id);
CREATE INDEX IF NOT EXISTS ctr_partner_id_idx ON customer_training_records (partner_id);

ALTER TABLE customer_training_records ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_customer_training_records_all" ON customer_training_records;
CREATE POLICY "sr_customer_training_records_all" ON customer_training_records FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Business entitlements ───────────────────────────
CREATE TABLE IF NOT EXISTS business_entitlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  plan_code TEXT,

  max_branches INTEGER NOT NULL DEFAULT 1,
  max_users INTEGER NOT NULL DEFAULT 1,
  online_store_enabled BOOLEAN NOT NULL DEFAULT false,
  implementation_enabled BOOLEAN NOT NULL DEFAULT true,
  subscription_status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (subscription_status IN ('ACTIVE','SUSPENDED','CANCELLED','PENDING')),

  effective_from TIMESTAMPTZ NOT NULL DEFAULT now(),
  effective_until TIMESTAMPTZ,

  created_by UUID,
  updated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id)
);

ALTER TABLE business_entitlements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_business_entitlements_all" ON business_entitlements;
CREATE POLICY "sr_business_entitlements_all" ON business_entitlements FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default entitlements for existing businesses
INSERT INTO business_entitlements (business_id, max_branches, max_users, online_store_enabled, implementation_enabled)
SELECT id, 1, 1, false, true
FROM businesses
ON CONFLICT (business_id) DO NOTHING;

-- ─────────────────────────── Business deployments ───────────────────────────
CREATE TABLE IF NOT EXISTS business_deployments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','PROVISIONING','PROVISIONED','CONFIGURATION','LIVE','SUSPENDED','FAILED')),

  environment_url TEXT,
  admin_url TEXT,
  online_store_url TEXT,

  provisioned_at TIMESTAMPTZ,
  go_live_at TIMESTAMPTZ,
  internal_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (business_id)
);

ALTER TABLE business_deployments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_business_deployments_all" ON business_deployments;
CREATE POLICY "sr_business_deployments_all" ON business_deployments FOR ALL TO service_role USING (true) WITH CHECK (true);
