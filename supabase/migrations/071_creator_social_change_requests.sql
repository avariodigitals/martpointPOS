-- ═══════════════════════════════════════════════════════════════════════════
-- 071_creator_social_change_requests.sql
-- Creators can no longer edit/delete the social profiles they declared at
-- application (screening + challenge baseline data) directly. Changes go
-- through a review queue — mirrors partner_profile_update_requests (010).
-- Idempotent: IF NOT EXISTS / DROP IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS creator_social_change_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  application_id UUID REFERENCES creator_applications(id) ON DELETE SET NULL,
  social_profile_id UUID REFERENCES creator_social_profiles(id) ON DELETE SET NULL,
  request_type TEXT NOT NULL
    CHECK (request_type IN ('ADD','UPDATE','REMOVE')),
  -- { platform, profileUrl, username, followers, isPrimary } — only the
  -- fields being changed for UPDATE; full row shape for ADD.
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  note TEXT,                              -- creator's reason/context
  status TEXT NOT NULL DEFAULT 'PENDING'
    CHECK (status IN ('PENDING','APPROVED','REJECTED','CANCELLED')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  review_note TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cscr_creator_idx
  ON creator_social_change_requests (creator_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS cscr_status_idx
  ON creator_social_change_requests (status, created_at);

-- At most one pending UPDATE/REMOVE request per social profile.
CREATE UNIQUE INDEX IF NOT EXISTS cscr_pending_profile_uq
  ON creator_social_change_requests (social_profile_id)
  WHERE status = 'PENDING' AND social_profile_id IS NOT NULL;

ALTER TABLE creator_social_change_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_creator_social_change_requests_all" ON creator_social_change_requests;
CREATE POLICY "sr_creator_social_change_requests_all" ON creator_social_change_requests
  FOR ALL TO service_role USING (true) WITH CHECK (true);
