-- Assign voice campaigns to a browser-phone user or one of their queues.
ALTER TABLE public.azera_call_campaigns
  ADD COLUMN IF NOT EXISTS assigned_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_queue TEXT;

ALTER TABLE public.azera_call_campaigns
  DROP CONSTRAINT IF EXISTS azera_call_campaigns_assigned_queue_check;
ALTER TABLE public.azera_call_campaigns
  ADD CONSTRAINT azera_call_campaigns_assigned_queue_check
  CHECK (assigned_queue IS NULL OR assigned_queue IN ('sales','support','onboarding','customer_support'));

CREATE INDEX IF NOT EXISTS azera_call_campaigns_assigned_user_idx
  ON public.azera_call_campaigns (business_id, assigned_user_id, created_at DESC)
  WHERE assigned_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS azera_call_campaigns_assigned_queue_idx
  ON public.azera_call_campaigns (business_id, assigned_queue, created_at DESC)
  WHERE assigned_queue IS NOT NULL;

NOTIFY pgrst, 'reload schema';