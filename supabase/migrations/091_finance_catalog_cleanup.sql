-- 091: Finance catalogue cleanup.
--
-- Owner decision (14 Oct 2026): the only subscription Plans are the four tiers
-- advertised on /pricing (Basic, Standard, Premium, Enterprise Retail) plus the
-- one-time Retail Offline licence. Implementation / training / support packages
-- were misfiled as plans — they are Add-Ons or Services. Income categories are
-- standardised so invoice lines post to distinct accounts (subscription vs
-- add-on vs service vs product vs logistics) instead of one lumped category.

-- ═══════════════════════════════════════════════════════════════════════════
-- PART A — services: a category so each service bills to the right income GL
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.services DROP CONSTRAINT IF EXISTS services_category_check;
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
  CONSTRAINT services_category_check
  CHECK (category IN ('implementation','training','consulting','support','custom-development','logistics','other'));

UPDATE public.services SET category = 'implementation' WHERE code IN
  ('svc-onboarding','svc-data-migration','svc-hardware-install','svc-store-config','svc-branch-rollout','svc-backup-setup');
UPDATE public.services SET category = 'training'             WHERE code = 'svc-staff-training';
UPDATE public.services SET category = 'consulting'           WHERE code IN ('svc-consultation','svc-system-audit');
UPDATE public.services SET category = 'support'              WHERE code IN ('svc-account-management','svc-dedicated-support');
UPDATE public.services SET category = 'custom-development'   WHERE code IN ('svc-custom-reports','svc-api-integration','svc-workflow-automation','svc-custom-development');
UPDATE public.services SET category = 'logistics'            WHERE code = 'svc-logistics';

INSERT INTO public.services (code, name, description, default_price, currency, active, category)
VALUES ('svc-logistics', 'Logistics & Delivery', 'Delivery, dispatch and on-site logistics for hardware and equipment', 0, 'NGN', true, 'logistics')
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART B — plans: canonical tiers only
-- ═══════════════════════════════════════════════════════════════════════════
-- Codes mirror lib/pricing-plans.ts (source of truth for public pricing).
-- Legacy / misfiled plans are deactivated (never deleted): subscriptions and
-- invoice lines already reference them via plan_id / reference_id.

INSERT INTO public.plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
VALUES
  ((SELECT id FROM public.commercial_products WHERE code = 'mp-retail-pos'), 'plan-cloud-basic',     'Basic',            'For a single business getting started. 1 branch, 5 users.',            'RECURRING', 'ANNUAL', 'NGN', 99999,  1,  5, true, true, CURRENT_DATE),
  ((SELECT id FROM public.commercial_products WHERE code = 'mp-retail-pos'), 'plan-cloud-standard',  'Standard',         'For growing businesses with a few branches. 3 branches, 10 users.',    'RECURRING', 'ANNUAL', 'NGN', 249999, 3,  10, true, true, CURRENT_DATE),
  ((SELECT id FROM public.commercial_products WHERE code = 'mp-retail-pos'), 'plan-cloud-premium',   'Premium',          'For established multi-branch retailers. 5 branches, 25 users.',       'RECURRING', 'ANNUAL', 'NGN', 499999, 5,  25, true, true, CURRENT_DATE),
  ((SELECT id FROM public.commercial_products WHERE code = 'mp-retail-pos'), 'plan-cloud-enterprise','Enterprise Retail','Our largest Retail Cloud capacity tier. 10 branches, 50 users.',      'RECURRING', 'ANNUAL', 'NGN', 999999, 10, 50, true, true, CURRENT_DATE)
ON CONFLICT (code) DO NOTHING;

-- The offline licence already exists (RETAIL_OFFLINE, one-time). Keep it active.
UPDATE public.plans SET active = true, effective_until = NULL
WHERE code = 'RETAIL_OFFLINE';

