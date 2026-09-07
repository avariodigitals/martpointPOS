-- Finance categories: user-managed expense and income categories.

CREATE TABLE IF NOT EXISTS finance_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN ('expense','income')),
  name TEXT NOT NULL,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (type, name)
);

CREATE INDEX IF NOT EXISTS finance_categories_type_idx ON finance_categories (type);
CREATE INDEX IF NOT EXISTS finance_categories_active_idx ON finance_categories (active);

ALTER TABLE finance_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_finance_categories_all" ON finance_categories;
CREATE POLICY "sr_finance_categories_all" ON finance_categories FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Seed default expense categories (additive; ignores duplicates if re-run).
INSERT INTO finance_categories (type, name, sort_order) VALUES
  ('expense', 'Advertising & Marketing', 1),
  ('expense', 'Bank Charges & Fees', 2),
  ('expense', 'Business Registration & Compliance', 3),
  ('expense', 'Client Entertainment', 4),
  ('expense', 'Consulting & Professional Services', 5),
  ('expense', 'Customer Support', 6),
  ('expense', 'Depreciation', 7),
  ('expense', 'Equipment & Hardware', 8),
  ('expense', 'Fuel & Transportation', 9),
  ('expense', 'Hosting & Infrastructure', 10),
  ('expense', 'Insurance', 11),
  ('expense', 'Interest & Loan Repayments', 12),
  ('expense', 'Legal & Compliance', 13),
  ('expense', 'Marketing & Advertising', 14),
  ('expense', 'Office Rent', 15),
  ('expense', 'Office Supplies', 16),
  ('expense', 'Payroll & Salaries', 17),
  ('expense', 'Printing & Stationery', 18),
  ('expense', 'Professional Services', 19),
  ('expense', 'Repairs & Maintenance', 20),
  ('expense', 'Salaries & Wages', 21),
  ('expense', 'Security', 22),
  ('expense', 'Software & Tools', 23),
  ('expense', 'Staff Benefits', 24),
  ('expense', 'Taxes', 25),
  ('expense', 'Telephone & Internet', 26),
  ('expense', 'Training & Development', 27),
  ('expense', 'Travel & Accommodation', 28),
  ('expense', 'Utilities', 29),
  ('expense', 'Other Expenses', 30)
ON CONFLICT (type, name) DO NOTHING;

-- Seed default income categories.
INSERT INTO finance_categories (type, name, sort_order) VALUES
  ('income', 'Consulting Revenue', 1),
  ('income', 'Custom Development', 2),
  ('income', 'Implementation Services', 3),
  ('income', 'Interest Income', 4),
  ('income', 'Licensing Revenue', 5),
  ('income', 'Online Store Subscription', 6),
  ('income', 'Other Income', 7),
  ('income', 'Partner Commissions', 8),
  ('income', 'Product Sales', 9),
  ('income', 'Renewal Revenue', 10),
  ('income', 'Setup & Implementation', 11),
  ('income', 'Software Subscription', 12),
  ('income', 'Support Contracts', 13),
  ('income', 'Training Revenue', 14),
  ('income', 'White-Label Revenue', 15)
ON CONFLICT (type, name) DO NOTHING;
