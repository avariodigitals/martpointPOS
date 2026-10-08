-- ═══════════════════════════════════════════════════════════════════════════
-- ESTIMATE FOLLOW-UP — extends the automation engine (migration 080) with a
-- trigger that fires after a visitor receives a cost estimate on /estimate.
--
-- The visitor (now a lead) gets a friendly "your estimate is ready — want us
-- to turn it into a quote?" nudge at +48h, then every 48h, up to 3 steps.
-- It stops automatically once the lead is converted to a business or a quote
-- is created for them.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────  Widen the CHECK constraints  ───────────────────────────
-- Migration 080 added automations + runs with a fixed trigger/subject vocabulary.
-- Re-create those constraints so 'estimate.sent' and the 'estimate' subject work.

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_trigger_check;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_trigger_check CHECK (trigger IN (
    'questionnaire.sent',
    'quote.sent',
    'estimate.sent',
    'lead.created',
    'meeting.no_show',
    'manual'
  ));

ALTER TABLE public.automations DROP CONSTRAINT IF EXISTS automations_subject_type_check;
ALTER TABLE public.automations
  ADD CONSTRAINT automations_subject_type_check CHECK (subject_type IN ('lead', 'quotation', 'estimate'));

ALTER TABLE public.automation_runs DROP CONSTRAINT IF EXISTS automation_runs_subject_type_check;
ALTER TABLE public.automation_runs
  ADD CONSTRAINT automation_runs_subject_type_check CHECK (subject_type IN ('lead', 'quotation', 'estimate'));

-- ───────────────────────────  Seed the estimate follow-up  ───────────────────────────
-- First nudge at +48h, then every 48h, up to 3 steps.
INSERT INTO public.automations (key, name, description, trigger, subject_type, delay_minutes, interval_minutes, max_steps, action_template)
VALUES
  (
    'estimate_48h_followup',
    'Estimate 48h follow-up',
    'Nudges a visitor who received a cost estimate every 48h to turn it into a quote, until a business/quote exists.',
    'estimate.sent',
    'estimate',
    2880, 2880, 3,
    'lead_estimate_followup'
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
