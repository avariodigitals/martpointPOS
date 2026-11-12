-- A waived invoice is settled without collection. Clear stale balances left by
-- older waiver actions so outstanding and overdue totals cannot include them.
UPDATE public.invoices
SET balance_due = 0,
    updated_at = now()
WHERE upper(status) = 'WAIVED'
  AND COALESCE(balance_due, 0) <> 0;

NOTIFY pgrst, 'reload schema';
