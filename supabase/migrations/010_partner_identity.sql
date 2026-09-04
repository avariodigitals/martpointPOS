-- Sprint 2: Partner identity, authentication, RBAC & secure access foundation
-- Idempotent and additive. Does not rebuild Sprint 1 objects.

-- ─────────────────────────── Admin users status (soft-disable) ───────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'users_status_check'
  ) THEN
    ALTER TABLE users ADD CONSTRAINT users_status_check CHECK (status IN ('ACTIVE','DISABLED'));
  END IF;
END $$;

-- ─────────────────────────── Partner users ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL
    CHECK (role IN ('PARTNER_OWNER','PARTNER_MANAGER','PARTNER_SALES','PARTNER_IMPLEMENTATION','PARTNER_SUPPORT')),
  status TEXT NOT NULL DEFAULT 'INVITED'
    CHECK (status IN ('INVITED','ACTIVE','SUSPENDED','DISABLED')),
  password_hash TEXT,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  invited_at TIMESTAMPTZ,
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global unique email for partner users in V1
CREATE UNIQUE INDEX IF NOT EXISTS partner_users_email_unique_idx ON partner_users (LOWER(email));
CREATE INDEX IF NOT EXISTS partner_users_partner_id_idx ON partner_users (partner_id);
CREATE INDEX IF NOT EXISTS partner_users_status_idx ON partner_users (status);

ALTER TABLE partner_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_users_all" ON partner_users;
CREATE POLICY "sr_partner_users_all" ON partner_users FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Partner invitations ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL
    CHECK (role IN ('PARTNER_OWNER','PARTNER_MANAGER','PARTNER_SALES','PARTNER_IMPLEMENTATION','PARTNER_SUPPORT')),
  permissions JSONB NOT NULL DEFAULT '[]'::jsonb,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  accepted_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  invited_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_invitations_token_hash_idx ON partner_invitations (token_hash);
CREATE INDEX IF NOT EXISTS partner_invitations_partner_id_idx ON partner_invitations (partner_id);
CREATE INDEX IF NOT EXISTS partner_invitations_email_idx ON partner_invitations (LOWER(email));

ALTER TABLE partner_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_invitations_all" ON partner_invitations;
CREATE POLICY "sr_partner_invitations_all" ON partner_invitations FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Partner capabilities (organisation-level) ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_capabilities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  capability TEXT NOT NULL
    CHECK (capability IN ('REFERRALS','SALES','IMPLEMENTATION','FIRST_LINE_SUPPORT','TECHNOLOGY','PAYMENT','TRAINING','CUSTOMER_ONBOARDING')),
  enabled BOOLEAN NOT NULL DEFAULT true,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  granted_by UUID,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (partner_id, capability)
);

CREATE INDEX IF NOT EXISTS partner_capabilities_partner_id_idx ON partner_capabilities (partner_id);
CREATE INDEX IF NOT EXISTS partner_capabilities_enabled_idx ON partner_capabilities (partner_id, enabled);

ALTER TABLE partner_capabilities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_capabilities_all" ON partner_capabilities;
CREATE POLICY "sr_partner_capabilities_all" ON partner_capabilities FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default capabilities for existing active partners
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN SELECT id, partner_type FROM partners LOOP
    IF rec.partner_type = 'REFERRAL' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'REFERRALS') ON CONFLICT DO NOTHING;
    ELSIF rec.partner_type = 'CHANNEL' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'REFERRALS'), (rec.id, 'SALES') ON CONFLICT DO NOTHING;
    ELSIF rec.partner_type = 'IMPLEMENTATION' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'IMPLEMENTATION'), (rec.id, 'CUSTOMER_ONBOARDING') ON CONFLICT DO NOTHING;
    ELSIF rec.partner_type = 'CHANNEL_IMPLEMENTATION' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'REFERRALS'), (rec.id, 'SALES'), (rec.id, 'IMPLEMENTATION'), (rec.id, 'CUSTOMER_ONBOARDING') ON CONFLICT DO NOTHING;
    ELSIF rec.partner_type = 'TECHNOLOGY' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'TECHNOLOGY') ON CONFLICT DO NOTHING;
    ELSIF rec.partner_type = 'PAYMENT' THEN
      INSERT INTO partner_capabilities (partner_id, capability) VALUES (rec.id, 'PAYMENT') ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END $$;

