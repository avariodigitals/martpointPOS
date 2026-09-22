-- Partner badge kit:
-- 1. partners.badge_tier — which badge tier (SILVER/GOLD/PLATINUM/DIAMOND) the
--    partner has been issued, plus when the kit was generated.
-- 2. partner_profile_events — allow badge_click / badge_impression event types
--    so badge link clicks and image loads on partner sites are tracked.
-- Idempotent and additive.

ALTER TABLE partners ADD COLUMN IF NOT EXISTS badge_tier TEXT;
ALTER TABLE partners ADD COLUMN IF NOT EXISTS badge_kit_issued_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'partners_badge_tier_check'
  ) THEN
    ALTER TABLE partners
      ADD CONSTRAINT partners_badge_tier_check
      CHECK (badge_tier IS NULL OR badge_tier IN ('SILVER','GOLD','PLATINUM','DIAMOND'));
  END IF;
END $$;

-- Extend the event_type CHECK on partner_profile_events (same drop/re-add
-- pattern as 044_partner_resource_doc_categories.sql).
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  WHERE c.conrelid = 'partner_profile_events'::regclass
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) LIKE '%event_type%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE partner_profile_events DROP CONSTRAINT IF EXISTS %I', conname);
  END IF;
END $$;

ALTER TABLE partner_profile_events
  ADD CONSTRAINT partner_profile_events_event_type_check
  CHECK (event_type IN (
    'directory_click',
    'profile_view',
    'verify_lookup',
    'website_click',
    'phone_click',
    'email_click',
    'sales_cta_click',
    'badge_click',
    'badge_impression'
  ));
