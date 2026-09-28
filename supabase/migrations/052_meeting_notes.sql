-- Meeting notes / AI minutes on lead_meetings.
-- Filled either manually in admin (PATCH save_notes) or automatically by a
-- notetaker webhook (Fireflies / tl;dv / any tool that can POST JSON) via
-- /api/webhooks/meeting-notes.

ALTER TABLE lead_meetings
  ADD COLUMN IF NOT EXISTS summary TEXT,
  ADD COLUMN IF NOT EXISTS action_items JSONB,        -- string[] of action items
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS transcript_url TEXT,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS notes_provider TEXT,       -- 'manual', 'fireflies', 'tldv', ...
  ADD COLUMN IF NOT EXISTS notes_received_at TIMESTAMPTZ;
