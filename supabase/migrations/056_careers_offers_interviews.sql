-- 056: Careers offers & interviews
-- Interview logistics on assessments (meeting link / location / duration /
-- Google Calendar event) and offer-letter tracking on applications.

ALTER TABLE career_assessments
  ADD COLUMN IF NOT EXISTS meeting_link TEXT,
  ADD COLUMN IF NOT EXISTS meeting_provider TEXT,
  ADD COLUMN IF NOT EXISTS meeting_location TEXT,
  ADD COLUMN IF NOT EXISTS duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT;

ALTER TABLE career_applications
  ADD COLUMN IF NOT EXISTS offer_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS offer_details JSONB;
