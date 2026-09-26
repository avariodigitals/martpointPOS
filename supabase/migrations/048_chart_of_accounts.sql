-- Chart of Accounts, Payment (Bank/Cash) Accounts & Double-Entry Journal
-- Perfex-style bookkeeping layer on top of the existing commercial finance engine.
-- Additive only. Every confirmed payment, issued invoice, manual income/expense
-- transaction and commission payout posts a balanced journal entry.

-- ═══════════════════════════════════════════════════════════════════════════════
-- CHART OF ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS gl_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('ASSET','LIABILITY','EQUITY','INCOME','EXPENSE')),
  subtype TEXT, -- BANK, CASH, ACCOUNTS_RECEIVABLE, TAX_PAYABLE, REVENUE, EXPENSE, ...
  account_key TEXT, -- stable lookup key: 'cash', 'bank', 'income:<Category>', 'expense:<Category>'
  is_system BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS gl_accounts_key_uidx
  ON gl_accounts (account_key) WHERE account_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS gl_accounts_type_idx ON gl_accounts (type);
CREATE INDEX IF NOT EXISTS gl_accounts_active_idx ON gl_accounts (active);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PAYMENT ACCOUNTS (bank / cash / settlement accounts with statements)
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS payment_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  gl_account_id UUID NOT NULL UNIQUE REFERENCES gl_accounts(id) ON DELETE RESTRICT,
  payment_method TEXT UNIQUE CHECK (payment_method IN ('BANK_TRANSFER','PAYSTACK','FLUTTERWAVE','CASH','POS','OTHER')),
  bank_name TEXT,
  account_number_last4 TEXT,
  currency TEXT NOT NULL DEFAULT 'NGN',
  opening_balance NUMERIC(14,2) NOT NULL DEFAULT 0,
  opening_balance_date DATE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payment_accounts_active_idx ON payment_accounts (active);

-- ═══════════════════════════════════════════════════════════════════════════════
-- DOUBLE-ENTRY JOURNAL
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_number TEXT NOT NULL UNIQUE,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  memo TEXT,
  source_type TEXT NOT NULL CHECK (source_type IN (
    'INVOICE','PAYMENT','PAYMENT_REVERSAL','INCOME','EXPENSE',
    'TRANSFER','DEPOSIT','PAYOUT','OPENING','MANUAL'
  )),
  source_id TEXT,
  status TEXT NOT NULL DEFAULT 'POSTED' CHECK (status IN ('POSTED','VOID')),
  metadata JSONB,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  journal_entry_id UUID NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  gl_account_id UUID NOT NULL REFERENCES gl_accounts(id) ON DELETE RESTRICT,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  description TEXT,
  debit NUMERIC(14,2) NOT NULL DEFAULT 0,
  credit NUMERIC(14,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (debit >= 0 AND credit >= 0),
  CHECK ((debit > 0) <> (credit > 0))
);

CREATE INDEX IF NOT EXISTS journal_lines_entry_idx ON journal_lines (journal_entry_id);
CREATE INDEX IF NOT EXISTS journal_lines_account_idx ON journal_lines (gl_account_id);
CREATE INDEX IF NOT EXISTS journal_entries_source_idx ON journal_entries (source_type, source_id);
CREATE INDEX IF NOT EXISTS journal_entries_date_idx ON journal_entries (entry_date);
CREATE INDEX IF NOT EXISTS journal_entries_status_idx ON journal_entries (status);

CREATE TABLE IF NOT EXISTS journal_entry_counters (
  year INTEGER PRIMARY KEY,
  last_number INTEGER NOT NULL DEFAULT 0
);

CREATE OR REPLACE FUNCTION next_journal_entry_number(p_year INTEGER)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE next_num INTEGER;
BEGIN
  INSERT INTO journal_entry_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year)
  DO UPDATE SET last_number = journal_entry_counters.last_number + 1
  RETURNING last_number INTO next_num;
  RETURN 'MJE-' || p_year || '-' || LPAD(next_num::text, 5, '0');
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════════
-- LINK EXISTING OBJECTS TO THE LEDGER
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE finance_transactions
  ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

