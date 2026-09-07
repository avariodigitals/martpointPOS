-- Commercial catalog: products, plans and services available for invoices/quotes.
-- Includes default seed data and item_type=PRODUCT for invoice/quote line items.

-- Extend commercial_products with pricing fields for invoice line-item use.
ALTER TABLE commercial_products
  ADD COLUMN IF NOT EXISTS default_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'NGN';

-- Services catalog.
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  default_price NUMERIC(14,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'NGN',
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS services_active_idx ON services (active);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "sr_services_all" ON services;
CREATE POLICY "sr_services_all" ON services FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow PRODUCT references on quote/invoice line items.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname, conrelid::regclass::text AS tbl
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('quote_items'::regclass, 'invoice_items'::regclass)
      AND pg_get_constraintdef(oid) LIKE '%item_type%'
  LOOP
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;

  ALTER TABLE quote_items ADD CONSTRAINT quote_items_item_type_check
    CHECK (item_type IN ('PRODUCT','PLAN','ADDON','SERVICE','CUSTOM'));

  ALTER TABLE invoice_items ADD CONSTRAINT invoice_items_item_type_check
    CHECK (item_type IN ('PRODUCT','PLAN','ADDON','SERVICE','CUSTOM'));
END $$;

-- Seed default products.
INSERT INTO commercial_products (code, name, description, product_family, status, default_price, currency) VALUES
  ('mp-retail-pos', 'MartPoint Retail POS', 'Cloud point-of-sale for retail stores', 'RETAIL', 'ACTIVE', 0, 'NGN'),
  ('mp-erp', 'MartPoint ERP', 'Enterprise resource planning for multi-branch operations', 'ERP', 'ACTIVE', 0, 'NGN'),
  ('mp-intelligence', 'MartPoint Intelligence', 'BI dashboards and analytics', 'ANALYTICS', 'ACTIVE', 0, 'NGN'),
  ('mp-online-store', 'MartPoint Online Store', 'E-commerce storefront integrated with inventory', 'ECOMMERCE', 'ACTIVE', 0, 'NGN'),
  ('mp-mobile-app', 'MartPoint Mobile App', 'iOS/Android companion app for managers', 'MOBILE', 'ACTIVE', 0, 'NGN'),
  ('mp-kiosk', 'MartPoint Kiosk', 'Self-service ordering kiosk', 'RETAIL', 'ACTIVE', 0, 'NGN'),
  ('mp-accounting', 'MartPoint Accounting', 'Bookkeeping and general ledger', 'FINANCE', 'ACTIVE', 0, 'NGN'),
  ('mp-payroll', 'MartPoint Payroll', 'Staff payroll and payslip generation', 'FINANCE', 'ACTIVE', 0, 'NGN'),
  ('mp-crm', 'MartPoint CRM', 'Customer relationship management', 'CUSTOMER', 'ACTIVE', 0, 'NGN'),
  ('mp-inventory', 'MartPoint Inventory', 'Advanced inventory and stock control', 'RETAIL', 'ACTIVE', 0, 'NGN'),
  ('mp-loyalty', 'MartPoint Loyalty', 'Customer rewards and loyalty points', 'CUSTOMER', 'ACTIVE', 0, 'NGN'),
  ('mp-analytics', 'MartPoint Analytics', 'Sales, product and branch analytics', 'ANALYTICS', 'ACTIVE', 0, 'NGN'),
  ('mp-multi-branch', 'MartPoint Multi-Branch', 'Head-office management for chains', 'ERP', 'ACTIVE', 0, 'NGN'),
  ('mp-offline-pos', 'MartPoint Offline POS', 'POS that works without internet', 'RETAIL', 'ACTIVE', 0, 'NGN'),
  ('hw-tablet-bundle', 'Hardware Tablet Bundle', 'Tablet, printer and stand bundle', 'HARDWARE', 'ACTIVE', 185000, 'NGN'),
  ('hw-receipt-printer', 'Receipt Printer', 'Thermal receipt printer', 'HARDWARE', 'ACTIVE', 45000, 'NGN'),
  ('hw-barcode-scanner', 'Barcode Scanner', 'USB/Bluetooth barcode scanner', 'HARDWARE', 'ACTIVE', 25000, 'NGN'),
  ('hw-cash-drawer', 'Cash Drawer', 'POS cash drawer', 'HARDWARE', 'ACTIVE', 35000, 'NGN'),
  ('hw-customer-display', 'Customer Display', 'Customer-facing pole/display', 'HARDWARE', 'ACTIVE', 30000, 'NGN'),
  ('hw-tablet-stand', 'Tablet Stand', 'Counter tablet stand', 'HARDWARE', 'ACTIVE', 12000, 'NGN'),
  ('hw-pos-tablet', 'POS Tablet', 'Android tablet for POS use', 'HARDWARE', 'ACTIVE', 95000, 'NGN')
ON CONFLICT (code) DO NOTHING;

-- Seed default plans.
INSERT INTO plans (product_id, code, name, description, billing_type, billing_interval, currency, base_price, included_branches, included_users, online_store_included, active, effective_from) VALUES
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-retail-starter', 'Retail Starter', 'Single branch retail POS', 'RECURRING', 'MONTHLY', 'NGN', 15000, 1, 2, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-retail-growth', 'Retail Growth', 'Multi-branch retail with analytics', 'RECURRING', 'MONTHLY', 'NGN', 35000, 3, 5, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-retail-enterprise', 'Retail Enterprise', 'Unlimited branches and users', 'RECURRING', 'ANNUAL', 'NGN', 300000, 0, 0, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-erp'), 'plan-erp-starter', 'ERP Starter', 'Core ERP for small chains', 'RECURRING', 'MONTHLY', 'NGN', 45000, 2, 5, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-erp'), 'plan-erp-professional', 'ERP Professional', 'Full ERP with inventory and payroll', 'RECURRING', 'MONTHLY', 'NGN', 85000, 5, 15, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-erp'), 'plan-erp-enterprise', 'ERP Enterprise', 'Enterprise ERP with custom modules', 'RECURRING', 'ANNUAL', 'NGN', 750000, 0, 0, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-online-store'), 'plan-online-starter', 'Online Store Starter', 'Single store e-commerce', 'RECURRING', 'MONTHLY', 'NGN', 12000, 1, 2, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-online-store'), 'plan-online-growth', 'Online Store Growth', 'Multi-currency and multi-warehouse', 'RECURRING', 'MONTHLY', 'NGN', 28000, 1, 5, true, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-onboarding', 'Implementation Package', 'One-time setup and onboarding', 'ONE_TIME', 'NONE', 'NGN', 75000, 1, 2, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-training', 'Training Package', 'Staff training and documentation', 'ONE_TIME', 'NONE', 'NGN', 35000, 1, 10, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-support-standard', 'Support Standard', 'Email and chat support', 'RECURRING', 'MONTHLY', 'NGN', 10000, 1, 0, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-retail-pos'), 'plan-support-premium', 'Support Premium', 'Priority phone and on-site support', 'RECURRING', 'MONTHLY', 'NGN', 25000, 1, 0, false, true, CURRENT_DATE),
  ((SELECT id FROM commercial_products WHERE code = 'mp-erp'), 'plan-white-label', 'White-Label Partner Plan', 'White-label and reseller licence', 'RECURRING', 'ANNUAL', 'NGN', 500000, 0, 0, false, true, CURRENT_DATE)
