-- ═══════════════════════════════════════════════════════════════════════════
-- 070_creator_challenge_engine.sql
-- Phase 3 — Creator Challenge Engine.
-- Extends the 062 challenge schema: rules versioning & freeze, structured
-- briefs, challenge-resource links, submission tracking tokens, judging
-- scores, winners, flag widening, referral dedupe. Adds only what 062 lacks.
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS / ADD COLUMN IF NOT EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Challenge config extensions ─────────────────────────────────────────

ALTER TABLE creator_challenges
  ADD COLUMN IF NOT EXISTS join_opens_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS join_closes_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS judging_date TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS min_submissions INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_submissions INTEGER,           -- null = unlimited
  ADD COLUMN IF NOT EXISTS creator_ready_required BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS cover_image_path TEXT,             -- creator-files path or URL
  ADD COLUMN IF NOT EXISTS scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS rules_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rules_frozen_at TIMESTAMPTZ;

COMMENT ON COLUMN creator_challenges.scoring_config IS
  'Per-challenge scoring/normalisation config: award weights, minimums (views/engagement/followers), caps. Displayed methodology only — anti-fraud thresholds stay internal.';
COMMENT ON COLUMN creator_challenges.rules_frozen_at IS
  'Set when the challenge goes ACTIVE. Material fields must not change after this without a new rule version.';

-- Per-award scoring configuration (weights, minimums, criteria keys) — the
-- anti-"one universal formula" knob. e.g. RISING may configure
-- {"minViews":200,"minEngagement":20,"weights":{"engagementRate":0.5,...}}.
ALTER TABLE creator_challenge_awards
  ADD COLUMN IF NOT EXISTS scoring_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── 2. Immutable rule versions ─────────────────────────────────────────────
-- Every activation and every post-activation amendment snapshots the full
-- challenge configuration (challenge row + awards + brief) so the rules a
-- participant joined under can always be reproduced.

CREATE TABLE IF NOT EXISTS creator_challenge_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot JSONB NOT NULL,              -- { challenge, awards, brief }
  reason TEXT,                          -- required for material amendments
  is_material BOOLEAN NOT NULL DEFAULT false,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_by_name TEXT,
  effective_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, version)
);

CREATE INDEX IF NOT EXISTS creator_challenge_rule_versions_ch_idx
  ON creator_challenge_rule_versions (challenge_id, version DESC);

-- ─── 3. Structured challenge briefs ─────────────────────────────────────────
-- Versioned sections JSONB rather than one monolithic text field.
-- Sections: overview, audience, keyMessage, directions[], requiredElements[],
-- prohibitedClaims, cta, hashtags[], mentions[], exampleIdeas[],
-- submissionInstructions, judgingExplainer — rendered as one clean brief page.

CREATE TABLE IF NOT EXISTS creator_challenge_briefs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 1,
  sections JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, version)
);

CREATE INDEX IF NOT EXISTS creator_challenge_briefs_ch_idx
  ON creator_challenge_briefs (challenge_id, version DESC);

-- ─── 4. Challenge resources ─────────────────────────────────────────────────
-- Links existing creator_resources (Creator Kit) to challenges — no asset
-- duplication. Only linked + active resources are surfaced to participants.

CREATE TABLE IF NOT EXISTS creator_challenge_resources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  resource_id UUID NOT NULL REFERENCES creator_resources(id) ON DELETE CASCADE,
  display_order INTEGER NOT NULL DEFAULT 0,
  required BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (challenge_id, resource_id)
);

CREATE INDEX IF NOT EXISTS creator_challenge_resources_ch_idx
  ON creator_challenge_resources (challenge_id, display_order);

-- ─── 5. Participants — terms/rules acceptance ────────────────────────────────

ALTER TABLE creator_challenge_participants
  ADD COLUMN IF NOT EXISTS rules_version_accepted INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS acknowledged_rules_version INTEGER,
  ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS withdrawn_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disqualified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disqualification_reason TEXT;

-- ─── 6. Submissions — tracking token, participant link, quarantine ───────────

