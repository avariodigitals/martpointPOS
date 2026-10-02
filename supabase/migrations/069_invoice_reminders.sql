-- Invoice payment reminders + invoice email tracking.
-- - reminders_paused: per-invoice kill switch for the automated reminder sweep.
-- - reminder_count / last_reminder_at: cadence + dedupe for the cron sweep.
-- - invoice_email_sent_at: records when the invoice email was last sent.

ALTER TABLE invoices
  ADD COLUMN IF NOT EXISTS reminders_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reminder_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invoice_email_sent_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS invoices_reminders_due_idx
  ON invoices (status, due_date)
  WHERE reminders_paused = false;
