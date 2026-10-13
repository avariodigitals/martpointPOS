-- ═══════════════════════════════════════════════════════════════════════════
-- CLIENT CHECK-IN — founder check-in sequence for live clients.
--
-- When a client receives their access/credentials email, MartPoint records the
-- date they "connected" (businesses.access_sent_at) and automatically sends:
--   • a welcome email right away, then
--   • emotional founder check-ins at 30, 60, 90 and 120 days after connection.
--
-- Reuses the automation engine (migration 080): the check-in run is scheduled
-- at +30 days and the existing hourly sweep (/api/cron/reminders →
-- runAutomationSweep) resends every 30 days until max_steps (4) is reached.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────  Connection date on businesses  ───────────────────────────
-- Set once, when the access/credentials email first goes out. This is day 0
-- for the whole check-in sequence.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS access_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS businesses_access_sent_idx
  ON public.businesses (access_sent_at)
  WHERE access_sent_at IS NOT NULL;

-- Backfill: clients whose access details were already sent via onboarding.
-- (onboarding.access_details->>'lastSentAt' is written by the access route.)
UPDATE public.businesses b
SET access_sent_at = x.sent_at
FROM (
  SELECT o.business_id, (o.access_details ->> 'lastSentAt')::timestamptz AS sent_at
  FROM public.onboarding o
  WHERE o.business_id IS NOT NULL
    AND o.access_details ->> 'lastSentAt' ~ '^\d{4}-[0-9]{2}-[0-9]{2}'
  OFFSET 0
) x
WHERE x.business_id = b.id
  AND b.access_sent_at IS NULL;

-- ───────────────────────────  Widen the CHECK constraints  ───────────────────────────
ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_check;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_trigger_check CHECK (trigger IN (
    'questionnaire.sent',
    'quote.sent',
    'estimate.sent',
    'lead.created',
    'meeting.no_show',
    'business.access_sent',
    'manual'
  ));

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_subject_type_check;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_subject_type_check CHECK (subject_type IN ('lead', 'quotation', 'estimate', 'business'));

ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_subject_type_check;
ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_subject_type_check CHECK (subject_type IN ('lead', 'quotation', 'estimate', 'business'));

-- ───────────────────────────  Seed the founder check-in sequence  ───────────────────────────
-- First check-in at +30 days from connection, then every 30 days, 4 steps:
-- 30 → 60 → 90 → 120 days. The welcome email (day 0) is sent immediately by
-- the access-details flow, not by the engine.
INSERT INTO public.automations (key, name, description, trigger, subject_type, delay_minutes, interval_minutes, max_steps, action_template)
VALUES
  (
    'client_checkin_monthly',
    'Founder monthly check-in (30/60/90/120 days)',
    'Sends the founder''s emotional check-in emails to live clients 30, 60, 90 and 120 days after they received their access details. Replies go to the founder directly.',
    'business.access_sent',
    'business',
    43200, 43200, 4,
    'client_checkin'
  )
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  trigger = EXCLUDED.trigger,
  subject_type = EXCLUDED.subject_type,
  delay_minutes = EXCLUDED.delay_minutes,
  interval_minutes = EXCLUDED.interval_minutes,
  max_steps = EXCLUDED.max_steps,
  action_template = EXCLUDED.action_template,
  updated_at = now();
