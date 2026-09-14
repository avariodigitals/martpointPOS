-- Backfill already-issued/paid/overdue invoices into finance_transactions.
-- This is idempotent: it skips any invoice that already has an income row.

WITH first_items AS (
  SELECT DISTINCT ON (invoice_id)
    invoice_id,
    item_type
  FROM invoice_items
  ORDER BY invoice_id, created_at
),
plan_items AS (
  SELECT DISTINCT ON (ii.invoice_id)
    ii.invoice_id,
    p.billing_type,
    p.billing_interval
  FROM invoice_items ii
  JOIN plans p ON p.id = ii.reference_id
  WHERE ii.item_type = 'PLAN'
  ORDER BY ii.invoice_id, ii.created_at
)
INSERT INTO finance_transactions (
  id,
  type,
  category,
  subcategory,
  amount,
  tax,
  description,
  date,
  business_id,
  invoice_id,
  commercial_reference,
  recurring,
  frequency,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'income',
  CASE
    WHEN fi.item_type = 'PRODUCT' THEN 'Product Sales'
    WHEN fi.item_type = 'PLAN' THEN 'Software Subscription'
    WHEN fi.item_type = 'ADDON' THEN 'Support Contracts'
    WHEN fi.item_type = 'SERVICE' THEN 'Implementation Services'
    ELSE 'Other Income'
  END,
  'Invoice ' || i.invoice_number,
  round(i.total_amount),
  round(i.tax_amount),
  'Invoice ' || i.invoice_number,
  i.issue_date,
  i.business_id,
  i.id,
  i.invoice_number,
  COALESCE(pi.billing_type = 'RECURRING', false),
  CASE
    WHEN pi.billing_type <> 'RECURRING' THEN 'one-time'
    WHEN pi.billing_interval = 'MONTHLY' THEN 'monthly'
    WHEN pi.billing_interval = 'QUARTERLY' THEN 'quarterly'
    WHEN pi.billing_interval = 'ANNUAL' THEN 'yearly'
    ELSE 'one-time'
  END,
  now(),
  now()
FROM invoices i
LEFT JOIN first_items fi ON fi.invoice_id = i.id
LEFT JOIN plan_items pi ON pi.invoice_id = i.id
WHERE i.status IN ('ISSUED', 'PARTIALLY_PAID', 'PAID', 'OVERDUE')
  AND NOT EXISTS (
    SELECT 1
    FROM finance_transactions ft
    WHERE ft.invoice_id = i.id AND ft.type = 'income'
  );
