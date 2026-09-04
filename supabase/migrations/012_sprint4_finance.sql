-- Sprint 4: Commercial Finance, Billing, Subscriptions, Renewals & Partner Commissions
-- Additive only. Preserves finance_transactions, finance_settings, and all Sprint 1-3 objects.

-- ═══════════════════════════════════════════════════════════════════════════════
-- COMMERCIAL PRODUCT MODEL
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS commercial_products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  product_family TEXT NOT NULL DEFAULT 'RETAIL',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES commercial_products(id) ON DELETE RESTRICT,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  billing_type TEXT NOT NULL CHECK (billing_type IN ('RECURRING','ONE_TIME')),
  billing_interval TEXT NOT NULL DEFAULT 'NONE' CHECK (billing_interval IN ('MONTHLY','QUARTERLY','ANNUAL','NONE')),
  currency TEXT NOT NULL DEFAULT 'NGN',
  base_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  included_branches INTEGER NOT NULL DEFAULT 1,
  included_users INTEGER NOT NULL DEFAULT 1,
  online_store_included BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  pricing_type TEXT NOT NULL DEFAULT 'FIXED' CHECK (pricing_type IN ('FIXED','PER_UNIT','CUSTOM')),
  unit_name TEXT,
  default_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  recurring BOOLEAN NOT NULL DEFAULT false,
  billing_interval TEXT CHECK (billing_interval IN ('MONTHLY','QUARTERLY','ANNUAL','NONE')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- BUSINESS COMMERCIAL PROFILE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS business_commercial_profiles (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  billing_name TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  billing_address TEXT,
  tax_id TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_terms_days INTEGER NOT NULL DEFAULT 7,
  account_status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE','ON_HOLD','SUSPENDED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed profiles for existing businesses
INSERT INTO business_commercial_profiles (business_id, currency, payment_terms_days)
SELECT id, 'NGN', 7
FROM businesses
ON CONFLICT (business_id) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- QUOTATIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS quotes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  partner_id UUID REFERENCES partners(id) ON DELETE SET NULL,
  partner_lead_id UUID REFERENCES partner_leads(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','SENT','ACCEPTED','DECLINED','EXPIRED','CONVERTED')),
  currency TEXT NOT NULL DEFAULT 'NGN',
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  valid_until DATE,
  notes_public TEXT,
  notes_internal TEXT,
  created_by UUID,
  approved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS quote_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_id UUID NOT NULL REFERENCES quotes(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('PLAN','ADDON','SERVICE','CUSTOM')),
  reference_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS quote_number_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_quote_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO quote_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = quote_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPQ-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INVOICES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS invoices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  quote_id UUID REFERENCES quotes(id) ON DELETE SET NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(14,2) NOT NULL DEFAULT 0,
  balance_due NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','ISSUED','PARTIALLY_PAID','PAID','OVERDUE','VOID','CANCELLED')),
  notes_public TEXT,
  notes_internal TEXT,
  created_by UUID,
  issued_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoice_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  item_type TEXT NOT NULL CHECK (item_type IN ('PLAN','ADDON','SERVICE','CUSTOM')),
  reference_id UUID,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  line_total NUMERIC(14,2) NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS invoice_number_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_invoice_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO invoice_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = invoice_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPI-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PAYMENTS & RECEIPTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_reference TEXT NOT NULL UNIQUE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_method TEXT NOT NULL CHECK (payment_method IN ('BANK_TRANSFER','PAYSTACK','FLUTTERWAVE','CASH','POS','OTHER')),
  gateway_reference TEXT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','CONFIRMED','FAILED','REVERSED','REFUNDED','PARTIALLY_REFUNDED')),
  paid_at TIMESTAMPTZ,
  confirmed_at TIMESTAMPTZ,
  confirmed_by UUID,
  proof_document_path TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS payment_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  amount_allocated NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (payment_id, invoice_id)
);

CREATE TABLE IF NOT EXISTS payment_reference_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_payment_reference(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO payment_reference_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = payment_reference_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPP-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

CREATE TABLE IF NOT EXISTS receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number TEXT NOT NULL UNIQUE,
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  issued_by UUID
);

CREATE TABLE IF NOT EXISTS receipt_number_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_receipt_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO receipt_number_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = receipt_number_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPR-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SUBSCRIPTIONS, ADD-ONS, RENEWALS & LICENCES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','PAST_DUE','SUSPENDED','CANCELLED','EXPIRED')),
  billing_interval TEXT NOT NULL CHECK (billing_interval IN ('MONTHLY','QUARTERLY','ANNUAL','NONE')),
  start_date DATE NOT NULL,
  current_period_start DATE NOT NULL,
  current_period_end DATE NOT NULL,
  renewal_date DATE,
  auto_renew BOOLEAN NOT NULL DEFAULT false,
  quantity NUMERIC(10,2),
  price_at_activation NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  created_by UUID,
  activated_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_addons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  addon_id UUID NOT NULL REFERENCES addons(id) ON DELETE RESTRICT,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price_at_activation NUMERIC(14,2) NOT NULL,
  total_price NUMERIC(14,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE','INACTIVE','EXPIRED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS business_licenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  licence_type TEXT NOT NULL CHECK (licence_type IN ('CLOUD','ERP','OFFLINE','CUSTOM')),
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ACTIVE','SUSPENDED','EXPIRED','REVOKED')),
  issued_at TIMESTAMPTZ,
  effective_from DATE,
  expires_at DATE,
  max_users INTEGER NOT NULL DEFAULT 1,
  max_branches INTEGER NOT NULL DEFAULT 1,
  online_store_enabled BOOLEAN NOT NULL DEFAULT false,
  deployment_id UUID REFERENCES business_deployments(id) ON DELETE SET NULL,
  internal_reference TEXT,
  created_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscription_renewals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
  renewal_due_date DATE NOT NULL,
  renewal_invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'UPCOMING' CHECK (status IN ('UPCOMING','DUE','OVERDUE','RENEWED','NOT_RENEWING')),
  renewed_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTNER COMMISSIONS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS commission_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  partner_type TEXT,
  commission_basis TEXT NOT NULL CHECK (commission_basis IN ('PERCENTAGE','FIXED')),
  percentage NUMERIC(6,4),
  fixed_amount NUMERIC(14,2),
  applies_to TEXT NOT NULL CHECK (applies_to IN ('INITIAL_LICENSE','RENEWAL','ADDON','IMPLEMENTATION','CUSTOM')),
  product_id UUID REFERENCES commercial_products(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES plans(id) ON DELETE SET NULL,
  addon_id UUID REFERENCES addons(id) ON DELETE SET NULL,
  effective_from DATE NOT NULL DEFAULT CURRENT_DATE,
  effective_until DATE,
  active BOOLEAN NOT NULL DEFAULT true,
  commission_trigger TEXT NOT NULL CHECK (commission_trigger IN ('PAYMENT_CONFIRMED','SUBSCRIPTION_ACTIVATED','CUSTOMER_GO_LIVE')),
  clawback_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS partner_commissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  subscription_id UUID REFERENCES subscriptions(id) ON DELETE SET NULL,
  commission_plan_id UUID NOT NULL REFERENCES commission_plans(id) ON DELETE RESTRICT,
  basis_amount NUMERIC(14,2) NOT NULL,
  commission_rate NUMERIC(6,4),
  fixed_amount NUMERIC(14,2),
  commission_amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING','ELIGIBLE','APPROVED','SCHEDULED','PAID','REVERSED','CANCELLED')),
  earned_at TIMESTAMPTZ,
  approved_at TIMESTAMPTZ,
  approved_by UUID,
  paid_at TIMESTAMPTZ,
  reversal_reason TEXT,
  attribution_type TEXT NOT NULL DEFAULT 'ORIGINATING' CHECK (attribution_type IN ('ORIGINATING','SALES','IMPLEMENTATION')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commission_payouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_reference TEXT NOT NULL UNIQUE,
  partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NGN',
  payment_method TEXT,
  bank_reference TEXT,
  status TEXT NOT NULL DEFAULT 'DRAFT' CHECK (status IN ('DRAFT','APPROVED','PAID','FAILED','CANCELLED')),
  approved_by UUID,
  approved_at TIMESTAMPTZ,
  paid_by UUID,
  paid_at TIMESTAMPTZ,
  notes_internal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS commission_payout_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payout_id UUID NOT NULL REFERENCES commission_payouts(id) ON DELETE CASCADE,
  commission_id UUID NOT NULL REFERENCES partner_commissions(id) ON DELETE RESTRICT,
  amount NUMERIC(14,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (commission_id)
);

CREATE TABLE IF NOT EXISTS commission_payout_reference_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_commission_payout_reference(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO commission_payout_reference_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = commission_payout_reference_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MPCP-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- ENTITLEMENT CHANGE LOG & FINANCE AUDIT EVENTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS entitlement_change_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  source_id UUID,
  previous_values JSONB,
  new_values JSONB,
  reason TEXT,
  changed_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS finance_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_type TEXT NOT NULL CHECK (actor_type IN ('ADMIN','SYSTEM','PARTNER')),
  actor_id UUID,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- LINK INTERNAL ACCOUNTING TO COMMERCIAL FINANCE
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS commercial_reference TEXT;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED COMMERCIAL PRODUCTS, PLANS & ADD-ONS (MIGRATE EXISTING PRICING)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO commercial_products (code, name, description, product_family, status)
VALUES
  ('MARTPOINT_RETAIL', 'MartPoint Retail', 'Cloud and offline retail POS plans.', 'RETAIL', 'ACTIVE'),
  ('MARTPOINT_ERP', 'MartPoint ERP', 'Growth, Scale and Corporate ERP plans.', 'ERP', 'ACTIVE'),
  ('ONLINE_STORE', 'Online Store', 'E-commerce storefront addon.', 'ADDON', 'ACTIVE'),
  ('IMPLEMENTATION', 'Implementation', 'Setup and implementation services.', 'SERVICE', 'ACTIVE'),
  ('TRAINING', 'Training', 'Customer and onsite training.', 'SERVICE', 'ACTIVE'),
  ('MARKETING', 'Marketing', 'Marketing add-on services.', 'ADDON', 'ACTIVE'),
  ('OTHER', 'Other', 'Miscellaneous commercial items.', 'OTHER', 'ACTIVE')
ON CONFLICT (code) DO NOTHING;

-- Migrate current advertised pricing into plans.  Placeholder prices for Custom/quote-only plans.
INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
SELECT
  cp.id,
  'RETAIL_CLOUD',
  'MartPoint Retail Cloud',
  '1 branch, 5 users, Standard Online Store included.',
  'RECURRING',
  'ANNUAL',
  'NGN',
  99999.00,
  1,
  5,
  true,
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_RETAIL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
SELECT
  cp.id,
  'RETAIL_OFFLINE',
  'MartPoint Retail Offline',
  'Full software installed locally. No recurring subscription. Works without internet.',
  'ONE_TIME',
  'NONE',
  'NGN',
  250000.00,
  1,
  5,
  false,
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_RETAIL'
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
SELECT
  cp.id,
  'ERP_GROWTH',
  'Growth',
  'For SMEs ready to systematize operations.',
  'RECURRING',
  'MONTHLY',
  'NGN',
  85000.00,
  1,
  5,
  false,
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_ERP'
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
SELECT
  cp.id,
  'ERP_SCALE',
  'Scale',
  'For multi-department businesses.',
  'RECURRING',
  'MONTHLY',
  'NGN',
  180000.00,
  1,
  10,
  false,
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_ERP'
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from)
SELECT
  cp.id,
  'ERP_CORPORATE',
  'Corporate',
  'Custom enterprise package. Price on quote.',
  'RECURRING',
  'MONTHLY',
  'NGN',
  0.00,
  0,
  0,
  false,
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_ERP'
ON CONFLICT (code) DO NOTHING;

-- Addons: migrate advertised branch add-on prices and prepare standard addon catalog.
INSERT INTO addons (code, name, description, pricing_type, unit_name, default_price, currency, recurring, billing_interval, active)
VALUES
  ('ADDITIONAL_BRANCH_YEAR', 'Additional Branch (Annual)', 'Extra branch on an annual plan.', 'FIXED', 'branch', 49999.00, 'NGN', true, 'ANNUAL', true),
  ('ADDITIONAL_BRANCH_ONETIME', 'Additional Branch (One-Time)', 'Extra branch on an offline/perpetual plan.', 'FIXED', 'branch', 100000.00, 'NGN', false, 'NONE', true),
  ('ADDITIONAL_USER', 'Additional User', 'Extra user license.', 'PER_UNIT', 'user', 0.00, 'NGN', true, 'MONTHLY', true),
  ('ONLINE_STORE', 'Online Store', 'E-commerce storefront.', 'FIXED', NULL, 0.00, 'NGN', true, 'ANNUAL', true),
  ('IMPLEMENTATION', 'Implementation', 'Setup and implementation service.', 'CUSTOM', NULL, 0.00, 'NGN', false, 'NONE', true),
  ('ONSITE_TRAINING', 'Onsite Training', 'Onsite customer training.', 'CUSTOM', NULL, 0.00, 'NGN', false, 'NONE', true),
  ('CUSTOM_SETUP', 'Custom Setup', 'Custom configuration service.', 'CUSTOM', NULL, 0.00, 'NGN', false, 'NONE', true),
  ('MARKETING_ADDON', 'Marketing Add-on', 'Marketing and promotional services.', 'CUSTOM', NULL, 0.00, 'NGN', false, 'NONE', true)
ON CONFLICT (code) DO NOTHING;

-- Seed a default referral commission plan for MARTPOINT_RETAIL initial licenses when payment is confirmed.
INSERT INTO commission_plans (name, description, partner_type, commission_basis, percentage, applies_to, product_id, commission_trigger, active, effective_from)
SELECT
  'Retail Referral 10%',
  'Default 10% of invoice total for retail initial license after payment confirmed.',
  'REFERRAL',
  'PERCENTAGE',
  10.0000,
  'INITIAL_LICENSE',
  cp.id,
  'PAYMENT_CONFIRMED',
  true,
  CURRENT_DATE
FROM commercial_products cp
WHERE cp.code = 'MARTPOINT_RETAIL'
ON CONFLICT DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS plans_product_id_idx ON plans (product_id);
CREATE INDEX IF NOT EXISTS plans_active_idx ON plans (active, effective_from);
CREATE INDEX IF NOT EXISTS quotes_business_id_idx ON quotes (business_id);
CREATE INDEX IF NOT EXISTS quotes_partner_id_idx ON quotes (partner_id);
CREATE INDEX IF NOT EXISTS quotes_status_idx ON quotes (status);
CREATE INDEX IF NOT EXISTS quote_items_quote_id_idx ON quote_items (quote_id);
CREATE INDEX IF NOT EXISTS invoices_business_id_idx ON invoices (business_id);
CREATE INDEX IF NOT EXISTS invoices_status_idx ON invoices (status);
CREATE INDEX IF NOT EXISTS invoices_due_date_idx ON invoices (due_date);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_id_idx ON invoice_items (invoice_id);
CREATE INDEX IF NOT EXISTS payments_business_id_idx ON payments (business_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (status);
CREATE INDEX IF NOT EXISTS payments_invoice_id_idx ON payments (invoice_id);
CREATE INDEX IF NOT EXISTS payment_allocations_payment_id_idx ON payment_allocations (payment_id);
CREATE INDEX IF NOT EXISTS payment_allocations_invoice_id_idx ON payment_allocations (invoice_id);
CREATE INDEX IF NOT EXISTS receipts_payment_id_idx ON receipts (payment_id);
CREATE INDEX IF NOT EXISTS receipts_business_id_idx ON receipts (business_id);
CREATE INDEX IF NOT EXISTS subscriptions_business_id_idx ON subscriptions (business_id);
CREATE INDEX IF NOT EXISTS subscriptions_status_idx ON subscriptions (status);
CREATE INDEX IF NOT EXISTS subscriptions_renewal_date_idx ON subscriptions (renewal_date);
CREATE INDEX IF NOT EXISTS subscription_addons_subscription_id_idx ON subscription_addons (subscription_id);
CREATE INDEX IF NOT EXISTS business_licenses_business_id_idx ON business_licenses (business_id);
CREATE INDEX IF NOT EXISTS business_licenses_status_idx ON business_licenses (status);
CREATE INDEX IF NOT EXISTS subscription_renewals_due_date_idx ON subscription_renewals (renewal_due_date);
CREATE INDEX IF NOT EXISTS subscription_renewals_status_idx ON subscription_renewals (status);
CREATE INDEX IF NOT EXISTS partner_commissions_partner_id_idx ON partner_commissions (partner_id);
CREATE INDEX IF NOT EXISTS partner_commissions_business_id_idx ON partner_commissions (business_id);
CREATE INDEX IF NOT EXISTS partner_commissions_status_idx ON partner_commissions (status);
CREATE INDEX IF NOT EXISTS commission_payouts_partner_id_idx ON commission_payouts (partner_id);
CREATE INDEX IF NOT EXISTS commission_payout_items_payout_id_idx ON commission_payout_items (payout_id);
CREATE INDEX IF NOT EXISTS entitlement_change_log_business_id_idx ON entitlement_change_log (business_id);
CREATE INDEX IF NOT EXISTS finance_audit_events_entity_idx ON finance_audit_events (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS finance_audit_events_action_idx ON finance_audit_events (action);
CREATE INDEX IF NOT EXISTS finance_audit_events_created_at_idx ON finance_audit_events (created_at DESC);

-- Finance transaction link indexes
CREATE INDEX IF NOT EXISTS finance_txn_business_id_idx ON finance_transactions (business_id);
CREATE INDEX IF NOT EXISTS finance_txn_invoice_id_idx ON finance_transactions (invoice_id);
CREATE INDEX IF NOT EXISTS finance_txn_payment_id_idx ON finance_transactions (payment_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE commercial_products ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_commercial_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE quote_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_addons ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscription_renewals ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE partner_commissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE commission_payout_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlement_change_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_audit_events ENABLE ROW LEVEL SECURITY;

-- Service role full access on all new commercial tables
DROP POLICY IF EXISTS "sr_commercial_products_all" ON commercial_products;
CREATE POLICY "sr_commercial_products_all" ON commercial_products FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_plans_all" ON plans;
CREATE POLICY "sr_plans_all" ON plans FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_addons_all" ON addons;
CREATE POLICY "sr_addons_all" ON addons FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_business_commercial_profiles_all" ON business_commercial_profiles;
CREATE POLICY "sr_business_commercial_profiles_all" ON business_commercial_profiles FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_quotes_all" ON quotes;
CREATE POLICY "sr_quotes_all" ON quotes FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_quote_items_all" ON quote_items;
CREATE POLICY "sr_quote_items_all" ON quote_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_invoices_all" ON invoices;
CREATE POLICY "sr_invoices_all" ON invoices FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_invoice_items_all" ON invoice_items;
CREATE POLICY "sr_invoice_items_all" ON invoice_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_payments_all" ON payments;
CREATE POLICY "sr_payments_all" ON payments FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_payment_allocations_all" ON payment_allocations;
CREATE POLICY "sr_payment_allocations_all" ON payment_allocations FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_receipts_all" ON receipts;
CREATE POLICY "sr_receipts_all" ON receipts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_subscriptions_all" ON subscriptions;
CREATE POLICY "sr_subscriptions_all" ON subscriptions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_subscription_addons_all" ON subscription_addons;
CREATE POLICY "sr_subscription_addons_all" ON subscription_addons FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_business_licenses_all" ON business_licenses;
CREATE POLICY "sr_business_licenses_all" ON business_licenses FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_subscription_renewals_all" ON subscription_renewals;
CREATE POLICY "sr_subscription_renewals_all" ON subscription_renewals FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_commission_plans_all" ON commission_plans;
CREATE POLICY "sr_commission_plans_all" ON commission_plans FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_partner_commissions_all" ON partner_commissions;
CREATE POLICY "sr_partner_commissions_all" ON partner_commissions FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_commission_payouts_all" ON commission_payouts;
CREATE POLICY "sr_commission_payouts_all" ON commission_payouts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_commission_payout_items_all" ON commission_payout_items;
CREATE POLICY "sr_commission_payout_items_all" ON commission_payout_items FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_entitlement_change_log_all" ON entitlement_change_log;
CREATE POLICY "sr_entitlement_change_log_all" ON entitlement_change_log FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_finance_audit_events_all" ON finance_audit_events;
CREATE POLICY "sr_finance_audit_events_all" ON finance_audit_events FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Unique constraints for service-layer upsert keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'business_licenses_business_id_unique') THEN
    ALTER TABLE business_licenses ADD CONSTRAINT business_licenses_business_id_unique UNIQUE (business_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'business_licenses unique constraint skipped: %', SQLERRM;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'subscription_renewals_subscription_id_unique') THEN
    ALTER TABLE subscription_renewals ADD CONSTRAINT subscription_renewals_subscription_id_unique UNIQUE (subscription_id);
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'subscription_renewals unique constraint skipped: %', SQLERRM;
END $$;
