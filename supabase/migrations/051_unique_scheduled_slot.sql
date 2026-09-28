-- One SCHEDULED meeting per start time.
-- Public self-booking (/book-demo) plus lead invites both land in this table;
-- the calendar owner can only be in one meeting at a time, so a slot that is
-- already SCHEDULED must reject a second booking. Partial unique index keeps
-- PENDING / CANCELLED / COMPLETED rows unaffected.

CREATE UNIQUE INDEX IF NOT EXISTS lead_meetings_unique_active_slot
  ON lead_meetings (scheduled_at)
  WHERE status = 'SCHEDULED' AND scheduled_at IS NOT NULL;
