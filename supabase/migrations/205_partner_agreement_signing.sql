-- One-time signing requests for partner application agreements. The raw token is
-- never stored; only its SHA-256 digest is persisted.
CREATE TABLE IF NOT EXISTS partner_agreement_signing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id UUID NOT NULL REFERENCES partner_applications(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  source_document_id UUID REFERENCES partner_documents(id) ON DELETE SET NULL,
  agreement_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'AWAITING_PARTNER'
    CHECK (status IN ('AWAITING_PARTNER', 'EXECUTED', 'EXPIRED', 'SUPERSEDED')),
  email_sent BOOLEAN NOT NULL DEFAULT false,
  email_sent_at TIMESTAMPTZ,
  agreement_payload JSONB NOT NULL,
  terms_sha256 TEXT NOT NULL,
  martpoint_signatory_name TEXT NOT NULL,
  martpoint_signatory_title TEXT NOT NULL,
  martpoint_signatory_email TEXT NOT NULL,
  martpoint_signed_at TIMESTAMPTZ NOT NULL,
  martpoint_signature_event_id TEXT NOT NULL,
  martpoint_signed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  partner_signer_name TEXT,
  partner_signer_title TEXT,
  partner_signer_email TEXT,
  partner_signed_at TIMESTAMPTZ,
  partner_signature_event_id TEXT,
  final_document_path TEXT,
  final_document_sha256 TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (
    status <> 'EXECUTED' OR (
      partner_signer_name IS NOT NULL AND partner_signer_email IS NOT NULL
      AND partner_signed_at IS NOT NULL AND partner_signature_event_id IS NOT NULL
      AND final_document_path IS NOT NULL AND final_document_sha256 IS NOT NULL
    )
  )
);

CREATE INDEX IF NOT EXISTS partner_agreement_signing_application_idx
  ON partner_agreement_signing (application_id, created_at DESC);

CREATE INDEX IF NOT EXISTS partner_agreement_signing_status_idx
  ON partner_agreement_signing (status, token_expires_at);
