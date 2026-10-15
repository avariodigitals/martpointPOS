-- ═══════════════════════════════════════════════════════════════════════════
-- CLIENT CHECK-IN — founder check-in sequence for live clients.
--
-- When a client receives their access/credentials email, MartPoint records the
-- date they "connected" (businesses.access_sent_at) and automatically sends:
--   • a welcome email right away, then
--   • emotional founder check-ins at 30, 60, 90, 120, 180, 270 and 365 days
--     (the 1-year thank-you), and
--   • a "we've missed you" note if a client that used to be active stops
--     logging in for 30 days (businesses.last_seen_at, updated by
--     /api/usage/ping from the installed POS).
--
-- Reuses the automation engine (migration 080): the check-in run is scheduled
-- from the connection date, and the existing hourly sweep
-- (/api/cron/reminders → runAutomationSweep) executes each milestone.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────  Connection date on businesses  ───────────────────────────
-- Set once, when the access/credentials email first goes out. This is day 0
-- for the whole check-in sequence.
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS access_sent_at TIMESTAMPTZ;

-- Usage heartbeat: last time the installed POS reported activity
-- (GET/POST /api/usage/ping?key=<install url or domain>).
ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_dormant_email_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS businesses_access_sent_idx
  ON public.businesses (access_sent_at)
  WHERE access_sent_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS businesses_last_seen_idx
  ON public.businesses (last_seen_at)
  WHERE last_seen_at IS NOT NULL;

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
-- 7 steps: 30 → 60 → 90 → 120 → 180 → 270 → 365 days from connection.
-- The engine reschedules each step from the connection date (anchor-based),
-- so delay/interval below are only the fallback for the first scheduling.
-- The welcome email (day 0) is sent immediately by the access-details flow.
INSERT INTO public.automations (key, name, description, trigger, subject_type, delay_minutes, interval_minutes, max_steps, action_template, conditions)
VALUES
  (
    'client_checkin_monthly',
    'Founder check-in sequence (30 → 1 year)',
    'Sends the founder''s emotional check-in emails at 30, 60, 90, 120, 180, 270 and 365 days after the client received their access details, plus a we''ve-missed-you note after 30 days of no logins. Replies go to the founder directly.',
    'business.access_sent',
    'business',
    43200, 43200, 7,
    'client_checkin',
    '{"milestoneDays": [30, 60, 90, 120, 180, 270, 365]}'::jsonb
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
  conditions = EXCLUDED.conditions,
  updated_at = now();
