-- Private drafts allow an Admin to inspect the generated agreement PDF before
-- authorizing MartPoint's signature and sending the partner signing request.
CREATE TABLE IF NOT EXISTS partner_agreement_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  agreement_id TEXT NOT NULL,
  agreement_payload JSONB NOT NULL,
  terms_sha256 TEXT NOT NULL,
  draft_document_path TEXT NOT NULL,
  draft_document_sha256 TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_REVIEW'
    CHECK (status IN ('AWAITING_REVIEW', 'ISSUED', 'SUPERSEDED')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  issued_document_id UUID REFERENCES partner_documents(id) ON DELETE SET NULL,
  issued_at TIMESTAMPTZ,
  issued_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_agreement_drafts_application_idx
  ON partner_agreement_drafts (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS partner_agreement_drafts_status_idx
  ON partner_agreement_drafts (status, created_at DESC);

ALTER TABLE partner_agreement_drafts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_partner_agreement_drafts_all" ON partner_agreement_drafts;
CREATE POLICY "sr_partner_agreement_drafts_all"
  ON partner_agreement_drafts FOR ALL TO service_role
  USING (true) WITH CHECK (true);
