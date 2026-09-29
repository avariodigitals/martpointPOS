-- Generated partner documents registry
-- Portal-generated records (Activation Confirmations, Customer Assignments,
-- statements, notices, ...) with the blueprint controls: unique document ID,
-- template version, source record, checksum, signature/acceptance state and
-- superseded versions.
-- Idempotent.

ALTER TABLE partner_sequences
  ADD COLUMN IF NOT EXISTS document_seq INTEGER NOT NULL DEFAULT 0;

-- Atomic increment for generated document IDs (MPD-YYYY-NNNNN)
CREATE OR REPLACE FUNCTION increment_partner_document_seq()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  next_val INTEGER;
BEGIN
  UPDATE partner_sequences
    SET document_seq = document_seq + 1, updated_at = now()
    WHERE id = 1
    RETURNING document_seq INTO next_val;
  RETURN next_val;
END;
$$;

REVOKE EXECUTE ON FUNCTION increment_partner_document_seq() FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS partner_generated_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL UNIQUE,            -- MPD-YYYY-NNNNN

  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  application_id UUID REFERENCES partner_applications(id) ON DELETE SET NULL,

  document_type TEXT NOT NULL CHECK (document_type IN (
    'MASTER_PARTNER_AGREEMENT',
    'ACTIVATION_CONFIRMATION',
    'CUSTOMER_ASSIGNMENT',
    'IMPLEMENTATION_WORK_ORDER',
    'CHANGE_ORDER',
    'DATA_PROCESSING_ADDENDUM',
    'TRAINING_RECORD',
    'UAT_RECORD',
    'COMPLETION_HANDOVER_RECORD',
    'GO_LIVE_DECISION',
    'COMMISSION_STATEMENT',
    'IMPLEMENTATION_FEE_STATEMENT',
    'PAYOUT_STATEMENT',
    'GRADE_CONFIRMATION',
    'FORMAL_NOTICE'
  )),

  title TEXT NOT NULL,
  template_version TEXT NOT NULL,

  -- Portal record that caused generation (e.g. partner, assignment, payout)
  source_record_type TEXT,
  source_record_id TEXT,

  status TEXT NOT NULL DEFAULT 'ISSUED'
    CHECK (status IN ('DRAFT','ISSUED','ACCEPTED','SIGNED','SUPERSEDED','CANCELLED','EXPIRED')),

  storage_path TEXT NOT NULL,                  -- private partner-documents bucket
  file_size INTEGER,
  checksum_sha256 TEXT,

  generated_by TEXT,                           -- admin user id, or 'system'
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Partner acknowledgement (e.g. Customer Assignment acceptance)
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by TEXT,

  superseded_by UUID REFERENCES partner_generated_documents(id) ON DELETE SET NULL,

  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS pgd_partner_id_idx ON partner_generated_documents (partner_id);
CREATE INDEX IF NOT EXISTS pgd_application_id_idx ON partner_generated_documents (application_id);
CREATE INDEX IF NOT EXISTS pgd_document_type_idx ON partner_generated_documents (partner_id, document_type);
CREATE INDEX IF NOT EXISTS pgd_source_record_idx ON partner_generated_documents (source_record_type, source_record_id);

ALTER TABLE partner_generated_documents ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_generated_documents_all" ON partner_generated_documents;
CREATE POLICY "sr_partner_generated_documents_all" ON partner_generated_documents
  FOR ALL TO service_role USING (true) WITH CHECK (true);
