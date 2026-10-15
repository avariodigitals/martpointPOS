-- ═══════════════════════════════════════════════════════════════════════════
-- INSTALL CHECK-IN TOKENS + HARDENED USAGE MONITORING (migration 092).
--
-- Hardens what migration 089 started, BEFORE any automatic dormancy email is
-- enabled:
--   1. Each POS installation gets a unique private check-in token bound to its
--      business (install_tokens). The installation URL/hostname is no longer
--      the identity — it stays only as a legacy fallback. Rotation retires the
--      old token and issues a new one.
--   2. businesses.last_usage_at       — real POS activity (login/day-start).
--      businesses.last_system_ping_at — server health/cron/maintenance pings.
--      A running server must never mark the app as "recently active".
--   3. usage_ping_log records every check-in attempt with its outcome
--      (saved / unmatched / ambiguous / save_failed / invalid) so connection
--      problems are visible; full tokens are never stored.
--   4. dormancy_deliveries is the audit trail of "no recent check-in" notes
--      (sent/failed). The sweep claims a send with a compare-and-set on
--      businesses.last_dormant_email_at, so overlapping cron runs cannot
--      double-send.
--   5. businesses.dormancy_paused — per-client opt-out checked by the sweep.
--
-- Automatic dormancy emails stay OFF in app config (clientCheckins
-- .dormantEnabled defaults false); this migration only builds the plumbing.
--
-- Idempotent: safe to re-run. Service-role only (RLS enabled, no policies).
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────  businesses columns  ───────────────────────────
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS last_usage_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_system_ping_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dormancy_paused BOOLEAN NOT NULL DEFAULT false;

-- Anything the hostname path already recorded was genuine POS check-ins
-- (the PHP app calls it on activity), so seed the new usage clock with it.
UPDATE public.businesses
SET last_usage_at = last_seen_at
WHERE last_seen_at IS NOT NULL AND last_usage_at IS NULL;

CREATE INDEX IF NOT EXISTS businesses_last_usage_idx
  ON public.businesses (last_usage_at)
  WHERE last_usage_at IS NOT NULL;

-- ───────────────────────────  install tokens  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.install_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  label TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  retired_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS install_tokens_business_idx
  ON public.install_tokens (business_id) WHERE status = 'active';
CREATE UNIQUE INDEX IF NOT EXISTS install_tokens_one_active_per_business
  ON public.install_tokens (business_id) WHERE status = 'active';

ALTER TABLE public.install_tokens ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────  check-in attempt log  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_ping_log (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID REFERENCES public.businesses(id) ON DELETE SET NULL,
  source TEXT NOT NULL CHECK (source IN ('token', 'hostname')),
  ping_type TEXT NOT NULL DEFAULT 'usage' CHECK (ping_type IN ('usage', 'system')),
  outcome TEXT NOT NULL CHECK (outcome IN ('saved', 'unmatched', 'ambiguous', 'save_failed', 'invalid')),
  detail TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS usage_ping_log_recent_idx
  ON public.usage_ping_log (created_at DESC);
CREATE INDEX IF NOT EXISTS usage_ping_log_business_idx
  ON public.usage_ping_log (business_id, created_at DESC) WHERE business_id IS NOT NULL;

ALTER TABLE public.usage_ping_log ENABLE ROW LEVEL SECURITY;

-- ───────────────────────────  dormancy delivery history  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.dormancy_deliveries (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('sent', 'failed')),
  error TEXT,
  quiet_since TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS dormancy_deliveries_business_idx
  ON public.dormancy_deliveries (business_id, created_at DESC);

ALTER TABLE public.dormancy_deliveries ENABLE ROW LEVEL SECURITY;
