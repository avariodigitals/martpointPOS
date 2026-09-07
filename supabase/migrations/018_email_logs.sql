-- Email logs: persistent record of every outbound email attempt.
-- Idempotent and additive.

-- ═══════════════════════════════════════════════════════════════════════════════
-- EMAIL LOGS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS email_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "from" TEXT,
  "to" TEXT,
  subject TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending','sent','failed')),
  provider TEXT NOT NULL DEFAULT 'resend',
  provider_response TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sent_at TIMESTAMPTZ
);

ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side only)
DROP POLICY IF EXISTS "sr_email_logs_all" ON email_logs;
CREATE POLICY "sr_email_logs_all" ON email_logs FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS email_logs_created_at_idx ON email_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS email_logs_to_idx ON email_logs ("to");
CREATE INDEX IF NOT EXISTS email_logs_status_idx ON email_logs (status);
