-- Partner ecosystem data model
-- partner_applications, partners, partner_documents, partner_status_history
-- Idempotent and additive.

-- ─────────────────────────── partner_applications ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_applications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reference_number TEXT NOT NULL UNIQUE,
  applicant_type TEXT NOT NULL CHECK (applicant_type IN ('INDIVIDUAL','COMPANY')),
  requested_partner_type TEXT NOT NULL
    CHECK (requested_partner_type IN ('REFERRAL','CHANNEL','IMPLEMENTATION','CHANNEL_IMPLEMENTATION','TECHNOLOGY','PAYMENT')),
  full_name TEXT NOT NULL,
  business_name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL,
  phone TEXT NOT NULL DEFAULT '',
  whatsapp TEXT NOT NULL DEFAULT '',
  country TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  business_address TEXT NOT NULL DEFAULT '',
  website TEXT NOT NULL DEFAULT '',
  linkedin TEXT NOT NULL DEFAULT '',
  social_profile TEXT NOT NULL DEFAULT '',
  registration_number TEXT NOT NULL DEFAULT '',
  year_established TEXT NOT NULL DEFAULT '',
  team_size TEXT NOT NULL DEFAULT '',
  estimated_customer_base TEXT NOT NULL DEFAULT '',
  industries_served JSONB NOT NULL DEFAULT '[]'::jsonb,
  geographic_coverage JSONB NOT NULL DEFAULT '[]'::jsonb,
  current_products_services TEXT NOT NULL DEFAULT '',
  reason_for_applying TEXT NOT NULL DEFAULT '',
  relevant_experience TEXT NOT NULL DEFAULT '',
  expected_monthly_opportunities TEXT,
  additional_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'DRAFT'
    CHECK (status IN ('DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','DISCOVERY_CALL','APPROVED_CONDITIONAL','APPROVED','AGREEMENT_PENDING','TRAINING','CERTIFICATION_PENDING','ACTIVE','SUSPENDED','REJECTED','INACTIVE')),
  submitted_at TIMESTAMPTZ,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  -- internal-only fields (never exposed to applicants)
  internal_notes TEXT NOT NULL DEFAULT '',
  risk_compliance_notes TEXT NOT NULL DEFAULT '',
  rejection_message_public TEXT NOT NULL DEFAULT '',
  information_request_message TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_applications_all" ON partner_applications;
CREATE POLICY "sr_partner_applications_all" ON partner_applications FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public may submit a new application (insert only). No public read.
DROP POLICY IF EXISTS "anon_partner_applications_insert" ON partner_applications;
CREATE POLICY "anon_partner_applications_insert" ON partner_applications FOR INSERT TO anon WITH CHECK (true);

CREATE INDEX IF NOT EXISTS pa_status_idx ON partner_applications (status);
CREATE INDEX IF NOT EXISTS pa_partner_type_idx ON partner_applications (requested_partner_type);
CREATE INDEX IF NOT EXISTS pa_country_idx ON partner_applications (country);
CREATE INDEX IF NOT EXISTS pa_state_idx ON partner_applications (state);
CREATE INDEX IF NOT EXISTS pa_created_at_idx ON partner_applications (created_at DESC);
CREATE INDEX IF NOT EXISTS pa_email_idx ON partner_applications (email);

-- ─────────────────────────── partners ───────────────────────────
CREATE TABLE IF NOT EXISTS partners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id TEXT NOT NULL UNIQUE,
  application_id UUID,
  business_name TEXT NOT NULL,
  display_name TEXT NOT NULL DEFAULT '',
  partner_type TEXT NOT NULL
    CHECK (partner_type IN ('REFERRAL','CHANNEL','IMPLEMENTATION','CHANNEL_IMPLEMENTATION','TECHNOLOGY','PAYMENT')),
  status TEXT NOT NULL DEFAULT 'PENDING_ACTIVATION'
    CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','SUSPENDED','INACTIVE','TERMINATED')),
  country TEXT NOT NULL DEFAULT '',
  state TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT '',
  public_email TEXT,
  public_phone TEXT,
  website TEXT,
  logo_url TEXT,
  public_profile_enabled BOOLEAN NOT NULL DEFAULT false,
  partner_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partners ENABLE ROW LEVEL SECURITY;

-- Service role full access
DROP POLICY IF EXISTS "sr_partners_all" ON partners;
CREATE POLICY "sr_partners_all" ON partners FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public may read only ACTIVE + public_profile_enabled partners (directory/verify).
DROP POLICY IF EXISTS "anon_partners_public" ON partners;
CREATE POLICY "anon_partners_public" ON partners FOR SELECT TO anon
  USING (status = 'ACTIVE' AND public_profile_enabled = true);

CREATE INDEX IF NOT EXISTS partners_status_idx ON partners (status);
CREATE INDEX IF NOT EXISTS partners_partner_type_idx ON partners (partner_type);
CREATE INDEX IF NOT EXISTS partners_country_idx ON partners (country);
CREATE INDEX IF NOT EXISTS partners_state_idx ON partners (state);
CREATE INDEX IF NOT EXISTS partners_public_idx ON partners (public_profile_enabled, status);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'partners_application_id_fkey') THEN
    ALTER TABLE partners
      ADD CONSTRAINT partners_application_id_fkey
      FOREIGN KEY (application_id) REFERENCES partner_applications(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'partners_application_id_fkey skipped: %', SQLERRM;
END $$;

-- ─────────────────────────── partner_documents ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  partner_id UUID,
  document_type TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  file_size BIGINT NOT NULL DEFAULT 0,
  verification_status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (verification_status IN ('PENDING','VERIFIED','REJECTED')),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verified_at TIMESTAMPTZ,
  verified_by UUID
);

ALTER TABLE partner_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_documents_all" ON partner_documents;
CREATE POLICY "sr_partner_documents_all" ON partner_documents FOR ALL TO service_role USING (true) WITH CHECK (true);

-- No public access to documents. Signed URLs handled server-side.

CREATE INDEX IF NOT EXISTS pd_application_id_idx ON partner_documents (application_id);
CREATE INDEX IF NOT EXISTS pd_partner_id_idx ON partner_documents (partner_id);

-- ─────────────────────────── partner_status_history ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID,
  partner_id UUID,
  previous_status TEXT,
  new_status TEXT NOT NULL,
  reason TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE partner_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_status_history_all" ON partner_status_history;
CREATE POLICY "sr_partner_status_history_all" ON partner_status_history FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS psh_application_id_idx ON partner_status_history (application_id, created_at DESC);
CREATE INDEX IF NOT EXISTS psh_partner_id_idx ON partner_status_history (partner_id, created_at DESC);

-- ─────────────────────────── private storage bucket ───────────────────────────
-- Partner documents live in a PRIVATE bucket (no public access). Signed URLs
-- generated server-side with the service role are used for admin viewing.
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-documents', 'partner-documents', false)
ON CONFLICT (id) DO NOTHING;
