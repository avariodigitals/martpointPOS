-- Recording notices are required in the voice flow; the IVR no longer asks
-- callers to press a key to agree. Keep notice acknowledgements auditable.
ALTER TABLE azera_calls
  ADD COLUMN IF NOT EXISTS recording_notice_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recording_notice_acknowledged_at TIMESTAMPTZ;

ALTER TABLE azera_call_recordings
  ADD COLUMN IF NOT EXISTS recording_notice_acknowledged_at TIMESTAMPTZ;

ALTER TABLE azera_settings
  ALTER COLUMN voice_record_calls SET DEFAULT true,
  ALTER COLUMN voice_recording_notice SET DEFAULT 'This call is being recorded for service quality and training.';

UPDATE azera_settings SET voice_record_calls = true WHERE voice_record_calls = false;

UPDATE azera_settings
SET voice_recording_notice = 'This call is being recorded for service quality and training.'
WHERE voice_recording_notice ILIKE '%press 1%'
  AND voice_recording_notice ILIKE '%press 2%';

NOTIFY pgrst, 'reload schema';
