-- Allow creator question rounds to carry the actual email copy sent with the
-- structured answer link. Existing rounds remain compatible through defaults.

ALTER TABLE creator_application_question_rounds
  ADD COLUMN IF NOT EXISTS email_subject TEXT,
  ADD COLUMN IF NOT EXISTS email_intro TEXT;
