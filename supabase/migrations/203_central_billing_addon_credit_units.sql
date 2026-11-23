-- Credit purchases require positive units. Add-on purchases deliberately store
-- zero credit units and are validated by central_billing_intent_product_check.
ALTER TABLE public.central_billing_intents
  DROP CONSTRAINT IF EXISTS central_billing_intents_credit_units_check;

ALTER TABLE public.central_billing_intents
  ADD CONSTRAINT central_billing_intents_credit_units_check
  CHECK (
    (product_type = 'CREDIT' AND credit_units > 0)
    OR (product_type = 'ADDON' AND COALESCE(credit_units, 0) = 0)
  );
