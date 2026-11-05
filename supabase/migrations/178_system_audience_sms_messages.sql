-- Keep system-segment SMS messages attributable without turning system records
-- into marketing_contacts or implying that their SMS opt-in is stored there.
ALTER TABLE public.communication_messages
  DROP CONSTRAINT IF EXISTS communication_messages_contact_source_check;

ALTER TABLE public.communication_messages
  ADD CONSTRAINT communication_messages_contact_source_check
  CHECK (contact_source IN ('lead','saved_audience','newsletter','status_subscriber','system_audience'));

NOTIFY pgrst, 'reload schema';
