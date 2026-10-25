-- Open the current Creator Challenge Pilot using the approved schedule:
--   applications: now through +10 days
--   submission window: the following 5 days
--   performance period: 3 weeks after submissions close
--   performance cutoff: 9:00 PM Africa/Lagos on the final day
--   winner announcement: 5 days after the cutoff
--
-- This is idempotent. It does not reopen a completed, archived or deactivated
-- challenge. If the challenge is already live/frozen, it records a material
-- rules amendment so joined creators retain an auditable version history.

ALTER TABLE creator_challenges
  ADD COLUMN IF NOT EXISTS pilot_schedule_applied_at TIMESTAMPTZ;

DO $$
DECLARE
  c RECORD;
  open_at TIMESTAMPTZ;
  submit_deadline TIMESTAMPTZ;
  cutoff_at TIMESTAMPTZ;
  announce_at TIMESTAMPTZ;
  next_version INTEGER;
  awards_snapshot JSONB;
  brief_snapshot JSONB;
  reason_text TEXT := 'Pilot schedule opened: applications 10 days, submissions 5 days, performance 3 weeks, cutoff 9:00 PM Africa/Lagos, announcement 5 days later.';
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('creator-pilot-schedule-133'));
  SELECT * INTO c
  FROM creator_challenges
  WHERE slug = 'creator-challenge-pilot-001'
  LIMIT 1 FOR UPDATE;

  IF NOT FOUND THEN
    RAISE NOTICE 'Creator Challenge Pilot 001 was not found; no schedule changed.';
    RETURN;
  END IF;

  IF c.status IN ('COMPLETED', 'ARCHIVED', 'DEACTIVATED') THEN
    RAISE NOTICE 'Creator Challenge Pilot 001 is complete, archived or deactivated; no schedule changed.';
    RETURN;
  END IF;

  IF c.pilot_schedule_applied_at IS NOT NULL OR EXISTS (
    SELECT 1
    FROM creator_challenge_rule_versions
    WHERE challenge_id = c.id
      AND reason = reason_text
  ) THEN
    RAISE NOTICE 'Creator Challenge Pilot 001 already has the requested schedule amendment.';
    RETURN;
  END IF;

  open_at := now();
  submit_deadline := open_at + interval '15 days';
  cutoff_at := (
    date_trunc(
      'day',
      timezone('Africa/Lagos', submit_deadline + interval '21 days')
    ) + interval '21 hours'
  ) AT TIME ZONE 'Africa/Lagos';
  announce_at := cutoff_at + interval '5 days';

  -- Frozen challenges need a new immutable version before material fields move.
  IF c.rules_frozen_at IS NOT NULL THEN
    next_version := c.rules_version + 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(award_row) ORDER BY award_row.created_at), '[]'::jsonb)
    INTO awards_snapshot
    FROM creator_challenge_awards AS award_row
    WHERE award_row.challenge_id = c.id;

    SELECT COALESCE(
      (
        SELECT b.sections
        FROM creator_challenge_briefs b
        WHERE b.challenge_id = c.id
        ORDER BY b.version DESC
        LIMIT 1
      ),
      '{}'::jsonb
    ) INTO brief_snapshot;

    INSERT INTO creator_challenge_rule_versions (
      challenge_id, version, snapshot, reason, is_material,
      created_by, created_by_name
    )
    VALUES (
      c.id,
      next_version,
      jsonb_build_object(
        'challenge', to_jsonb(c),
        'awards', awards_snapshot,
        'brief', brief_snapshot
      ),
      reason_text,
      true,
      NULL,
      'System schedule update'
    );
  ELSE
    next_version := c.rules_version;
  END IF;

  UPDATE creator_challenges
  SET status = CASE
        WHEN status IN ('DRAFT', 'SCHEDULED') THEN 'ACTIVE'
        ELSE status
      END,
      start_date = open_at,
      join_opens_at = open_at,
      join_closes_at = open_at + interval '10 days',
      submission_deadline = submit_deadline,
      performance_cutoff = cutoff_at,
      judging_date = cutoff_at,
      announcement_date = announce_at,
      pilot_schedule_applied_at = now(),
      rules_version = next_version,
      updated_at = now()
  WHERE id = c.id;
END $$;
