-- Allow the Admin workflow to cancel an unissued agreement review draft while
-- retaining its immutable snapshot for the agreement history.
ALTER TABLE public.partner_agreement_drafts
  DROP CONSTRAINT IF EXISTS partner_agreement_drafts_status_check;

ALTER TABLE public.partner_agreement_drafts
  ADD CONSTRAINT partner_agreement_drafts_status_check
  CHECK (status IN ('AWAITING_REVIEW', 'ISSUED', 'SUPERSEDED', 'CANCELLED'));

NOTIFY pgrst, 'reload schema';
