-- Partner directory enhancements:
-- 1. Public-facing street address for listed partners
-- 2. Lead attribution: which partner referred a website lead
-- 3. Public engagement events (directory clicks, profile views, verify lookups, contact clicks)

-- ─────────────────────────── partners public listing fields ───────────────────────────
ALTER TABLE partners ADD COLUMN IF NOT EXISTS public_address TEXT;
-- Comma-separated areas the partner serves (e.g. "Lagos, Abuja, Port Harcourt"). Public-safe.
ALTER TABLE partners ADD COLUMN IF NOT EXISTS service_areas TEXT NOT NULL DEFAULT '';

-- ─────────────────────────── leads.referring_partner_code ───────────────────────────
-- Set when a website lead arrives via a partner profile / referral link (e.g. MP-NG-00001).
ALTER TABLE leads ADD COLUMN IF NOT EXISTS referring_partner_code TEXT;
CREATE INDEX IF NOT EXISTS leads_referring_partner_idx ON leads (referring_partner_code)
  WHERE referring_partner_code IS NOT NULL;

-- ─────────────────────────── partner_profile_events ───────────────────────────
-- Anonymous engagement tracking for the public partner directory and
-- verification pages. No personal data is stored — no IP, no cookies.
CREATE TABLE IF NOT EXISTS partner_profile_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID REFERENCES partners(id) ON DELETE CASCADE,
  partner_code TEXT NOT NULL,
  event_type TEXT NOT NULL
    CHECK (event_type IN (
      'directory_click',
      'profile_view',
      'verify_lookup',
      'website_click',
      'phone_click',
      'email_click',
      'sales_cta_click'
    )),
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ppe_partner_idx ON partner_profile_events (partner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ppe_code_idx ON partner_profile_events (partner_code, created_at DESC);
CREATE INDEX IF NOT EXISTS ppe_type_idx ON partner_profile_events (event_type, created_at DESC);

ALTER TABLE partner_profile_events ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side reads/writes)
DROP POLICY IF EXISTS "sr_ppe_all" ON partner_profile_events;
CREATE POLICY "sr_ppe_all" ON partner_profile_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Public may only insert events (tracking beacons); no public read.
DROP POLICY IF EXISTS "anon_ppe_insert" ON partner_profile_events;
CREATE POLICY "anon_ppe_insert" ON partner_profile_events FOR INSERT TO anon WITH CHECK (true);
