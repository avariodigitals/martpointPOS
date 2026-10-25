-- Creator challenge emergency deactivation and reversible reactivation.
-- Deactivation preserves participants, submissions, metrics, awards and rules;
-- it only removes the challenge from creator-facing participation flows.

ALTER TABLE creator_challenges
  ADD COLUMN IF NOT EXISTS deactivated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS deactivated_reason TEXT,
  ADD COLUMN IF NOT EXISTS deactivated_from_status TEXT;

ALTER TABLE creator_challenges
  DROP CONSTRAINT IF EXISTS creator_challenges_status_check;

ALTER TABLE creator_challenges
  ADD CONSTRAINT creator_challenges_status_check
  CHECK (status IN (
    'DRAFT', 'SCHEDULED', 'ACTIVE', 'SUBMISSION_CLOSED',
    'JUDGING', 'COMPLETED', 'DEACTIVATED', 'ARCHIVED'
  ));

CREATE INDEX IF NOT EXISTS creator_challenges_deactivated_idx
  ON creator_challenges (deactivated_at)
  WHERE deactivated_at IS NOT NULL;

COMMENT ON COLUMN creator_challenges.deactivated_at IS
  'When an administrator temporarily stopped this challenge; data is retained for reactivation.';
COMMENT ON COLUMN creator_challenges.deactivated_reason IS
  'Administrator-provided reason for the emergency deactivation.';
COMMENT ON COLUMN creator_challenges.deactivated_from_status IS
  'The lifecycle status to restore when an administrator reactivates the challenge.';
