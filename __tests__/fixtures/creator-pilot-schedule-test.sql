-- Isolated disposable PostgreSQL database only. All fixtures roll back.
\set ON_ERROR_STOP on
BEGIN;
CREATE TABLE creator_challenges (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), slug TEXT, status TEXT,
 rules_frozen_at TIMESTAMPTZ, rules_version INTEGER DEFAULT 1,
 start_date TIMESTAMPTZ, join_opens_at TIMESTAMPTZ, join_closes_at TIMESTAMPTZ,
 submission_deadline TIMESTAMPTZ, performance_cutoff TIMESTAMPTZ,
 judging_date TIMESTAMPTZ, announcement_date TIMESTAMPTZ, updated_at TIMESTAMPTZ
);
CREATE TABLE creator_challenge_rule_versions (
 challenge_id UUID, version INTEGER, snapshot JSONB, reason TEXT,
 is_material BOOLEAN, created_by UUID, created_by_name TEXT
);
CREATE TABLE creator_challenge_awards (challenge_id UUID, created_at TIMESTAMPTZ);
CREATE TABLE creator_challenge_briefs (challenge_id UUID, sections JSONB, version INTEGER);
INSERT INTO creator_challenges(slug,status) VALUES('creator-challenge-pilot-001','DRAFT');
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM creator_challenges WHERE status='ACTIVE' AND pilot_schedule_applied_at IS NOT NULL AND join_closes_at=join_opens_at+INTERVAL '10 days' AND submission_deadline=join_opens_at+INTERVAL '15 days' AND timezone('Africa/Lagos',performance_cutoff)::time='21:00:00'::time) THEN RAISE EXCEPTION 'Initial pilot schedule is invalid'; END IF;
END $$;
UPDATE creator_challenges SET start_date='2000-01-01T00:00:00Z';
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT start_date FROM creator_challenges) <> '2000-01-01T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Rerun shifted an unfrozen schedule'; END IF;
END $$;
UPDATE creator_challenges SET status='COMPLETED', pilot_schedule_applied_at=NULL;
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT start_date FROM creator_challenges) <> '2000-01-01T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Completed schedule changed'; END IF;
END $$;
UPDATE creator_challenges SET status='DEACTIVATED';
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT start_date FROM creator_challenges) <> '2000-01-01T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Deactivated schedule changed'; END IF;
END $$;
UPDATE creator_challenges SET status='ARCHIVED';
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT start_date FROM creator_challenges) <> '2000-01-01T00:00:00Z'::timestamptz THEN RAISE EXCEPTION 'Archived schedule changed'; END IF;
END $$;
UPDATE creator_challenges SET status='ACTIVE',rules_frozen_at=now();
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT rules_version FROM creator_challenges) <> 2 OR (SELECT count(*) FROM creator_challenge_rule_versions) <> 1 THEN RAISE EXCEPTION 'Frozen amendment not versioned'; END IF;
END $$;
\ir ../../supabase/migrations/133_creator_challenge_pilot_schedule.sql
DO $$ BEGIN
 IF (SELECT rules_version FROM creator_challenges) <> 2 OR (SELECT count(*) FROM creator_challenge_rule_versions) <> 1 THEN RAISE EXCEPTION 'Frozen amendment duplicated'; END IF;
END $$;
ROLLBACK;
