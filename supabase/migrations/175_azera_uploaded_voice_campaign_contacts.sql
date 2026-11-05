-- Allow a reviewed voice campaign to use an uploaded contact list without
-- creating synthetic lead records.
ALTER TABLE public.azera_call_campaigns
  DROP CONSTRAINT IF EXISTS azera_call_campaigns_purpose_check;
ALTER TABLE public.azera_call_campaigns
  ADD CONSTRAINT azera_call_campaigns_purpose_check
  CHECK (purpose IN ('estimate_followup','quote_followup','lead_reengagement','uploaded_contacts'));
ALTER TABLE public.azera_call_campaigns
  ADD COLUMN IF NOT EXISTS uploaded_audience_consent_confirmed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.azera_call_campaign_recipients
  ALTER COLUMN lead_id DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS azera_call_campaign_uploaded_phone_unique
  ON public.azera_call_campaign_recipients(campaign_id, phone)
  WHERE lead_id IS NULL;

NOTIFY pgrst, 'reload schema';
