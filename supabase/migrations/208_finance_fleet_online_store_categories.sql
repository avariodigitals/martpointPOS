-- Add Fleet Online Store as a selectable income and expense category.
INSERT INTO public.finance_categories (type, name, sort_order, active)
VALUES
  ('income', 'Fleet Online Store', 20, true),
  ('expense', 'Fleet Online Store', 31, true)
ON CONFLICT (type, name) DO UPDATE
SET active = true,
    updated_at = now();
