-- Meeting notes / AI transcripts on partner_meetings.
-- The shared meeting-notes webhook previously only supported lead_meetings.

ALTER TABLE public.partner_meetings
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS notes_provider TEXT,
  ADD COLUMN IF NOT EXISTS notes_received_at TIMESTAMPTZ;
