-- Tracks when an admin shared the meeting summary with the lead,
-- so the UI can show "sent" state instead of re-sending blindly.

ALTER TABLE lead_meetings
  ADD COLUMN IF NOT EXISTS summary_sent_at TIMESTAMPTZ;
