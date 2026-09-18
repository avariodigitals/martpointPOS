-- Lead email thread: two-way email history per lead.
-- Outbound rows are written by the admin Email tab; inbound rows by the
-- /api/webhooks/email inbound webhook. Idempotent and additive.

-- ═══════════════════════════════════════════════════════════════════════════════
-- LEAD EMAILS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS lead_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  direction TEXT NOT NULL CHECK (direction IN ('inbound','outbound')),
  from_email TEXT,
  to_email TEXT,
  subject TEXT,
  body_text TEXT,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'sent' CHECK (status IN ('pending','sent','failed','received')),
  provider TEXT,
  provider_message_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE lead_emails ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side only)
DROP POLICY IF EXISTS "sr_lead_emails_all" ON lead_emails;
CREATE POLICY "sr_lead_emails_all" ON lead_emails FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS lead_emails_lead_idx ON lead_emails (lead_id, created_at);
CREATE INDEX IF NOT EXISTS lead_emails_from_idx ON lead_emails (from_email);
