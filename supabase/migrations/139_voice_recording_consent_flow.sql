-- Persist the pending consent step independently of provider callback URLs.
-- Do not backfill consent or treat historic keypresses as permission to record.
ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS recording_consent_requested_at TIMESTAMPTZ;
NOTIFY pgrst, 'reload schema';
