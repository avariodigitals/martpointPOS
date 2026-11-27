-- Separate the per-appointment agreement revision from its master template
-- version, and preserve immutable snapshots of every generated revision.
ALTER TABLE public.partner_agreement_drafts
  ADD COLUMN IF NOT EXISTS agreement_revision_id TEXT;

ALTER TABLE public.partner_agreement_signing
  ADD COLUMN IF NOT EXISTS agreement_revision_id TEXT;

ALTER TABLE public.partner_generated_documents
  ADD COLUMN IF NOT EXISTS agreement_revision_id TEXT;

UPDATE public.partner_agreement_drafts
SET agreement_revision_id = agreement_id
WHERE agreement_revision_id IS NULL;

UPDATE public.partner_agreement_signing
SET agreement_revision_id = agreement_id
WHERE agreement_revision_id IS NULL;

UPDATE public.partner_generated_documents
SET agreement_revision_id = COALESCE(metadata->>'agreementRevisionId', metadata->>'agreementId')
WHERE agreement_revision_id IS NULL
  AND document_type = 'MASTER_PARTNER_AGREEMENT'
  AND (metadata ? 'agreementRevisionId' OR metadata ? 'agreementId');

ALTER TABLE public.partner_agreement_drafts
  DROP CONSTRAINT IF EXISTS partner_agreement_drafts_status_check;
ALTER TABLE public.partner_agreement_drafts
  ADD CONSTRAINT partner_agreement_drafts_status_check
  CHECK (status IN ('AWAITING_REVIEW', 'ISSUED', 'SUPERSEDED', 'CANCELLED'));

CREATE UNIQUE INDEX IF NOT EXISTS partner_agreement_signing_revision_unique
  ON public.partner_agreement_signing (application_id, agreement_revision_id)
  WHERE agreement_revision_id ~ '-R[0-9]+$';

CREATE OR REPLACE FUNCTION prevent_partner_agreement_draft_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.application_id IS DISTINCT FROM OLD.application_id
    OR NEW.partner_id IS DISTINCT FROM OLD.partner_id
    OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
    OR NEW.agreement_revision_id IS DISTINCT FROM OLD.agreement_revision_id
    OR NEW.agreement_payload IS DISTINCT FROM OLD.agreement_payload
    OR NEW.terms_sha256 IS DISTINCT FROM OLD.terms_sha256
    OR NEW.draft_document_path IS DISTINCT FROM OLD.draft_document_path
    OR NEW.draft_document_sha256 IS DISTINCT FROM OLD.draft_document_sha256
    OR NEW.created_by IS DISTINCT FROM OLD.created_by
    OR NEW.created_at IS DISTINCT FROM OLD.created_at
  THEN
    RAISE EXCEPTION 'Agreement draft content is immutable; create a new revision.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_agreement_draft_content_immutable ON public.partner_agreement_drafts;
CREATE TRIGGER partner_agreement_draft_content_immutable
  BEFORE UPDATE ON public.partner_agreement_drafts
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_agreement_draft_content_mutation();

CREATE OR REPLACE FUNCTION prevent_partner_agreement_signing_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.application_id IS DISTINCT FROM OLD.application_id
    OR NEW.source_document_id IS DISTINCT FROM OLD.source_document_id
    OR NEW.agreement_revision_id IS DISTINCT FROM OLD.agreement_revision_id
    OR NEW.agreement_id IS DISTINCT FROM OLD.agreement_id
    OR NEW.token_hash IS DISTINCT FROM OLD.token_hash
    OR NEW.token_expires_at IS DISTINCT FROM OLD.token_expires_at
    OR NEW.agreement_payload IS DISTINCT FROM OLD.agreement_payload
    OR NEW.terms_sha256 IS DISTINCT FROM OLD.terms_sha256
    OR NEW.martpoint_signatory_name IS DISTINCT FROM OLD.martpoint_signatory_name
    OR NEW.martpoint_signatory_title IS DISTINCT FROM OLD.martpoint_signatory_title
    OR NEW.martpoint_signatory_email IS DISTINCT FROM OLD.martpoint_signatory_email
    OR NEW.martpoint_signed_at IS DISTINCT FROM OLD.martpoint_signed_at
    OR NEW.martpoint_signature_event_id IS DISTINCT FROM OLD.martpoint_signature_event_id
    OR NEW.martpoint_signed_by_user_id IS DISTINCT FROM OLD.martpoint_signed_by_user_id
    OR (OLD.partner_signed_at IS NOT NULL AND NEW.partner_signer_name IS DISTINCT FROM OLD.partner_signer_name)
    OR (OLD.partner_signed_at IS NOT NULL AND NEW.partner_signer_title IS DISTINCT FROM OLD.partner_signer_title)
    OR (OLD.partner_signed_at IS NOT NULL AND NEW.partner_signer_email IS DISTINCT FROM OLD.partner_signer_email)
    OR (OLD.partner_signed_at IS NOT NULL AND NEW.partner_signature_event_id IS DISTINCT FROM OLD.partner_signature_event_id)
    OR (OLD.partner_signed_at IS NOT NULL AND NEW.partner_signed_at IS DISTINCT FROM OLD.partner_signed_at)
    OR (OLD.final_document_path IS NOT NULL AND NEW.final_document_path IS DISTINCT FROM OLD.final_document_path)
    OR (OLD.final_document_sha256 IS NOT NULL AND NEW.final_document_sha256 IS DISTINCT FROM OLD.final_document_sha256)
  THEN
    RAISE EXCEPTION 'Issued agreement terms and signature evidence are immutable.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_agreement_signing_content_immutable ON public.partner_agreement_signing;
