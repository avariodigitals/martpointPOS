-- 083_subscription_waivers_and_licence_reporting.sql
--
-- Adds a WAIVED lifecycle to the commercial finance module so finance can record
-- subscriptions/licences that were granted without a cash sale (comped, bundled,
-- promotional, internal deployment). A waived subscription still counts as a
-- "licence sold" for the finance report, but nothing is owed.
--
-- Why this migration exists
--   The quote -> invoice -> payment flow only modelled paid revenue. Businesses
--   that receive a licence without ever being invoiced (e.g. partner demo
--   tenants, founding-customer deals, internal branches) had no way to be
--   represented, so subscription/licence counts drifted from reality.
--
-- What it adds
--   PART A — invoices.status gains 'WAIVED'
--            A waiver that is recorded against an invoice keeps the invoice row
--            (so downstream payment/ledger joins stay valid) but marks it as
--            WAIVED. A zero-amount WAIVED invoice is created automatically when a
--            subscription is waived, preserving the subscription -> invoice link.
--   PART B — subscriptions.status gains 'WAIVED'
--            Waivers are recorded on the subscription itself (source of truth for
--            "licence granted, nothing billed").
--   PART C — waiver audit columns on both tables
--   PART D — reporting index + a `licences_sold` view finance can query/export.
--
-- Idempotent: safe to re-run.

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART A — invoices: allow 'WAIVED'
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID','CANCELLED','WAIVED'));

-- Waiver audit trail (who waived it, when, and why). Kept nullable so existing
-- rows and non-waived invoices are unaffected.
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS waived_at   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waived_by   UUID,
  ADD COLUMN IF NOT EXISTS waive_reason TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART B — subscriptions: allow 'WAIVED'
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.subscriptions
  DROP CONSTRAINT IF EXISTS subscriptions_status_check;

ALTER TABLE public.subscriptions
  ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED','WAIVED'));

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS waived_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS waived_by    UUID,
  ADD COLUMN IF NOT EXISTS waive_reason TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART C — business_licenses: snapshot the plan the licence was derived from
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- The licence is ALWAYS derived from the selected plan (never from a service /
-- add-on catalog item). We snapshot the plan code + interval at issue time so
-- the licence-sold report can group by plan without re-joining the live plan
-- row (which may have been edited or deactivated since).

ALTER TABLE public.business_licenses
  ADD COLUMN IF NOT EXISTS plan_id          UUID REFERENCES public.plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS plan_code        TEXT,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT,
  ADD COLUMN IF NOT EXISTS waived           BOOLEAN NOT NULL DEFAULT false;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PART D — reporting
-- ═══════════════════════════════════════════════════════════════════════════════

-- Speeds up the "how many licences are sold" aggregation.
CREATE INDEX IF NOT EXISTS idx_business_licenses_status_issued
  ON public.business_licenses (status, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_subscriptions_status_business
  ON public.subscriptions (status, business_id);

-- Licences sold: one row per business licence that represents a granted licence.
--   * ACTIVE licences      -> sold, billed (or bundled)
--   * WAIVED licences      -> sold, not billed (comped)
-- We exclude PENDING/REVOKED/EXPIRED so the headline count matches what the
-- business can actually use. `quantity` comes from the linked subscription so
-- finance can report BOTH distinct businesses AND total seats/quantity.
CREATE OR REPLACE VIEW public.licences_sold AS
SELECT
  l.id                              AS licence_id,
  l.business_id,
  b.business_name,
  l.licence_type,
  l.status                          AS licence_status,
  l.plan_id,
  l.plan_code,
  l.billing_interval,
  l.waived,
  l.max_users,
  l.max_branches,
  l.online_store_enabled,
  l.effective_from,
  l.expires_at,
  l.issued_at,
  s.id                              AS subscription_id,
  s.status                          AS subscription_status,
  COALESCE(s.quantity, 1)           AS quantity,
  s.price_at_activation,
  s.currency
FROM public.business_licenses l
JOIN public.businesses b       ON b.id = l.business_id
LEFT JOIN public.subscriptions s ON s.id = l.subscription_id
WHERE l.status IN ('ACTIVE', 'WAIVED');

COMMENT ON VIEW public.licences_sold IS
  'Finance reporting: distinct businesses and total quantity of granted licences (ACTIVE + WAIVED).';
