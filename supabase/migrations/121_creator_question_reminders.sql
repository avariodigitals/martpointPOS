-- Automated follow-up for unanswered creator application question rounds.
-- A reminder is sent every three days, up to ten successful reminder emails.
-- The final reminder places the application on hold if no answers arrived.

ALTER TABLE creator_application_question_rounds
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_claimed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS initial_email_status TEXT NOT NULL DEFAULT 'PENDING',
  ADD COLUMN IF NOT EXISTS first_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE creator_application_question_rounds
  DROP CONSTRAINT IF EXISTS creator_question_initial_email_status_check;
ALTER TABLE creator_application_question_rounds
  ADD CONSTRAINT creator_question_initial_email_status_check
  CHECK (initial_email_status IN ('PENDING','SENT','FAILED'));

CREATE INDEX IF NOT EXISTS creator_question_rounds_reminder_idx
  ON creator_application_question_rounds (status, next_reminder_at)
  WHERE status = 'Sent';

-- Trace each initial send and reminder independently from the provider's
-- general email log. SENT means the configured provider accepted the message;
-- first_viewed_at/last_viewed_at prove that the applicant opened the link.
CREATE TABLE IF NOT EXISTS creator_application_question_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID NOT NULL REFERENCES creator_application_question_rounds(id) ON DELETE CASCADE,
  application_id UUID NOT NULL REFERENCES creator_applications(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('INITIAL','REMINDER')),
  attempt_no INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL CHECK (status IN ('SENT','FAILED')),
  error_message TEXT,
  provider_accepted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_question_emails_round_idx
  ON creator_application_question_emails (round_id, created_at DESC);

-- Existing unanswered rounds join the same schedule without sending a burst
-- on migration. The hourly cron will pick them up once they are three days old.
UPDATE creator_application_question_rounds
SET next_reminder_at = sent_at + INTERVAL '3 days'
WHERE status = 'Sent'
  AND sent_at IS NOT NULL
  AND next_reminder_at IS NULL;

-- The pre-reminder implementation stamped sent_at after creating the round.
-- Treat those historical sends as provider-accepted unless the new status is
-- already known; future sends write SENT/FAILED explicitly.
UPDATE creator_application_question_rounds
SET initial_email_status = 'SENT'
WHERE initial_email_status = 'PENDING'
  AND sent_at IS NOT NULL;

