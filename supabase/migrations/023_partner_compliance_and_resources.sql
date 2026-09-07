-- Partner compliance document workflow + training/certification/branded materials resources
-- Additive and idempotent.

-- ─────────────────────────── partner_applications ───────────────────────────

ALTER TABLE partner_applications ADD COLUMN IF NOT EXISTS required_compliance_documents JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Replace the status check constraint to include COMPLIANCE_REQUIRED
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'partner_applications'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%status%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_applications DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE partner_applications
  ADD CONSTRAINT partner_applications_status_check
  CHECK (status IN (
    'DRAFT','SUBMITTED','UNDER_REVIEW','MORE_INFORMATION_REQUIRED','COMPLIANCE_REQUIRED',
    'DISCOVERY_CALL','APPROVED_CONDITIONAL','APPROVED','AGREEMENT_PENDING','TRAINING',
    'CERTIFICATION_PENDING','ACTIVE','SUSPENDED','REJECTED','INACTIVE'
  ));

-- ─────────────────────────── partner_documents ───────────────────────────

ALTER TABLE partner_documents ADD COLUMN IF NOT EXISTS required BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE partner_documents ADD COLUMN IF NOT EXISTS notes TEXT;

-- The original default 'PENDING' is not in the allowed status set after the Sprint 2 expansion.
-- Fix the default and migrate any stray 'PENDING' rows to 'SUBMITTED'.
ALTER TABLE partner_documents ALTER COLUMN verification_status SET DEFAULT 'SUBMITTED';
UPDATE partner_documents SET verification_status = 'SUBMITTED' WHERE verification_status = 'PENDING';

-- Add APPROVED to the verification status set and name the constraint explicitly.
ALTER TABLE partner_documents
  DROP CONSTRAINT IF EXISTS partner_documents_verification_status_check;
ALTER TABLE partner_documents
  ADD CONSTRAINT partner_documents_verification_status_check
  CHECK (verification_status IN ('REQUESTED','SUBMITTED','UNDER_REVIEW','VERIFIED','APPROVED','REJECTED','EXPIRED'));

-- ─────────────────────────── One-time compliance upload tokens ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_document_upload_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_document_id UUID NOT NULL REFERENCES partner_documents(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pdu_token_hash_idx ON partner_document_upload_tokens (token_hash);
CREATE INDEX IF NOT EXISTS pdu_partner_document_idx ON partner_document_upload_tokens (partner_document_id);

ALTER TABLE partner_document_upload_tokens ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_document_upload_tokens_all" ON partner_document_upload_tokens;
CREATE POLICY "sr_partner_document_upload_tokens_all" ON partner_document_upload_tokens FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── partner_resources (shared + per-partner) ───────────────────────────

ALTER TABLE partner_resources ADD COLUMN IF NOT EXISTS partner_id UUID REFERENCES partners(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS partner_resources_partner_id_idx ON partner_resources (partner_id);

-- Expand the category list to cover Training, Certification and Branded Materials.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'partner_resources'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%category%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_resources DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE partner_resources
  ADD CONSTRAINT partner_resources_category_check
  CHECK (category IN (
    'Pricing','Product Brochures','Sales Materials','Brand Assets','Demo','Technical Guides',
    'Product Updates','Templates','Training','Certification','Branded Materials',
    'Brochure','Badge','Partner Logo','Learning Materials'
  ));

-- Private resources can be scoped to a single partner. Visibility still supports ALL/TYPES/CAPABILITIES;
-- a non-null partner_id overrides visibility and makes the resource private to that partner.

-- ─────────────────────────── Branding / asset requests from partners ───────────────────────────
CREATE TABLE IF NOT EXISTS partner_branding_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','FULFILLED','DECLINED')),
  admin_response TEXT,
  resource_id UUID REFERENCES partner_resources(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pbr_partner_id_idx ON partner_branding_requests (partner_id, status);

ALTER TABLE partner_branding_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_branding_requests_all" ON partner_branding_requests;
CREATE POLICY "sr_partner_branding_requests_all" ON partner_branding_requests FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ─────────────────────────── Storage bucket for shared/partner resources ───────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('partner-resources', 'partner-resources', false)
ON CONFLICT (id) DO NOTHING;
