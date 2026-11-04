-- Keep unfinished email campaigns in the campaign workspace as editable drafts.
ALTER TABLE public.marketing_campaigns DROP CONSTRAINT IF EXISTS marketing_campaigns_status_check;
ALTER TABLE public.marketing_campaigns
  ADD CONSTRAINT marketing_campaigns_status_check
  CHECK (status IN ('draft','scheduled','sending','sent','partial','failed'));

-- Scheduled and draft campaigns have not been sent yet.
ALTER TABLE public.marketing_campaigns ALTER COLUMN sent_at DROP NOT NULL;
ALTER TABLE public.marketing_campaigns ALTER COLUMN sent_at DROP DEFAULT;
