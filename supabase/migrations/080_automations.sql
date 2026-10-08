-- ═══════════════════════════════════════════════════════════════════════════
-- AUTOMATIONS — a small internal trigger → delay → action engine.
--
-- Goal: let sales/admin build follow-up sequences (e.g. "remind a lead every
-- 48h to finish the questionnaire or accept a quote") without shipping new
-- cron code for each one. The engine is intentionally small:
--
--   automations        — the definition (trigger + delay + action template)
--   automation_runs     — one scheduled occurrence per subject, with a due time
--   automation_events   — append-only log of what fired and what was sent
--
-- A single cron (/api/cron/reminders) picks up due, pending runs and executes
-- their action, then reschedules the next step (bounded by max_steps).
--
-- Also adds per-record reminder tracking to leads + lead_quotations so a
-- record can be paused/opted out and we know how many nudges went out.
--
-- Idempotent: safe to re-run.
-- ═══════════════════════════════════════════════════════════════════════════

-- ───────────────────────────  Automations  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Stable machine key, e.g. "questionnaire_48h_reminder".
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  -- What starts the sequence (informational + used by the scheduler).
  trigger TEXT NOT NULL CHECK (trigger IN (
    'questionnaire.sent',
    'quote.sent',
    'lead.created',
    'meeting.no_show',
    'manual'
  )),
  -- Which record type the run acts on.
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lead', 'quotation')),
  -- Minutes to wait before the first action (48h = 2880).
  delay_minutes INTEGER NOT NULL DEFAULT 2880,
  -- Minutes between subsequent steps.
  interval_minutes INTEGER NOT NULL DEFAULT 2880,
  -- Max number of times this automation may act on one subject.
  max_steps INTEGER NOT NULL DEFAULT 3,
  -- Template key resolved at send time by lib/automations.ts.
  action_template TEXT NOT NULL,
  -- Optional JSON conditions (e.g. { "productInterest": "retail" }).
  conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automations_enabled_idx ON public.automations (enabled) WHERE enabled = true;

-- ───────────────────────────  Automation runs  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID NOT NULL REFERENCES public.automations(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('lead', 'quotation')),
  subject_id UUID NOT NULL,
  -- Denormalised recipient so the sweep does not need to re-resolve it.
  recipient_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'skipped', 'failed', 'cancelled')),
  step INTEGER NOT NULL DEFAULT 1,
  scheduled_for TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_sent_at TIMESTAMPTZ,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- One active run per subject per automation.
  UNIQUE (automation_id, subject_type, subject_id)
);

CREATE INDEX IF NOT EXISTS automation_runs_due_idx
  ON public.automation_runs (scheduled_for)
  WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS automation_runs_subject_idx
  ON public.automation_runs (subject_type, subject_id);

-- ───────────────────────────  Automation events (audit)  ───────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES public.automations(id) ON DELETE SET NULL,
  run_id UUID REFERENCES public.automation_runs(id) ON DELETE SET NULL,
  event TEXT NOT NULL,
  subject_type TEXT,
  subject_id UUID,
  detail JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS automation_events_run_idx ON public.automation_events (run_id);
CREATE INDEX IF NOT EXISTS automation_events_created_idx ON public.automation_events (created_at DESC);

-- ───────────────────────────  Per-record reminder tracking  ───────────────────────────
ALTER TABLE public.leads
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminders_paused BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.lead_quotations
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminders_paused BOOLEAN NOT NULL DEFAULT false;

-- ───────────────────────────  RLS (service-role only, house style)  ───────────────────────────
ALTER TABLE public.automations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.automation_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sr_automations_all" ON public.automations;
CREATE POLICY "sr_automations_all" ON public.automations
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_automation_runs_all" ON public.automation_runs;
CREATE POLICY "sr_automation_runs_all" ON public.automation_runs
  FOR ALL TO service_role USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sr_automation_events_all" ON public.automation_events;
CREATE POLICY "sr_automation_events_all" ON public.automation_events
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- ───────────────────────────  Seed the first two automations  ───────────────────────────
-- First reminder at +48h, then every 48h, up to 3 steps.
INSERT INTO public.automations (key, name, description, trigger, subject_type, delay_minutes, interval_minutes, max_steps, action_template)
VALUES
  (
    'questionnaire_48h_reminder',
    'Questionnaire 48h reminder',
    'Nudges a lead every 48h to complete their requirements questionnaire until it is submitted.',
    'questionnaire.sent',
    'lead',
    2880, 2880, 3,
    'lead_questionnaire_reminder'
  ),
  (
    'quote_48h_reminder',
    'Quote 48h reminder',
    'Nudges a lead every 48h to review and accept their quotation until it is accepted or declined.',
    'quote.sent',
    'quotation',
    2880, 2880, 3,
    'lead_quote_reminder'
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
