-- Allow an older Finance quote to be connected to the plan selected after it
-- was created. This is intentionally nullable for historical quotes.
ALTER TABLE quotes
  ADD COLUMN IF NOT EXISTS plan_id UUID REFERENCES plans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS quotes_plan_id_idx
  ON quotes(plan_id);