ON CONFLICT (code) DO NOTHING;

-- Seed default services.
INSERT INTO services (code, name, description, default_price, currency, active) VALUES
  ('svc-onboarding', 'Onboarding & Setup', 'Initial account setup and configuration', 75000, 'NGN', true),
  ('svc-data-migration', 'Data Migration', 'Migrate products, customers and history', 120000, 'NGN', true),
  ('svc-staff-training', 'Staff Training', 'In-person or virtual staff training', 45000, 'NGN', true),
  ('svc-custom-reports', 'Custom Report Development', 'Tailored BI reports and dashboards', 65000, 'NGN', true),
  ('svc-api-integration', 'API Integration', 'Integrate with third-party systems', 150000, 'NGN', true),
  ('svc-workflow-automation', 'Workflow Automation', 'Automate approvals and alerts', 95000, 'NGN', true),
  ('svc-hardware-install', 'POS Hardware Installation', 'On-site hardware setup and testing', 35000, 'NGN', true),
  ('svc-account-management', 'Account Management', 'Dedicated account manager retainer', 80000, 'NGN', true),
  ('svc-dedicated-support', 'Dedicated Support', 'Priority support retainer', 50000, 'NGN', true),
  ('svc-consultation', 'Consultation', 'Business process and systems review', 40000, 'NGN', true),
  ('svc-store-config', 'Store Configuration', 'Products, taxes, branches and users setup', 30000, 'NGN', true),
  ('svc-branch-rollout', 'Branch Rollout', 'Configure and launch a new branch', 55000, 'NGN', true),
  ('svc-custom-development', 'Custom Feature Development', 'Bespoke feature or module', 250000, 'NGN', true),
  ('svc-system-audit', 'System Audit', 'Security and performance review', 60000, 'NGN', true),
  ('svc-backup-setup', 'Backup & Recovery Setup', 'Automated backup and restore config', 25000, 'NGN', true)
ON CONFLICT (code) DO NOTHING;
