-- 063: Creator attribution on leads + demo bookings
-- Extends the existing acquisition attribution (referring_partner_code,
-- external_id) with creator referral fields — additive only, nothing renamed
-- or removed. UTMs are preserved at the lead level for funnel reporting.

ALTER TABLE leads
  ADD COLUMN IF NOT EXISTS referring_creator_code TEXT,
  ADD COLUMN IF NOT EXISTS creator_id UUID,
  ADD COLUMN IF NOT EXISTS creator_challenge_id UUID,
  ADD COLUMN IF NOT EXISTS creator_submission_id UUID,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT;

CREATE INDEX IF NOT EXISTS leads_referring_creator_idx
  ON leads (referring_creator_code)
  WHERE referring_creator_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS leads_creator_idx
  ON leads (creator_id)
  WHERE creator_id IS NOT NULL;

-- Optional FK wiring to the creator network tables (kept loose so a creator
-- can be removed without breaking lead history).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_creator_id_fkey'
  ) THEN
    ALTER TABLE leads
      ADD CONSTRAINT leads_creator_id_fkey
      FOREIGN KEY (creator_id) REFERENCES creators(id) ON DELETE SET NULL;
  END IF;
END;
$$;
