-- Keep applications open through Dec 12, 2026, then run Creator Challenge Pilot 001
-- from Jan 5, 2027 using the approved T+21 / T+28 / T+31 cadence.
DO $$
DECLARE
  c creator_challenges%ROWTYPE;
  next_version INTEGER;
  awards_snapshot JSONB;
  brief_snapshot JSONB;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('creator-pilot-january-2027-schedule'));
  SELECT * INTO c
  FROM creator_challenges
  WHERE slug = 'creator-challenge-pilot-001'
  LIMIT 1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE NOTICE 'Creator Challenge Pilot 001 was not found; no schedule changed.';
    RETURN;
  END IF;

  -- Safe to rerun after the target dates have been applied.
  IF c.join_closes_at = TIMESTAMPTZ '2026-12-12 23:59:59.999 Africa/Lagos'
     AND c.start_date = TIMESTAMPTZ '2027-01-05 00:00:00 Africa/Lagos'
     AND c.submission_deadline = TIMESTAMPTZ '2027-01-26 23:59:59.999 Africa/Lagos'
     AND c.performance_cutoff = TIMESTAMPTZ '2027-02-02 21:00:00 Africa/Lagos'
     AND c.announcement_date = TIMESTAMPTZ '2027-02-05 00:00:00 Africa/Lagos' THEN
    RAISE NOTICE 'Creator Challenge Pilot 001 already has the January 2027 schedule.';
    RETURN;
  END IF;

  -- Preserve the exact rules participants previously accepted before changing
  -- material schedule dates on a frozen/live challenge.
  IF c.rules_frozen_at IS NOT NULL THEN
    next_version := c.rules_version + 1;

    SELECT COALESCE(jsonb_agg(to_jsonb(a) ORDER BY a.created_at), '[]'::jsonb)
    INTO awards_snapshot
    FROM creator_challenge_awards a
    WHERE a.challenge_id = c.id;

    SELECT COALESCE(
      (SELECT b.sections
       FROM creator_challenge_briefs b
       WHERE b.challenge_id = c.id
       ORDER BY b.version DESC
       LIMIT 1),
      '{}'::jsonb
    ) INTO brief_snapshot;

    INSERT INTO creator_challenge_rule_versions (
      challenge_id, version, snapshot, reason, is_material,
      created_by, created_by_name
    ) VALUES (
      c.id,
      next_version,
      jsonb_build_object('challenge', to_jsonb(c), 'awards', awards_snapshot, 'brief', brief_snapshot),
      'Schedule amended: applications close Dec 12, 2026; challenge launches Jan 5, 2027.',
      true,
      NULL,
      'System schedule update'
    );
  ELSE
    next_version := c.rules_version;
  END IF;

  UPDATE creator_challenges
  SET join_opens_at = now(),
      join_closes_at = TIMESTAMPTZ '2026-12-12 23:59:59.999 Africa/Lagos',
      start_date = TIMESTAMPTZ '2027-01-05 00:00:00 Africa/Lagos',
      submission_deadline = TIMESTAMPTZ '2027-01-26 23:59:59.999 Africa/Lagos',
      performance_cutoff = TIMESTAMPTZ '2027-02-02 21:00:00 Africa/Lagos',
      judging_date = TIMESTAMPTZ '2027-02-02 21:00:00 Africa/Lagos',
      announcement_date = TIMESTAMPTZ '2027-02-05 00:00:00 Africa/Lagos',
      rules_version = next_version,
      updated_at = now()
  WHERE id = c.id;
END $$;
