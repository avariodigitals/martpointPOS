-- Structured project-specific terms retained with each Work Order so the
-- partner-reviewed PDF and the issued record show the same approved scope.
ALTER TABLE public.partner_work_orders
  ADD COLUMN IF NOT EXISTS terms JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.partner_work_orders.terms IS
  'Structured responsibilities, access, acceptance, payment, evidence, data protection and project-specific insurance terms used to render the accepted Work Order.';