-- ─────────────────────────── Partner customer assignments ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_customer_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL
    CHECK (relationship_type IN ('REFERRED','SOLD','IMPLEMENTATION','SUPPORT','ACCOUNT_MANAGER')),
  access_level TEXT NOT NULL
    CHECK (access_level IN ('VIEW_ONLY','SALES','ONBOARDING_MANAGER','SUPPORT')),
  status TEXT NOT NULL DEFAULT 'ACTIVE'
    CHECK (status IN ('ACTIVE','EXPIRED','REVOKED')),
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  assigned_by UUID,
  starts_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pca_partner_id_idx ON partner_customer_assignments (partner_id);
CREATE INDEX IF NOT EXISTS pca_business_id_idx ON partner_customer_assignments (business_id);
CREATE INDEX IF NOT EXISTS pca_status_idx ON partner_customer_assignments (status);

-- Only one active assignment per partner + business
CREATE UNIQUE INDEX IF NOT EXISTS pca_active_unique_idx
  ON partner_customer_assignments (partner_id, business_id)
  WHERE status = 'ACTIVE';

ALTER TABLE partner_customer_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_customer_assignments_all" ON partner_customer_assignments;
CREATE POLICY "sr_partner_customer_assignments_all" ON partner_customer_assignments FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Partner profile update requests ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_profile_update_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES partner_users(id) ON DELETE SET NULL,
  changes JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED')),
  reviewed_by UUID,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ppur_partner_id_idx ON partner_profile_update_requests (partner_id, status);

ALTER TABLE partner_profile_update_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_profile_update_requests_all" ON partner_profile_update_requests;
CREATE POLICY "sr_partner_profile_update_requests_all" ON partner_profile_update_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Partner password reset tokens ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_password_resets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_user_id UUID NOT NULL REFERENCES partner_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ppr_token_hash_idx ON partner_password_resets (token_hash);
CREATE INDEX IF NOT EXISTS ppr_partner_user_id_idx ON partner_password_resets (partner_user_id);

ALTER TABLE partner_password_resets ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_password_resets_all" ON partner_password_resets;
CREATE POLICY "sr_partner_password_resets_all" ON partner_password_resets FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Partner resources ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL
    CHECK (category IN ('Pricing','Product Brochures','Sales Materials','Brand Assets','Demo','Technical Guides','Product Updates','Templates')),
  file_url TEXT,
  storage_path TEXT,
  external_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'ALL'
    CHECK (visibility IN ('ALL','TYPES','CAPABILITIES')),
  allowed_partner_types JSONB NOT NULL DEFAULT '[]'::jsonb,
  allowed_capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  active BOOLEAN NOT NULL DEFAULT true,
  published_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_resources_active_idx ON partner_resources (active, published_at);
CREATE INDEX IF NOT EXISTS partner_resources_category_idx ON partner_resources (category);

ALTER TABLE partner_resources ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_resources_all" ON partner_resources;
CREATE POLICY "sr_partner_resources_all" ON partner_resources FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Expand partner document verification status ───────────────────────────
DO $$
BEGIN
  ALTER TABLE partner_documents DROP CONSTRAINT IF EXISTS partner_documents_verification_status_check;
  ALTER TABLE partner_documents
    ADD CONSTRAINT partner_documents_verification_status_check
    CHECK (verification_status IN ('REQUESTED','SUBMITTED','UNDER_REVIEW','VERIFIED','REJECTED','EXPIRED'));
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not update partner_documents verification_status check: %', SQLERRM;
END $$;

-- Add a requested_by marker for compliance requests (optional metadata)
ALTER TABLE partner_documents ADD COLUMN IF NOT EXISTS requested_by UUID;
ALTER TABLE partner_documents ADD COLUMN IF NOT EXISTS notes TEXT;