CREATE TRIGGER partner_agreement_signing_content_immutable
  BEFORE UPDATE ON public.partner_agreement_signing
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_agreement_signing_content_mutation();

CREATE OR REPLACE FUNCTION prevent_partner_agreement_document_content_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD.document_type = 'MASTER_PARTNER_AGREEMENT' AND (
    NEW.document_id IS DISTINCT FROM OLD.document_id
    OR NEW.document_type IS DISTINCT FROM OLD.document_type
    OR NEW.title IS DISTINCT FROM OLD.title
    OR NEW.template_version IS DISTINCT FROM OLD.template_version
    OR NEW.agreement_revision_id IS DISTINCT FROM OLD.agreement_revision_id
    OR NEW.source_record_type IS DISTINCT FROM OLD.source_record_type
    OR NEW.source_record_id IS DISTINCT FROM OLD.source_record_id
    OR NEW.storage_path IS DISTINCT FROM OLD.storage_path
    OR NEW.file_size IS DISTINCT FROM OLD.file_size
    OR NEW.checksum_sha256 IS DISTINCT FROM OLD.checksum_sha256
    OR NEW.generated_by IS DISTINCT FROM OLD.generated_by
    OR NEW.generated_at IS DISTINCT FROM OLD.generated_at
    OR NEW.metadata IS DISTINCT FROM OLD.metadata
    OR (OLD.partner_id IS NOT NULL AND NEW.partner_id IS DISTINCT FROM OLD.partner_id)
  ) THEN
    RAISE EXCEPTION 'Generated agreement document content is immutable; issue a new revision.';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS partner_agreement_document_content_immutable ON public.partner_generated_documents;
CREATE TRIGGER partner_agreement_document_content_immutable
  BEFORE UPDATE ON public.partner_generated_documents
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_agreement_document_content_mutation();

CREATE OR REPLACE FUNCTION prevent_partner_agreement_history_delete()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'Partner agreement history is retained; create a new revision instead of deleting a record.';
END;
$$;

DROP TRIGGER IF EXISTS partner_agreement_draft_history_retained ON public.partner_agreement_drafts;
CREATE TRIGGER partner_agreement_draft_history_retained
  BEFORE DELETE ON public.partner_agreement_drafts
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_agreement_history_delete();

DROP TRIGGER IF EXISTS partner_agreement_signing_history_retained ON public.partner_agreement_signing;
CREATE TRIGGER partner_agreement_signing_history_retained
  BEFORE DELETE ON public.partner_agreement_signing
  FOR EACH ROW EXECUTE FUNCTION prevent_partner_agreement_history_delete();

DROP TRIGGER IF EXISTS partner_agreement_document_history_retained ON public.partner_generated_documents;
CREATE TRIGGER partner_agreement_document_history_retained
  BEFORE DELETE ON public.partner_generated_documents
  FOR EACH ROW WHEN (OLD.document_type = 'MASTER_PARTNER_AGREEMENT')
  EXECUTE FUNCTION prevent_partner_agreement_history_delete();

COMMENT ON COLUMN public.partner_agreement_drafts.agreement_revision_id IS
  'Immutable per-appointment revision identifier (for example AGR-REF-R2), distinct from master template version.';
COMMENT ON COLUMN public.partner_agreement_signing.agreement_revision_id IS
  'Immutable per-appointment revision identifier, distinct from master template version.';
COMMENT ON COLUMN public.partner_generated_documents.agreement_revision_id IS
  'Immutable agreement revision identifier; template_version separately records the master template version.';

NOTIFY pgrst, 'reload schema';