ALTER TABLE creator_submissions
  ADD COLUMN IF NOT EXISTS tracking_token TEXT,
  ADD COLUMN IF NOT EXISTS participant_id UUID
    REFERENCES creator_challenge_participants(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS quarantined BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS quarantine_reason TEXT;

-- Backfill + default + required compact non-guessable tokens: "sub_" + 16 hex.
UPDATE creator_submissions
  SET tracking_token = 'sub_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16)
  WHERE tracking_token IS NULL;

ALTER TABLE creator_submissions
  ALTER COLUMN tracking_token SET DEFAULT
    ('sub_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 16));

ALTER TABLE creator_submissions ALTER COLUMN tracking_token SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS creator_submissions_token_idx
  ON creator_submissions (tracking_token);

-- Duplicate-URL policy: one public URL may only ever be submitted once across
-- the whole system. Normalised (lowercased, query/fragment + trailing slash
-- stripped) so trivially-decorated duplicates are caught too. Cross-posting to
-- different platforms is unaffected — those URLs differ.
CREATE UNIQUE INDEX IF NOT EXISTS creator_submissions_url_uniq
  ON creator_submissions (
    lower(rtrim(regexp_replace(content_url, '[?#].*$', ''), '/'))
  );

-- ─── 7. Judging — per-criterion scores by named judges ───────────────────────

CREATE TABLE IF NOT EXISTS creator_award_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  award_id UUID NOT NULL REFERENCES creator_challenge_awards(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  judge_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  judge_name TEXT,
  criterion TEXT NOT NULL,
  score NUMERIC NOT NULL CHECK (score >= 0),
  notes TEXT,
  finalized BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS creator_award_scores_ch_idx
  ON creator_award_scores (challenge_id, award_id);
CREATE INDEX IF NOT EXISTS creator_award_scores_sub_idx
  ON creator_award_scores (submission_id);

-- One score per judge per criterion per submission (or creator where
-- submission_id is null — expression index treats nulls as a fixed uuid).
CREATE UNIQUE INDEX IF NOT EXISTS creator_award_scores_uniq
  ON creator_award_scores (
    award_id,
    COALESCE(submission_id, '00000000-0000-0000-0000-000000000000'::uuid),
    COALESCE(judge_admin_id, '00000000-0000-0000-0000-000000000000'::uuid),
    criterion
  );

-- ─── 8. Winners ──────────────────────────────────────────────────────────────
-- Finalised results. Winners are explicitly recorded here and linked to the
-- generated creator_rewards row — never inferred.

CREATE TABLE IF NOT EXISTS creator_challenge_winners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  challenge_id UUID NOT NULL REFERENCES creator_challenges(id) ON DELETE CASCADE,
  award_id UUID NOT NULL REFERENCES creator_challenge_awards(id) ON DELETE CASCADE,
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  submission_id UUID REFERENCES creator_submissions(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 1 CHECK (position > 0),
  reward_id UUID REFERENCES creator_rewards(id) ON DELETE SET NULL,
  notes TEXT,
  finalized_by UUID REFERENCES users(id) ON DELETE SET NULL,
  finalized_by_name TEXT,
  finalized_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (award_id, creator_id),
  UNIQUE (award_id, position)
);

CREATE INDEX IF NOT EXISTS creator_challenge_winners_ch_idx
  ON creator_challenge_winners (challenge_id);

-- ─── 9. Flags — widen type + status enums ────────────────────────────────────
-- Existing: DUPLICATE_URL, DUPLICATE_SUBMISSION, REFERRAL_SPIKE,
-- CLICK_ANOMALY, SELF_REFERRAL, CONTENT_REMOVED, SUSPICIOUS_ENGAGEMENT,
-- COPIED_CONTENT, MISLEADING_CLAIM, OTHER
-- Added for challenge integrity checks.

ALTER TABLE creator_flags
  DROP CONSTRAINT IF EXISTS creator_flags_type_check;
ALTER TABLE creator_flags
  ADD CONSTRAINT creator_flags_type_check CHECK (type IN (
    'DUPLICATE_URL','DUPLICATE_SUBMISSION','REFERRAL_SPIKE','CLICK_ANOMALY',
    'SELF_REFERRAL','CONTENT_REMOVED','SUSPICIOUS_ENGAGEMENT','COPIED_CONTENT',
    'MISLEADING_CLAIM','INVALID_URL','NOT_JOINED','OUTSIDE_WINDOW',
    'EVIDENCE_MISMATCH','MANIPULATED_METRICS','TRAFFIC_SPIKE','OTHER'
  ));

ALTER TABLE creator_flags
  DROP CONSTRAINT IF EXISTS creator_flags_status_check;
ALTER TABLE creator_flags
  ADD CONSTRAINT creator_flags_status_check
    CHECK (status IN ('OPEN','UNDER_REVIEW','REVIEWED','RESOLVED','DISMISSED'));

ALTER TABLE creator_flags
  ADD COLUMN IF NOT EXISTS challenge_id UUID REFERENCES creator_challenges(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS creator_flags_sub_idx
  ON creator_flags (submission_id, status);

-- ─── 10. Referral dedupe ─────────────────────────────────────────────────────
-- dedupe_key prevents the same funnel event being recorded twice on
-- refresh/retry (e.g. "LEAD:<lead_id>" or "CLICK:<submission>:<ip>:<hour>").

ALTER TABLE creator_referrals
  ADD COLUMN IF NOT EXISTS dedupe_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS creator_referrals_dedupe_idx
  ON creator_referrals (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- ─── 11. RLS — service role only, same as the rest of the schema ─────────────

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'creator_challenge_rule_versions','creator_challenge_briefs',
    'creator_challenge_resources','creator_award_scores',
    'creator_challenge_winners'
  ] LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS "sr_%I_all" ON %I', t, t);
    EXECUTE format(
      'CREATE POLICY "sr_%I_all" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END;
$$;
