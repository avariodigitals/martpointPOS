-- Lead self-service meeting booking + Google Meet.
-- A meeting can now start life as a PENDING invite: the lead opens
-- /meeting/<token>, picks a slot (either from admin-proposed slots or from the
-- weekly availability rules in settings), and the row is promoted to SCHEDULED
-- with a Google Meet link created through the connected Google Calendar.

ALTER TABLE lead_meetings
  ALTER COLUMN scheduled_at DROP NOT NULL;

ALTER TABLE lead_meetings
  DROP CONSTRAINT IF EXISTS lead_meetings_status_check;
ALTER TABLE lead_meetings
  ADD CONSTRAINT lead_meetings_status_check
  CHECK (status IN ('PENDING','SCHEDULED','COMPLETED','CANCELLED','NO_SHOW'));

ALTER TABLE lead_meetings
  ADD COLUMN IF NOT EXISTS proposed_slots JSONB,          -- ISO timestamps hand-picked by admin (null => use availability rules)
  ADD COLUMN IF NOT EXISTS lead_timezone TEXT,            -- timezone the lead booked in
  ADD COLUMN IF NOT EXISTS selected_at TIMESTAMPTZ,       -- when the lead confirmed a slot
  ADD COLUMN IF NOT EXISTS invite_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS google_event_id TEXT,
  ADD COLUMN IF NOT EXISTS google_calendar_id TEXT,
  ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;        -- pending invites stop accepting bookings after this