UPDATE public.plans
SET active = false, effective_until = CURRENT_DATE
WHERE code NOT IN (
  'plan-cloud-basic','plan-cloud-standard','plan-cloud-premium','plan-cloud-enterprise','RETAIL_OFFLINE'
)
AND active = true;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART C — add-ons: canonical capacity + support add-ons (matches /pricing)
-- ═══════════════════════════════════════════════════════════════════════════

UPDATE public.addons SET default_price = 50000, billing_interval = 'ANNUAL' WHERE code = 'ADDITIONAL_BRANCH_YEAR';
UPDATE public.addons SET default_price = 25000, unit_name = 'pack of 5 users', billing_interval = 'ANNUAL' WHERE code = 'ADDITIONAL_USER';

INSERT INTO public.addons (code, name, description, pricing_type, unit_name, default_price, currency, recurring, billing_interval, active)
VALUES
  ('addon-products-500',   '500 Extra Main Products',      'Capacity add-on: per 500 main products, per year.',        'FIXED', 'pack', 15000, 'NGN', true, 'ANNUAL',  true),
  ('addon-variations-10k', '10,000 Extra Product Variations','Capacity add-on: per 10,000 variations, per year.',      'FIXED', 'pack', 25000, 'NGN', true, 'ANNUAL',  true),
  ('addon-services-100',   '100 Extra Services',           'Capacity add-on: per 100 services, per year.',            'FIXED', 'pack', 10000, 'NGN', true, 'ANNUAL',  true),
  ('addon-storage-basic',  'Basic Storage Upgrade (2 GB → 5 GB)', 'Basic plan only, per year.',                      'FIXED', NULL,   10000, 'NGN', true, 'ANNUAL',  true),
  ('addon-media-5gb',      'Additional 5 GB Media',        'Storage add-on: per 5 GB, per year.',                     'FIXED', '5 GB', 10000, 'NGN', true, 'ANNUAL',  true),
  ('addon-support-standard','Support Standard',            'Email and chat support contract (moved out of plans).',   'FIXED', NULL,   10000, 'NGN', true, 'MONTHLY', true),
  ('addon-support-premium','Support Premium',               'Priority phone and on-site support contract.',            'FIXED', NULL,   25000, 'NGN', true, 'MONTHLY', true)
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART D — income category taxonomy
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO public.finance_categories (type, name, sort_order)
VALUES
  ('income', 'Subscription Revenue',  16),
  ('income', 'One-Time License',      17),
  ('income', 'Add-On Revenue',        18),
  ('income', 'Logistics & Delivery',  19)
ON CONFLICT (type, name) DO NOTHING;

-- Superseded names (they were only ever produced by the old lumped invoice
-- sync; historical rows are re-derived by scripts/rederive-invoice-finance.ts).
UPDATE public.finance_categories SET active = false
WHERE type = 'income'
  AND name IN ('Software Subscription','Setup & Implementation','Renewal Revenue','Online Store Subscription','Licensing Revenue');

-- GL accounts for the new income categories (4260+ continues the 048 seed).
DO $$
DECLARE
  r RECORD;
  next_code INTEGER := 4260;
BEGIN
  FOR r IN
    SELECT name FROM public.finance_categories
    WHERE type = 'income'
      AND name IN ('Subscription Revenue','One-Time License','Add-On Revenue','Logistics & Delivery')
    ORDER BY sort_order
  LOOP
    IF NOT EXISTS (SELECT 1 FROM public.gl_accounts WHERE account_key = 'income:' || r.name) THEN
      INSERT INTO public.gl_accounts (code, name, type, subtype, account_key, is_system, active)
      VALUES (LPAD(next_code::text, 4, '0'), r.name, 'INCOME', 'REVENUE', 'income:' || r.name, true, true)
      ON CONFLICT (code) DO NOTHING;
      next_code := next_code + 10;
    END IF;
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- PART E — payment accounts: full account number (was last-4 only)
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.payment_accounts
  ADD COLUMN IF NOT EXISTS account_number TEXT;

UPDATE public.payment_accounts
SET account_number = '****' || account_number_last4
WHERE account_number IS NULL AND account_number_last4 IS NOT NULL;