ALTER TABLE commission_payouts
  ADD COLUMN IF NOT EXISTS payment_account_id UUID REFERENCES payment_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE SET NULL;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED CHART OF ACCOUNTS
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO gl_accounts (code, name, type, subtype, account_key, is_system, active) VALUES
  ('1010', 'Cash on Hand',                 'ASSET',     'CASH',                'cash',                 true, true),
  ('1020', 'Primary Bank Account',         'ASSET',     'BANK',                'bank',                 true, true),
  ('1030', 'Paystack Settlement',          'ASSET',     'BANK',                'paystack',             true, true),
  ('1040', 'Flutterwave Settlement',       'ASSET',     'BANK',                'flutterwave',          true, true),
  ('1050', 'POS / Card Settlements',       'ASSET',     'BANK',                'pos',                  true, true),
  ('1100', 'Accounts Receivable',          'ASSET',     'ACCOUNTS_RECEIVABLE', 'accounts_receivable',  true, true),
  ('2100', 'VAT & Tax Payable',            'LIABILITY', 'TAX_PAYABLE',         'tax_payable',          true, true),
  ('2200', 'Unearned Revenue / Deposits',  'LIABILITY', 'UNEARNED_REVENUE',    'unearned_revenue',     true, true),
  ('2300', 'Commissions Payable',          'LIABILITY', 'COMMISSIONS_PAYABLE', 'commissions_payable',  true, true),
  ('3100', 'Retained Earnings',            'EQUITY',    'RETAINED_EARNINGS',   'retained_earnings',    true, true),
  ('3200', 'Opening Balance Equity',       'EQUITY',    'OPENING_BALANCE',     'opening_balance_equity', true, true)
ON CONFLICT (code) DO NOTHING;

-- Income accounts: one GL account per income category (4100-series).
INSERT INTO gl_accounts (code, name, type, subtype, account_key, is_system, active)
SELECT
  LPAD((4100 + (ROW_NUMBER() OVER (ORDER BY sort_order, name) * 10))::text, 4, '0'),
  name,
  'INCOME',
  'REVENUE',
  'income:' || name,
  true,
  true
FROM finance_categories
WHERE type = 'income'
ON CONFLICT (code) DO NOTHING;

-- Expense accounts: one GL account per expense category (5100-series).
INSERT INTO gl_accounts (code, name, type, subtype, account_key, is_system, active)
SELECT
  LPAD((5100 + (ROW_NUMBER() OVER (ORDER BY sort_order, name) * 10))::text, 4, '0'),
  name,
  'EXPENSE',
  'EXPENSE',
  'expense:' || name,
  true,
  true
FROM finance_categories
WHERE type = 'expense'
ON CONFLICT (code) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED PAYMENT ACCOUNTS (method -> settlement account mapping)
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO payment_accounts (name, gl_account_id, payment_method, is_default, active)
SELECT 'Cash', id, 'CASH', false, true FROM gl_accounts WHERE account_key = 'cash'
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_accounts (name, gl_account_id, payment_method, is_default, active)
SELECT 'Primary Bank', id, 'BANK_TRANSFER', true, true FROM gl_accounts WHERE account_key = 'bank'
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_accounts (name, gl_account_id, payment_method, active)
SELECT 'Paystack Settlement', id, 'PAYSTACK', true FROM gl_accounts WHERE account_key = 'paystack'
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_accounts (name, gl_account_id, payment_method, active)
SELECT 'Flutterwave Settlement', id, 'FLUTTERWAVE', true FROM gl_accounts WHERE account_key = 'flutterwave'
ON CONFLICT (name) DO NOTHING;

INSERT INTO payment_accounts (name, gl_account_id, payment_method, active)
SELECT 'POS Terminal', id, 'POS', true FROM gl_accounts WHERE account_key = 'pos'
ON CONFLICT (name) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════════
-- RLS
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE gl_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE journal_entry_counters ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_gl_accounts_all" ON gl_accounts;
CREATE POLICY "sr_gl_accounts_all" ON gl_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_payment_accounts_all" ON payment_accounts;
CREATE POLICY "sr_payment_accounts_all" ON payment_accounts FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_journal_entries_all" ON journal_entries;
CREATE POLICY "sr_journal_entries_all" ON journal_entries FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_journal_lines_all" ON journal_lines;
CREATE POLICY "sr_journal_lines_all" ON journal_lines FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_journal_entry_counters_all" ON journal_entry_counters;
CREATE POLICY "sr_journal_entry_counters_all" ON journal_entry_counters FOR ALL TO service_role USING (true) WITH CHECK (true);
