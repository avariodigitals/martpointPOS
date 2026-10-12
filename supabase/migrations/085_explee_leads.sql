-- Explee (AutoGTM) hot-lead sync: links each imported lead to its Explee
-- person so the conversation thread can be mirrored into lead_emails and
-- re-synced as new replies arrive. Idempotent and additive.

-- ═══════════════════════════════════════════════════════════════════════════════
-- EXPLEE LEADS
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS explee_leads (
  lead_id UUID PRIMARY KEY REFERENCES leads(id) ON DELETE CASCADE,
  person_id TEXT NOT NULL,
  campaign_id INTEGER,
  became_hot_at TIMESTAMPTZ,
  thread_synced_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE explee_leads ENABLE ROW LEVEL SECURITY;

-- Service role full access (server-side only)
DROP POLICY IF EXISTS "sr_explee_leads_all" ON explee_leads;
CREATE POLICY "sr_explee_leads_all" ON explee_leads FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Sync cursor ("hot leads since the newest we already imported")
CREATE INDEX IF NOT EXISTS explee_leads_hot_idx ON explee_leads (became_hot_at DESC);
CREATE INDEX IF NOT EXISTS explee_leads_person_idx ON explee_leads (person_id);
