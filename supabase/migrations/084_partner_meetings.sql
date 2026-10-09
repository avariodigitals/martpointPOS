-- 084_partner_meetings.sql
--
-- Gives partner-application meetings a real home.
--
-- Why this migration exists
--   Partner meeting invitations were only recorded as free-text rows in
--   partner_status_history (event_type MEETING_INVITED). That is fine for a
--   timeline, but it cannot answer "which meetings are upcoming?", "did the
--   Google Meet link get created?", or "was the partner notified?" without
--   parsing prose. This adds a first-class partner_meetings table so admins can
--   list, cancel and reschedule partner meetings the same way lead demos work.
--
-- What it adds
--   * partner_meetings — one row per invitation, with the Google Meet link,
--     the Google event id (so the calendar event can be deleted on cancel),
--     delivery status for the applicant + team notification emails, and status
--     lifecycle (SCHEDULED | COMPLETED | CANCELLED | NO_SHOW).
--
-- Service-role only: the table is read/written exclusively by admin API routes
-- (the applicant never talks to it directly), so RLS grants access to
-- service_role only — matching partner_applications / partner_documents.
--
-- Idempotent: safe to re-run.

CREATE TABLE IF NOT EXISTS public.partner_meetings (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id     UUID NOT NULL REFERENCES public.partner_applications(id) ON DELETE CASCADE,
  title              TEXT NOT NULL DEFAULT 'Partner application discussion',
  scheduled_at       TIMESTAMPTZ NOT NULL,
  duration_minutes   INTEGER NOT NULL DEFAULT 30,
  timezone           TEXT NOT NULL DEFAULT 'Africa/Lagos',
  meeting_link       TEXT,
  provider           TEXT,
  google_event_id    TEXT,
  google_calendar_id TEXT,
  status             TEXT NOT NULL DEFAULT 'SCHEDULED'
                       CHECK (status IN ('SCHEDULED','COMPLETED','CANCELLED','NO_SHOW')),
  message            TEXT,
  -- Delivery bookkeeping. The applicant invitation is what the admin sees as
  -- the primary outcome; the team heads-up is best-effort.
  email_sent         BOOLEAN NOT NULL DEFAULT false,
  team_notified      BOOLEAN NOT NULL DEFAULT false,
  meet_error         TEXT,
  created_by         UUID,
  created_by_name    TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS partner_meetings_application_idx
  ON public.partner_meetings (application_id, scheduled_at DESC);

-- Supports the "upcoming meetings" admin list.
CREATE INDEX IF NOT EXISTS partner_meetings_scheduled_idx
  ON public.partner_meetings (scheduled_at DESC);

CREATE INDEX IF NOT EXISTS partner_meetings_status_idx
  ON public.partner_meetings (status, scheduled_at);

ALTER TABLE public.partner_meetings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_partner_meetings_all" ON public.partner_meetings;
CREATE POLICY "sr_partner_meetings_all" ON public.partner_meetings
  FOR ALL TO service_role USING (true) WITH CHECK (true);

COMMENT ON TABLE public.partner_meetings IS
  'Partner-application meetings/invitations, including the Google Meet link and Google event id. Admin-managed (service role only).';
